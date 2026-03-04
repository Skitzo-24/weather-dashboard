// Grab the HTML elements we need to interact with
const searchInput = document.getElementById("search-input");
const countryInput = document.getElementById("country-input");
const searchBtn = document.getElementById("search-btn");
const errorMessage = document.getElementById("error-message");

// Listen for a click on the Search button
searchBtn.addEventListener("click", function () {
    const city = searchInput.value.trim();
    const country = countryInput.value.trim();
    if (city) {
        getWeather(city, country);
    }
});

// Listen for the Enter key while typing in the input field
searchInput.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
        const city = searchInput.value.trim();
        const country = countryInput.value.trim();
        if (city) {
            getWeather(city, country);
        }
    }
});

// async means this function contains code that takes time to complete
async function getWeather(city, country) {
    // If a country code was provided, append it to the city: "San Jose Del Monte,PH"
    // Otherwise just use the city name alone
    const location = country ? `${city},${country}` : city;
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${API_KEY}&units=metric`;

    // Clear any previous error message before each new search
    errorMessage.textContent = "";

    try {
        const response = await fetch(url);

        if (!response.ok) {
            // Show the error on the page instead of a popup alert
            throw new Error("City not found. Try adding a country code (e.g. PH, US, GB).");
        }

        const data = await response.json();

        displayWeather(data);
        getForecast(location);

    } catch (error) {
        // textContent safely writes plain text into the #error-message div
        errorMessage.textContent = error.message;
    }
}

function displayWeather(data) {
    // Grab the section where we'll render current weather
    const weatherSection = document.getElementById("current-weather");

    // Pull out the values we need from the API response
    const cityName = data.name;
    const country = data.sys.country;
    const temp = Math.round(data.main.temp);
    const feelsLike = Math.round(data.main.feels_like);
    const humidity = data.main.humidity;
    const windSpeed = data.wind.speed;
    const description = data.weather[0].description;
    const iconCode = data.weather[0].icon;

    // OpenWeatherMap provides icon images - we build the URL using the icon code
    const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;

    // innerHTML lets us write HTML directly into a DOM element
    // We're building a string of HTML and stamping it into the page
    weatherSection.innerHTML = `
        <h2>${cityName}, ${country}</h2>
        <img src="${iconUrl}" alt="${description}">
        <p class="temperature">${temp}°C</p>
        <p class="description">${description}</p>
        <div class="weather-details">
            <p>Feels like: ${feelsLike}°C</p>
            <p>Humidity: ${humidity}%</p>
            <p>Wind: ${windSpeed} m/s</p>
        </div>
    `;
}

async function getForecast(city) {
    // This endpoint returns 40 data points - one every 3 hours for 5 days
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${API_KEY}&units=metric`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Forecast not available.");
        const data = await response.json();

        // data.list is the array of 40 forecasts
        // We filter it to only keep entries where the time is 12:00:00
        // This gives us one reading per day at midday
        const dailyForecasts = data.list.filter(item =>
            item.dt_txt.includes("12:00:00")
        );

        displayForecast(dailyForecasts);

    } catch (error) {
        console.error("Forecast error:", error.message);
    }
}

function displayForecast(forecasts) {
    const container = document.getElementById("forecast-cards");

    // Clear any previously displayed cards before rendering new ones
    container.innerHTML = "";

    forecasts.forEach(function (forecast) {
        // dt_txt looks like "2024-03-04 12:00:00" - we split on the space and take the date part
        const date = new Date(forecast.dt_txt.split(" ")[0]);

        // toLocaleDateString formats the date nicely e.g. "Mon, Mar 4"
        const dayLabel = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

        const temp = Math.round(forecast.main.temp);
        const description = forecast.weather[0].description;
        const iconCode = forecast.weather[0].icon;
        const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;

        // Create a div element in memory, fill it with HTML, then attach it to the page
        const card = document.createElement("div");
        card.classList.add("forecast-card");
        card.innerHTML = `
            <p class="forecast-date">${dayLabel}</p>
            <img src="${iconUrl}" alt="${description}">
            <p class="forecast-temp">${temp}°C</p>
            <p class="forecast-desc">${description}</p>
        `;

        // appendChild adds the card into the #forecast-cards container
        container.appendChild(card);
    });
}