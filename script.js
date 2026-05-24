const BASE_URL = "https://api.openweathermap.org/data/2.5";
const STORAGE_KEYS = {
    units: "skycast-units",
    recentSearches: "skycast-recent-searches"
};
const MAX_RECENT_SEARCHES = 5;

let units = localStorage.getItem(STORAGE_KEYS.units) || "metric";
let unitsDisplay = units === "imperial" ? "°F" : "°C";
let lastSearch = null;
let isLoading = false;

const searchInput = document.getElementById("search-input");
const countryInput = document.getElementById("country-input");
const searchBtn = document.getElementById("search-btn");
const locationBtn = document.getElementById("location-btn");
const unitsBtn = document.getElementById("units-btn");
const errorMessage = document.getElementById("error-message");
const statusMessage = document.getElementById("status-message");
const searchHistory = document.getElementById("search-history");
const currentWeatherSection = document.getElementById("current-weather");
const forecastCards = document.getElementById("forecast-cards");

updateUnitsButton();
renderRecentSearches();
renderInitialState();

if (!navigator.geolocation) {
    locationBtn.disabled = true;
    locationBtn.textContent = "Location unavailable";
}

searchBtn.addEventListener("click", function () {
    handleCitySearch();
});

locationBtn.addEventListener("click", function () {
    searchByLocation();
});

unitsBtn.addEventListener("click", function () {
    toggleUnits();
});

searchInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        event.preventDefault();
        handleCitySearch();
    }
});

countryInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        event.preventDefault();
        handleCitySearch();
    }
});

searchHistory.addEventListener("click", function (event) {
    const button = event.target.closest("button[data-city]");
    if (!button || isLoading) {
        return;
    }

    const city = button.dataset.city;
    const country = button.dataset.country;
    getWeather(city, country);
});

function updateUnitsButton() {
    unitsDisplay = units === "imperial" ? "°F" : "°C";
    unitsBtn.textContent = units === "metric" ? "Switch to °F" : "Switch to °C";
    unitsBtn.setAttribute("aria-pressed", units === "imperial");
}

function updateTheme(weatherMain) {
    const themeMap = {
        clear: "clear",
        clouds: "clouds",
        rain: "rain",
        drizzle: "rain",
        thunderstorm: "storm",
        snow: "snow",
        mist: "mist",
        haze: "mist",
        fog: "mist",
        smoke: "mist"
    };

    const theme = themeMap[String(weatherMain || "").toLowerCase()] || "default";
    document.body.dataset.weatherTheme = theme;
}

function renderInitialState() {
    updateTheme("");
    currentWeatherSection.innerHTML = `
        <div class="empty-state">
            <p class="eyebrow">Current weather</p>
            <h2>Search for a city or use your location</h2>
            <p>You'll see current conditions, humidity, wind, and a five-day forecast here.</p>
        </div>
    `;
    forecastCards.innerHTML = `
        <div class="forecast-card forecast-empty">
            <p class="forecast-date">Forecast waiting</p>
            <p class="forecast-desc">Choose a city or current location to fill these cards.</p>
        </div>
    `;
}

function setStatus(message) {
    statusMessage.textContent = message || "";
}

function setError(message) {
    errorMessage.textContent = message || "";
}

function setLoadingState(loading, message) {
    isLoading = loading;
    searchBtn.disabled = loading;
    locationBtn.disabled = loading || !navigator.geolocation;
    unitsBtn.disabled = loading;
    searchInput.disabled = loading;
    countryInput.disabled = loading;
    setStatus(loading ? message : "");
    if (loading) {
        setError("");
    }
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function buildLocationLabel(city, country) {
    return country ? `${city}, ${country}` : city;
}

function getRecentSearches() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.recentSearches);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        return [];
    }
}

function saveRecentSearch(city, country) {
    if (!city) {
        return;
    }

    const normalizedCity = city.trim();
    const normalizedCountry = (country || "").trim();
    const recentSearches = getRecentSearches();
    const id = `${normalizedCity.toLowerCase()}|${normalizedCountry.toLowerCase()}`;
    const nextSearches = recentSearches.filter(function (item) {
        return item.id !== id;
    });

    nextSearches.unshift({
        id,
        city: normalizedCity,
        country: normalizedCountry,
        label: buildLocationLabel(normalizedCity, normalizedCountry)
    });

    localStorage.setItem(STORAGE_KEYS.recentSearches, JSON.stringify(nextSearches.slice(0, MAX_RECENT_SEARCHES)));
    renderRecentSearches();
}

function renderRecentSearches() {
    const recentSearches = getRecentSearches();

    if (!recentSearches.length) {
        searchHistory.innerHTML = '<p class="history-empty">No recent searches yet.</p>';
        return;
    }

    searchHistory.innerHTML = recentSearches.map(function (item) {
        return `
            <button type="button" class="history-chip" data-city="${escapeHtml(item.city)}" data-country="${escapeHtml(item.country)}">
                ${escapeHtml(item.label)}
            </button>
        `;
    }).join("");
}

function handleCitySearch() {
    const city = searchInput.value.trim();
    const country = countryInput.value.trim();

    if (!city) {
        setError("Enter a city to search.");
        return;
    }

    getWeather(city, country);
}

async function fetchFromAPI(endpoint, params) {
    const url = new URL(`${BASE_URL}/${endpoint}`);
    url.searchParams.set("appid", API_KEY);
    url.searchParams.set("units", units);

    Object.entries(params || {}).forEach(function ([key, value]) {
        if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, value);
        }
    });

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Could not find that location. Try adding a country code like PH, US, or GB.");
    }

    return response.json();
}

async function loadWeather(params, locationLabel, options) {
    const searchOptions = options || {};
    const shouldSaveRecent = searchOptions.saveRecent !== false;

    setLoadingState(true, `Loading weather for ${locationLabel}...`);
    setError("");

    try {
        const [weatherData, forecastData] = await Promise.all([
            fetchFromAPI("weather", params),
            fetchFromAPI("forecast", params)
        ]);

        displayWeather(weatherData);
        displayForecast(getDailyForecasts(forecastData.list));

        const resolvedCountry = weatherData.sys && weatherData.sys.country ? weatherData.sys.country : "";
        const resolvedLabel = buildLocationLabel(weatherData.name, resolvedCountry);

        lastSearch = {
            params,
            label: resolvedLabel,
            type: searchOptions.type || "city"
        };

        if (shouldSaveRecent) {
            saveRecentSearch(weatherData.name, resolvedCountry);
        }

        setStatus(`Showing weather for ${resolvedLabel}`);

    } catch (error) {
        setError(error.message);
        renderInitialState();

    } finally {
        setLoadingState(false);
    }
}

async function getWeather(city, country, options) {
    const location = buildLocationLabel(city, country);
    return loadWeather({ q: location }, location, {
        type: "city",
        saveRecent: !options || options.saveRecent !== false
    });
}

function getCurrentPosition() {
    return new Promise(function (resolve, reject) {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 300000
        });
    });
}

async function searchByLocation() {
    if (!navigator.geolocation) {
        setError("Your browser does not support location access.");
        return;
    }

    setLoadingState(true, "Finding your location...");

    try {
        const position = await getCurrentPosition();
        return loadWeather({
            lat: position.coords.latitude,
            lon: position.coords.longitude
        }, "your location", {
            type: "coords"
        });

    } catch (error) {
        setLoadingState(false);
        setError("Location access was blocked or unavailable.");
    }
}

async function toggleUnits() {
    units = units === "metric" ? "imperial" : "metric";
    localStorage.setItem(STORAGE_KEYS.units, units);
    updateUnitsButton();

    if (!lastSearch) {
        return;
    }

    return loadWeather(lastSearch.params, lastSearch.label, {
        type: lastSearch.type,
        saveRecent: false
    });
}

function displayWeather(data) {
    const cityName = data.name;
    const country = data.sys.country;
    const temp = Math.round(data.main.temp);
    const feelsLike = Math.round(data.main.feels_like);
    const humidity = data.main.humidity;
    const windSpeed = data.wind.speed;
    const description = data.weather[0].description;
    const iconCode = data.weather[0].icon;
    const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;

    updateTheme(data.weather[0].main);

    currentWeatherSection.innerHTML = `
        <div class="weather-hero">
            <div class="weather-copy">
                <p class="eyebrow">Current weather</p>
                <h2 class="weather-title">${cityName}, ${country}</h2>
                <p class="weather-description">${description}</p>
            </div>
            <img src="${iconUrl}" alt="${description}">
        </div>
        <div class="weather-summary">
            <p class="temperature">${temp}${unitsDisplay}</p>
            <p class="feels-like">Feels like ${feelsLike}${unitsDisplay}</p>
        </div>
        <div class="weather-details">
            <div>
                <span>Humidity</span>
                <strong>${humidity}%</strong>
            </div>
            <div>
                <span>Wind</span>
                <strong>${windSpeed} m/s</strong>
            </div>
            <div>
                <span>Feels like</span>
                <strong>${feelsLike}${unitsDisplay}</strong>
            </div>
            <div>
                <span>Condition</span>
                <strong>${description}</strong>
            </div>
        </div>
    `;
}

function getDailyForecasts(list) {
    return list.filter(function (item) {
        return item.dt_txt.includes("12:00:00");
    });
}

function displayForecast(forecasts) {
    if (!forecasts.length) {
        forecastCards.innerHTML = `
            <div class="forecast-card forecast-empty">
                <p class="forecast-date">Forecast unavailable</p>
                <p class="forecast-desc">Try another search to load the five-day outlook.</p>
            </div>
        `;
        return;
    }

    forecastCards.innerHTML = forecasts.map(function (forecast) {
        const [datePart] = forecast.dt_txt.split(" ");
        const [year, month, day] = datePart.split("-");
        const date = new Date(year, month - 1, day);

        const dayLabel = date.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric"
        });

        const temp = Math.round(forecast.main.temp);
        const high = Math.round(forecast.main.temp_max);
        const low = Math.round(forecast.main.temp_min);
        const rainChance = Math.round((forecast.pop || 0) * 100);
        const description = forecast.weather[0].description;
        const iconCode = forecast.weather[0].icon;
        const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;

        return `
            <div class="forecast-card">
                <p class="forecast-date">${dayLabel}</p>
                <img src="${iconUrl}" alt="${description}">
                <p class="forecast-temp">${temp}${unitsDisplay}</p>
                <div class="forecast-range">
                    <span>H ${high}${unitsDisplay}</span>
                    <span>L ${low}${unitsDisplay}</span>
                </div>
                <p class="forecast-rain">${rainChance}% rain</p>
                <p class="forecast-desc">${description}</p>
            </div>
        `;
    }).join("");
}
