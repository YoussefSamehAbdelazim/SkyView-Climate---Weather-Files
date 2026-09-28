# 🌍 SkyView Climate & Weather

> **Weather • Climate • Environmental Data • Education**

SkyView Climate & Weather is a web-based platform that combines
real-time weather information with historical climate data and
interactive visualizations.

The project was designed to make weather and climate data easier to
understand by connecting:

**DATA → ANALYSIS → VISUALIZATION → EDUCATION → AWARENESS**

------------------------------------------------------------------------

## 🚀 Project Overview

SkyView Climate & Weather provides users with two complementary
experiences:

-   **Weather:** current conditions and short-term forecasts.
-   **Climate:** historical data analysis, yearly comparisons, trends,
    and educational explanations.

The goal is not only to display numbers, but also to help users
understand what the data means and how weather differs from long-term
climate patterns.

------------------------------------------------------------------------

## ✨ Main Features

### 🌤️ Weather

-   Current weather conditions
-   Hourly forecast
-   Daily forecast
-   Temperature and feels-like temperature
-   Humidity
-   Wind speed and direction
-   Atmospheric pressure
-   Visibility
-   UV index
-   Air quality when available
-   City and location search
-   Browser-based geolocation
-   Favorite cities
-   Temperature unit switching
-   Theme support
-   Simple Weather View for users who want the essential weather data
    without the full analysis interface

### 📊 Climate Center

The Climate Center provides historical climate analysis for a selected
location.

It supports:

-   5, 10, and 20-year historical periods
-   Annual average temperature
-   Annual rainfall totals
-   Maximum and minimum temperatures
-   Extreme heat-day analysis
-   Hottest and coolest years
-   Wettest and driest years
-   Monthly climate patterns
-   Historical temperature trend analysis when enough data is available
-   Comparison between up to three years
-   Interactive charts
-   Explanations of what the charts mean
-   Weather vs. Climate educational content
-   Climate impacts and awareness sections
-   Technology and climate information
-   Data, methodology, and source documentation

------------------------------------------------------------------------

## 🧠 Weather vs. Climate

One of the main educational goals of the project is to make the
difference between weather and climate clear.

**Weather** describes short-term atmospheric conditions, such as today's
temperature, rain, wind, and humidity.

**Climate** describes patterns in weather over much longer periods.

Therefore, a single hot or cold day is not treated as proof of a
long-term climate trend. The Climate Center uses multiple years of data
to provide a broader historical view.

------------------------------------------------------------------------

## 🔌 APIs & Data Sources

SkyView Climate & Weather uses different services for different types of
data.

### WeatherAPI

Used for:

-   Current weather
-   Forecast data
-   Air quality when available

### OpenCage Geocoding

Used to convert location information between names and geographic
coordinates when needed.

### Open-Meteo / ERA5 Reanalysis

Used by the Climate Center for historical daily weather data.

The historical climate analysis uses ERA5 reanalysis data through
Open-Meteo. This data represents a modeled/reanalyzed view of past
atmospheric conditions and should not be interpreted as a direct
weather-station measurement for every individual location.

### Browser Geolocation API

Used to request the user's location through the browser when the user
chooses the location feature.

The browser provides latitude and longitude coordinates, which are then
used to retrieve weather and climate information for that location.

------------------------------------------------------------------------

## 🏗️ How the Project Works

The general data flow is:

``` text
User
  ↓
SkyView Climate & Weather
  ↓
Frontend JavaScript
  ↓
Serverless API Route
  ↓
External Data Service
  ↓
JSON Response
  ↓
Analysis / Processing
  ↓
Charts & User Interface
```

For example, when the user searches for a city:

``` text
City Search
    ↓
Geocoding
    ↓
Latitude / Longitude
    ↓
Weather or Climate API
    ↓
Data Processing
    ↓
SkyView Interface
```

For browser location:

``` text
Browser Geolocation API
    ↓
Latitude + Longitude
    ↓
SkyView API Route
    ↓
Weather / Climate Data
    ↓
User Interface
```

------------------------------------------------------------------------

## 🔐 API Security

External API credentials are not placed directly in the public frontend
code.

Sensitive API keys are stored as environment variables and accessed by
server-side/serverless API routes.

This architecture helps prevent exposing private API credentials to
users through the browser.

The project also uses server-side protections such as:

-   Input validation
-   Rate limiting
-   Response caching
-   Request timeouts
-   Error handling

------------------------------------------------------------------------

## ⚡ Caching & Performance

The project uses caching to reduce unnecessary requests to external
services.

When appropriate, recently requested data can be reused for a limited
period instead of requesting the same data again immediately.

This can:

-   Reduce external API usage
-   Improve response speed
-   Reduce unnecessary network requests
-   Provide a smoother user experience

Caching is temporary and should not be confused with permanent data
storage.

------------------------------------------------------------------------

## 📈 Climate Analysis Methodology

The Climate Center processes daily historical data and groups it by year
and month.

The analysis can calculate values such as:

-   Annual average temperature
-   Annual precipitation
-   Maximum and minimum temperature
-   Number of days reaching the configured extreme-heat threshold
-   Hottest year
-   Coolest year
-   Wettest year
-   Driest year
-   Monthly patterns
-   A simple linear temperature trend when enough annual data is
    available

The current extreme-heat analysis uses a threshold of **35°C**.

The temperature trend is a simple statistical description of the
available annual data. It is not a future forecast and does not by
itself establish causation.

------------------------------------------------------------------------

## ⚠️ Limitations

SkyView Climate & Weather is an educational and informational project.

Important limitations include:

-   Weather forecasts can change as new observations become available.
-   Historical reanalysis data is not identical to direct measurements
    from a weather station at every location.
-   A single weather event cannot establish a long-term climate trend.
-   A simple trend line does not prove the cause of a climate change.
-   Data availability can vary depending on the selected location and
    external service.
-   Air-quality information may not always be available.
-   Internet access is required for live data and external API requests.

------------------------------------------------------------------------

## 🛠️ Technologies

The project is built using:

-   HTML5
-   CSS3
-   Vanilla JavaScript
-   Chart.js
-   WeatherAPI
-   OpenCage Geocoding
-   Open-Meteo
-   ERA5 Reanalysis
-   Browser Geolocation API
-   Serverless API Routes
-   Vercel

No frontend framework is required.

------------------------------------------------------------------------

## 📁 Project Structure

``` text
SkyView-Climate-Weather/
│
├── index.html
├── sample.html
├── site.webmanifest
├── README.md
├── USAGE-MANUAL.md
├── LICENCE
│
├── css/
│   ├── main.css
│   ├── components.css
│   ├── responsive.css
│   └── themes.css
│
├── js/
│   ├── app.js
│   ├── ui.js
│   ├── weather.js
│   └── climate.js
│
├── api/
│   ├── weather.js
│   ├── geocode.js
│   └── climate.js
│
└── assets / icons / manifest files
```

------------------------------------------------------------------------

## 🖥️ Running the Project

The project can be deployed using a platform that supports serverless
API routes, such as Vercel.

Environment variables should be configured on the deployment platform.

Example variables:

``` text
WEATHER_API_KEY=your_weather_api_key
OPENCAGE_API_KEY=your_opencage_api_key
```

Never publish real API keys inside the frontend source code or commit
them to a public repository.

------------------------------------------------------------------------

## 📚 Documentation

For a more detailed explanation of how to use the project and understand
its data flow, see:

**USAGE-MANUAL.md**

The manual covers:

-   Project idea
-   Goals
-   Requirements
-   Technologies
-   Data sources
-   Weather features
-   Climate Center
-   Charts
-   Year comparison
-   Weather vs. Climate
-   Geolocation
-   Search
-   Methodology
-   Limitations
-   Project structure

------------------------------------------------------------------------

## 🎯 Project Goals

The project aims to:

1.  Make weather information easy to access.
2.  Present climate data in a simple visual form.
3.  Help users understand the difference between weather and climate.
4.  Encourage data literacy and environmental awareness.
5.  Demonstrate how APIs, geolocation, serverless functions, data
    processing, and visualization can work together in one web
    application.

------------------------------------------------------------------------

## 🔮 Future Development

Possible future improvements include:

-   More environmental datasets
-   Additional historical indicators
-   More advanced comparisons
-   Improved accessibility
-   Progressive Web App capabilities
-   Offline support for cached application resources
-   Additional educational content
-   Integration with other environmental data sources

These features are considered future development and are not required
for the current version.

------------------------------------------------------------------------

## 👨‍💻 Developer

**Developed by Youssef Sameh**

**Project:** SkyView Climate & Weather

The project was created as a practical web development and
environmental-data project, combining software development with data
analysis and climate education.

------------------------------------------------------------------------

## 📄 License

This project is distributed under the license included in the
repository.

See `LICENCE` for details.

------------------------------------------------------------------------

## 🌍 Project Message

> **Data becomes more valuable when people can understand it.**

SkyView Climate & Weather aims to turn weather and climate data into
information that is easier to explore, understand, and learn from.
