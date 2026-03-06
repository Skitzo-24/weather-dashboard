// ============================================================
// CONSTANTS - One place to change global values
// ============================================================
const BASE_URL = "https://api.openweathermap.org/data/2.5";
const UNITS = "metric";
const UNITS_DISPLAY = "°C"; // Change to "°F" if you switch UNITS to "imperial"

// ============================================================
// DOM ELEMENTS - Grab HTML elements once, reuse everywhere
// ============================================================
const searchInput = document.getElementById("search-input");
const countryInput = document.getElementById("country-input");
const searchBtn = document.getElementById("search-btn");
const errorMessage = document.getElementById("error-message");

// ============================================================
// EVENT LISTENERS - Listen for user interaction
// ============================================================

searchBtn.addEventListener("click", function () {
    const city = searchInput.value.trim();
    const country = countryInput.value.trim();
    if (city) {
        getWeather(city, country);
    }
});

searchInput.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
        const city = searchInput.value.trim();
        const country = countryInput.value.trim();
        if (city) {
            getWeather(city, country);
        }
    }
});

// ============================================================
// THE WAITER - One function that handles ALL API calls
// Input door:  endpoint ("weather" or "forecast"), location ("London,GB")
// Output door: the parsed data object from the API
// ============================================================
async function fetchFromAPI(endpoint, location) {
    // Builds the full URL using our constants - no magic strings
    const url = `${BASE_URL}/${endpoint}?q=${location}&appid=${API_KEY}&units=${UNITS}`;
    const response = await fetch(url);

    // If the API says something went wrong, throw an error immediately
    // This stops execution and jumps to the nearest catch() block
    if (!response.ok) {
        throw new Error(`Could not find "${location}". Try adding a country code (e.g. PH, US, GB).`);
    }

    // return hands the data back to whoever called this function
    return response.json();
}

// ============================================================
// COORDINATOR - Manages the full search flow
// ============================================================
async function getWeather(city, country) {
    const location = country ? `${city},${country}` : city;

    // Clear any previous error before each new search
    errorMessage.textContent = "";

    try {
        // fetchFromAPI does the fetch work - getWeather just receives the result
        const data = await fetchFromAPI("weather", location);
        displayWeather(data);

        // getForecast now uses the same waiter with a different endpoint
        getForecast(location);

    } catch (error) {
        errorMessage.textContent = error.message;
    }
}

// ============================================================
// DISPLAY - Renders current weather into the page
// ============================================================
function displayWeather(data) {
    const weatherSection = document.getElementById("current-weather");

    const cityName = data.name;
    const country = data.sys.country;
    const temp = Math.round(data.main.temp);
    const feelsLike = Math.round(data.main.feels_like);
    const humidity = data.main.humidity;
    const windSpeed = data.wind.speed;
    const description = data.weather[0].description;
    const iconCode = data.weather[0].icon;
    const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;

    // UNITS_DISPLAY means we only define "°C" in one place at the top
    weatherSection.innerHTML = `
        <h2>${cityName}, ${country}</h2>
        <img src="${iconUrl}" alt="${description}">
        <p class="temperature">${temp}${UNITS_DISPLAY}</p>
        <p class="description">${description}</p>
        <div class="weather-details">
            <p>Feels like: ${feelsLike}${UNITS_DISPLAY}</p>
            <p>Humidity: ${humidity}%</p>
            <p>Wind: ${windSpeed} m/s</p>
        </div>
    `;
}

// ============================================================
// FORECAST FETCH - Uses the same waiter as getWeather
// ============================================================
async function getForecast(location) {
    try {
        const data = await fetchFromAPI("forecast", location);

        // data.list has 40 entries (every 3 hours for 5 days)
        // We keep only the 12:00:00 entry per day - one clean daily snapshot
        const dailyForecasts = data.list.filter(item =>
            item.dt_txt.includes("12:00:00")
        );

        displayForecast(dailyForecasts);

    } catch (error) {
        // Now shows on the page instead of silently disappearing into the console
        errorMessage.textContent = "Forecast unavailable. Please try again.";
    }
}

// ============================================================
// FORECAST DISPLAY - Builds and renders one card per day
// ============================================================
function displayForecast(forecasts) {
    const container = document.getElementById("forecast-cards");
    container.innerHTML = "";

    forecasts.forEach(function (forecast) {
        // FIX: Split the date parts manually to avoid a timezone bug
        // new Date("2026-03-06") is read as UTC midnight, which shifts
        // the date backward by one day for anyone in a UTC+ timezone (like PH = UTC+8)
        // new Date(year, month - 1, day) creates a LOCAL date instead
        const [datePart] = forecast.dt_txt.split(" ");
        const [year, month, day] = datePart.split("-");
        const date = new Date(year, month - 1, day);

        const dayLabel = date.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric"
        });

        const temp = Math.round(forecast.main.temp);
        const description = forecast.weather[0].description;
        const iconCode = forecast.weather[0].icon;
        const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;

        const card = document.createElement("div");
        card.classList.add("forecast-card");
        card.innerHTML = `
            <p class="forecast-date">${dayLabel}</p>
            <img src="${iconUrl}" alt="${description}">
            <p class="forecast-temp">${temp}${UNITS_DISPLAY}</p>
            <p class="forecast-desc">${description}</p>
        `;

        container.appendChild(card);
    });
}
