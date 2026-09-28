

const UI = {

  state: {
    isCelsius: true,          
    currentData: null,        
    clockInterval: null,      
    particlesInterval: null,  
    lastBgClass: '',          
  },

  init() {

    this.startLiveClock();
    console.log('🎨 تم تهيئة واجهة المستخدم');
  },

  updatePreloader(progress, message) {
    const progressBar = document.getElementById('preloaderProgress');
    const percentText = document.getElementById('preloaderPercent');
    const subtitle = document.querySelector('.preloader-subtitle');

    if (progressBar) progressBar.style.width = `${progress}%`;
    if (percentText) percentText.textContent = `${progress}%`;
    if (subtitle && message) subtitle.textContent = message;
  },

  hidePreloader(callback) {
    const preloader = document.getElementById('preloader');
    const mainContent = document.getElementById('mainContent');

    if (preloader) {

      preloader.classList.add('hide');

      if (mainContent) {
        mainContent.classList.remove('hidden');
        mainContent.style.animation = 'fadeIn 0.5s ease';
      }

      setTimeout(() => {
        preloader.style.display = 'none';
        if (callback) callback();
      }, 800);
    }
  },

  updateWeatherDisplay(data, isCelsius = true) {

    this.state.currentData = data;
    this.state.isCelsius = isCelsius;

    const { location, current, forecast } = data;
    const today = forecast.forecastday[0];

    this.updateLocationInfo(location);

    this.updateTemperature(current, today, isCelsius);

    this.updateWeatherIcon(current.condition.code, current.is_day);

    this.updateStats(current);

    this.updateSunTimes(today.astro, current);

    this.updateHourlyForecast(today.hour, isCelsius);
    this.updateWeatherCharts(today.hour, isCelsius);

    this.updateDailyForecast(forecast.forecastday, isCelsius);

    this.updateWeatherTip(current);

    this.updateAirQuality(current.air_quality);



    if (window.ClimateCenter) {
      window.ClimateCenter.loadForLocation(location, current.air_quality);
    }

    this.updateAstroInfo(today.astro);

    this.updateLastRefreshTime();

    this.applyContentAnimation();

    console.log('✅ تم تحديث واجهة المستخدم بالكامل');
  },

  updateLocationInfo(location) {
    const cityName = document.getElementById('cityName');
    const countryName = document.getElementById('countryName');

    if (cityName) {
      cityName.textContent = location.name;

      cityName.style.animation = 'none';
      cityName.offsetHeight; 
      cityName.style.animation = 'fadeInUp 0.4s ease';
    }

    if (countryName) {

      const region = location.region ? `${location.region}, ` : '';
      countryName.textContent = `${region}${location.country}`;
    }
  },

  updateTemperature(current, today, isCelsius) {

    const temp = isCelsius ? Math.round(current.temp_c) : Math.round(current.temp_f);
    const feelsLike = isCelsius ? Math.round(current.feelslike_c) : Math.round(current.feelslike_f);
    const high = isCelsius ? Math.round(today.day.maxtemp_c) : Math.round(today.day.maxtemp_f);
    const low = isCelsius ? Math.round(today.day.mintemp_c) : Math.round(today.day.mintemp_f);

    const unit = isCelsius ? '°C' : '°F';

    this.setElementText('tempValue', temp);
    this.setElementText('feelsLike', feelsLike);
    this.setElementText('tempHigh', high);
    this.setElementText('tempLow', low);
    this.setElementText('weatherDesc', current.condition.text);

    const tempUnitEl = document.querySelector('.temp-unit');
    if (tempUnitEl) tempUnitEl.textContent = unit;

    const precipMM = today.day.totalprecip_mm || 0;
    this.setElementText('precipitation', `${precipMM} مم`);

    const dewPoint = isCelsius ? current.dewpoint_c : current.dewpoint_f;
    this.setElementText('dewPoint', dewPoint ? `${Math.round(dewPoint)}°` : '--°');
  },

  updateWeatherIcon(conditionCode, isDay) {

    const iconInfo = WeatherHelpers.getWeatherIcon(conditionCode, isDay === 1);

    const mainIcon = document.getElementById('mainWeatherIcon');
    if (mainIcon) {
      mainIcon.className = `fas ${iconInfo.icon} weather-main-icon`;
      mainIcon.style.color = iconInfo.color;
      mainIcon.style.filter = `drop-shadow(0 8px 20px ${iconInfo.color}60)`;
    }

    this.updateBackground(iconInfo.bgClass, isDay === 1);

    this.updateParticles(iconInfo.bgClass, isDay === 1);
  },

  updateBackground(bgClass, isDay) {
    const weatherBg = document.getElementById('weatherBg');
    if (!weatherBg) return;

    if (this.state.lastBgClass) {
      weatherBg.classList.remove(this.state.lastBgClass);
    }

    let finalClass = bgClass;

    if (!isDay) {
      if (bgClass === 'sunny') finalClass = 'night-clear';
      else if (bgClass === 'partly-cloudy') finalClass = 'night';
      else if (!['stormy', 'rainy', 'snowy', 'foggy', 'cloudy'].includes(bgClass)) {
        finalClass = 'night';
      }
    }

    weatherBg.classList.add(finalClass);
    this.state.lastBgClass = finalClass;

    const overlay = document.getElementById('bgOverlay');
    if (overlay) {
      overlay.style.background = isDay
        ? 'rgba(0, 0, 0, 0.15)'  
        : 'rgba(0, 0, 0, 0.3)';  
    }
  },

  updateStats(current) {

    const humidity = current.humidity;
    this.setElementText('humidity', `${humidity}%`);

    const humidityBar = document.getElementById('humidityBar');
    if (humidityBar) humidityBar.style.width = `${humidity}%`;

    const windKph = Math.round(current.wind_kph);
    this.setElementText('windSpeed', `${windKph} كم/س`);

    const windDirText = WeatherHelpers.getWindDirection(current.wind_dir);
    this.setElementText('windDir', windDirText);

    const windArrow = document.getElementById('windArrow');
    if (windArrow) {
      const degree = WeatherHelpers.getWindArrowDegree(current.wind_dir);
      windArrow.style.transform = `rotate(${degree}deg)`;
    }

    const pressure = current.pressure_mb;
    this.setElementText('pressure', `${pressure} hPa`);

    const pressureInfo = WeatherHelpers.getPressureStatus(pressure);
    const pressureStatus = document.getElementById('pressureStatus');
    if (pressureStatus) {
      pressureStatus.textContent = pressureInfo.label;
      pressureStatus.className = `pressure-status ${pressureInfo.class}`;
    }

    const visibility = current.vis_km;
    this.setElementText('visibility', `${visibility} كم`);

    const uv = current.uv;
    this.setElementText('uvIndex', uv);
    const uvInfo = WeatherHelpers.getUVLevel(uv);
    const uvLevel = document.getElementById('uvLevel');
    if (uvLevel) {
      uvLevel.textContent = uvInfo.label;
      uvLevel.className = `uv-level ${uvInfo.class}`;
    }

    const cloud = current.cloud;
    this.setElementText('cloudCover', `${cloud}%`);
  },

  updateSunTimes(astro, current) {

    const sunriseFormatted = WeatherHelpers.formatTime(astro.sunrise);
    const sunsetFormatted = WeatherHelpers.formatTime(astro.sunset);

    this.setElementText('sunrise', sunriseFormatted);
    this.setElementText('sunset', sunsetFormatted);

    const sunPosition = WeatherHelpers.getSunPosition(astro.sunrise, astro.sunset);
    const sunDot = document.getElementById('sunDot');
    if (sunDot) {

      sunDot.style.left = `${sunPosition}%`;
    }
  },

  updateHourlyForecast(hours, isCelsius) {
    const container = document.getElementById('hourlyContainer');
    if (!container) return;

    container.innerHTML = '';

    const currentHour = new Date().getHours();

    hours.forEach((hour, index) => {

      const hourDate = new Date(hour.time);
      const hourNum = hourDate.getHours();

      const temp = isCelsius ? Math.round(hour.temp_c) : Math.round(hour.temp_f);

      const iconInfo = WeatherHelpers.getWeatherIcon(hour.condition.code, hour.is_day);

      const timeLabel = hourNum === 0 ? '12 ص' :
                        hourNum < 12 ? `${hourNum} ص` :
                        hourNum === 12 ? '12 م' :
                        `${hourNum - 12} م`;

      const card = document.createElement('div');
      card.className = `hourly-card ${hourNum === currentHour ? 'current-hour' : ''}`;
      card.setAttribute('role', 'listitem');
      card.setAttribute('aria-label', `الساعة ${timeLabel}: ${temp}°`);

      card.innerHTML = `
        <span class="hourly-time">${hourNum === currentHour ? 'الآن' : timeLabel}</span>
        <span class="hourly-icon">${iconInfo.emoji}</span>
        <span class="hourly-temp">${temp}°</span>
        ${hour.chance_of_rain > 0 ? `
          <span class="hourly-precip">
            <i class="fas fa-droplet" aria-hidden="true"></i>
            ${hour.chance_of_rain}%
          </span>
        ` : ''}
      `;

      container.appendChild(card);
    });
  },

  updateWeatherCharts(hours, isCelsius) {
    const canvas = document.getElementById('weatherChart');
    if (!canvas || typeof Chart === 'undefined' || !Array.isArray(hours) || !hours.length) return;

    const chartConfigs = {
      temperature: {
        title: 'تغير الحرارة',
        unit: isCelsius ? '°C' : '°F',
        icon: '🌡️',
        color: '#667eea',
        values: hours.map(hour => isCelsius ? Number(hour.temp_c) : Number(hour.temp_f)),
        summary: 'درجة الحرارة المتوقعة خلال ساعات اليوم.'
      },
      humidity: {
        title: 'تغير الرطوبة',
        unit: '%',
        icon: '💧',
        color: '#4facfe',
        values: hours.map(hour => Number(hour.humidity)),
        summary: 'نسبة الرطوبة المتوقعة خلال ساعات اليوم.'
      },
      wind: {
        title: 'سرعة الرياح',
        unit: 'كم/س',
        icon: '💨',
        color: '#10b981',
        values: hours.map(hour => Number(hour.wind_kph)),
        summary: 'سرعة الرياح المتوقعة خلال ساعات اليوم.'
      }
    };

    const config = chartConfigs[this.state.chartType] || chartConfigs.temperature;
    const labels = hours.map(hour => {
      const date = new Date(hour.time);
      const h = date.getHours();
      return h === 0 ? '12 ص' : h < 12 ? `${h} ص` : h === 12 ? '12 م' : `${h - 12} م`;
    });

    const values = config.values.filter(Number.isFinite);
    if (!values.length) return;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    const current = config.values[0];

    this.setElementText('activeChartTitle', config.title);
    this.setElementText('activeChartUnit', config.unit);
    this.setElementText('chartSummaryIcon', config.icon);
    this.setElementText('chartSummaryTitle', config.title);
    this.setElementText('chartSummaryValue', Number.isFinite(current) ? `${Math.round(current)} ${config.unit}` : '--');
    this.setElementText('chartMax', `${Math.round(max)} ${config.unit}`);
    this.setElementText('chartMin', `${Math.round(min)} ${config.unit}`);
    this.setElementText('chartAvg', `${Math.round(avg)} ${config.unit}`);
    this.setElementText('chartSummaryText', config.summary);

    if (this.state.weatherChart) {
      this.state.weatherChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 320);
    gradient.addColorStop(0, `${config.color}55`);
    gradient.addColorStop(1, `${config.color}00`);

    this.state.weatherChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: config.title,
          data: config.values,
          borderColor: config.color,
          backgroundColor: gradient,
          borderWidth: 3,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: config.color,
          pointBorderWidth: 0,
          fill: true,
          tension: 0.38
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            rtl: true,
            displayColors: false,
            callbacks: {
              label: context => `${context.parsed.y} ${config.unit}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxTicksLimit: 8, font: { family: 'Cairo' } }
          },
          y: {
            beginAtZero: this.state.chartType === 'humidity',
            suggestedMin: this.state.chartType === 'humidity' ? 0 : undefined,
            suggestedMax: this.state.chartType === 'humidity' ? 100 : undefined,
            grid: { color: 'rgba(102, 126, 234, 0.10)' },
            ticks: {
              font: { family: 'Cairo' },
              callback: value => `${value}${config.unit === '%' ? '%' : ''}`
            }
          }
        }
      }
    });
  },

  setChartType(type) {
    if (!['temperature', 'humidity', 'wind'].includes(type)) return;
    this.state.chartType = type;

    document.querySelectorAll('.chart-tab').forEach(button => {
      button.classList.toggle('active', button.dataset.chart === type);
    });

    const data = this.state.currentData;
    if (data?.forecast?.forecastday?.[0]?.hour) {
      this.updateWeatherCharts(data.forecast.forecastday[0].hour, this.state.isCelsius);
    }
  },

  updateDailyForecast(forecastDays, isCelsius) {
    const grid = document.getElementById('forecastGrid');
    if (!grid) return;

    grid.innerHTML = '';

    const today = new Date().toDateString();

    forecastDays.forEach((day, index) => {
      const dayDate = new Date(day.date);
      const isToday = dayDate.toDateString() === today;

      const dayName = isToday ? 'اليوم' : WeatherHelpers.getDayName(day.date);
      const dateFormatted = WeatherHelpers.formatDate(day.date);

      const high = isCelsius ? Math.round(day.day.maxtemp_c) : Math.round(day.day.maxtemp_f);
      const low = isCelsius ? Math.round(day.day.mintemp_c) : Math.round(day.day.mintemp_f);

      const iconInfo = WeatherHelpers.getWeatherIcon(day.day.condition.code, true);

      const rainChance = day.day.daily_chance_of_rain;

      const tempRange = high - low;
      const barWidth = Math.max(20, Math.min(100, (tempRange / 20) * 100));

      const card = document.createElement('div');
      card.className = `forecast-card ${isToday ? 'today' : ''}`;
      card.setAttribute('role', 'listitem');
      card.setAttribute('aria-label', `${dayName}: أعلى ${high}° أدنى ${low}°`);

      card.innerHTML = `
        <span class="forecast-day">${dayName}</span>
        <span class="forecast-date">${dateFormatted}</span>
        <span class="forecast-icon">${iconInfo.emoji}</span>
        <span class="forecast-desc">${day.day.condition.text}</span>
        <div class="forecast-temps">
          <span class="forecast-high">${high}°</span>
          <div class="forecast-temp-bar">
            <div class="forecast-temp-bar-fill" style="width: ${barWidth}%"></div>
          </div>
          <span class="forecast-low">${low}°</span>
        </div>
        ${rainChance > 0 ? `
          <span class="forecast-rain-chance">
            <i class="fas fa-droplet" aria-hidden="true"></i>
            ${rainChance}%
          </span>
        ` : ''}
      `;

      grid.appendChild(card);
    });
  },

  updateWeatherTip(current) {
    const tipText = document.getElementById('tipText');
    const tipIcon = document.getElementById('tipIcon');

    const tip = WeatherHelpers.getWeatherTip(
      current.condition.code,
      current.temp_c,
      current.humidity,
      current.uv
    );

    if (tipText) {
      tipText.textContent = tip.tip;
      tipText.style.animation = 'none';
      tipText.offsetHeight;
      tipText.style.animation = 'fadeIn 0.5s ease';
    }
    if (tipIcon) tipIcon.textContent = tip.emoji;
  },

  updateAirQuality(airQuality) {
    const aqValue = document.getElementById('aqValue');
    const aqLabel = document.getElementById('aqLabel');
    const aqBar = document.getElementById('aqBar');

    if (!airQuality) {

      if (aqValue) aqValue.textContent = '--';
      if (aqLabel) aqLabel.textContent = 'غير متاح';
      return;
    }

    const aqiValue = airQuality['us-epa-index'];
    const aqInfo = WeatherHelpers.getAirQuality(aqiValue);

    if (aqValue) {
      aqValue.textContent = aqiValue || '--';
      aqValue.style.color = aqInfo.color;
    }
    if (aqLabel) aqLabel.textContent = aqInfo.label;
    if (aqBar) {
      aqBar.style.width = `${aqInfo.percentage}%`;
      aqBar.style.background = `linear-gradient(90deg, #10b981, ${aqInfo.color})`;
    }
  },

  updateAstroInfo(astro) {

    const moonriseTime = WeatherHelpers.formatTime(astro.moonrise);
    const moonsetTime = WeatherHelpers.formatTime(astro.moonset);

    this.setElementText('moonrise', moonriseTime);
    this.setElementText('moonset', moonsetTime);

    const moonPhaseInfo = WeatherHelpers.getMoonPhase(astro.moon_phase);
    this.setElementText('moonPhase', moonPhaseInfo.name);
    this.setElementText('moonPhaseIcon', moonPhaseInfo.emoji);
  },

  updateLastRefreshTime() {
    const lastUpdate = document.getElementById('lastUpdate');
    if (lastUpdate) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit'
      });
      lastUpdate.textContent = timeStr;
    }
  },

  updateParticles(bgClass, isDay) {
    const particlesContainer = document.getElementById('bgParticles');
    if (!particlesContainer) return;

    particlesContainer.innerHTML = '';

    setTimeout(() => {
      switch (bgClass) {
        case 'rainy':
        case 'stormy':

          this.createRainParticles(particlesContainer, bgClass === 'stormy' ? 60 : 40);
          if (bgClass === 'stormy') {

            const lightning = document.createElement('div');
            lightning.className = 'lightning-flash';
            particlesContainer.appendChild(lightning);
          }
          break;

        case 'snowy':

          this.createSnowParticles(particlesContainer, 30);
          break;

        case 'night-clear':
        case 'night':

          this.createStarParticles(particlesContainer, 60);
          break;

        case 'cloudy':
        case 'partly-cloudy':
        case 'foggy':

          this.createCloudParticles(particlesContainer, 5);
          break;

        default:

          if (!isDay) {
            this.createStarParticles(particlesContainer, 40);
          }
          break;
      }
    }, 500);
  },

  createRainParticles(container, count) {
    for (let i = 0; i < count; i++) {
      const drop = document.createElement('div');
      drop.className = 'rain-particle';

      const left = Math.random() * 100; 
      const duration = 0.5 + Math.random() * 0.8; 
      const delay = Math.random() * 2; 
      const height = 15 + Math.random() * 25; 
      const opacity = 0.4 + Math.random() * 0.4; 

      drop.style.cssText = `
        left: ${left}%;
        height: ${height}px;
        animation-duration: ${duration}s;
        animation-delay: -${delay}s;
        opacity: ${opacity};
        top: 0;
      `;

      container.appendChild(drop);
    }
  },

  createSnowParticles(container, count) {
    for (let i = 0; i < count; i++) {
      const flake = document.createElement('div');
      flake.className = 'snow-particle';

      const left = Math.random() * 100;
      const size = 3 + Math.random() * 6; 
      const duration = 3 + Math.random() * 5; 
      const delay = Math.random() * 5;

      flake.style.cssText = `
        left: ${left}%;
        width: ${size}px;
        height: ${size}px;
        animation-duration: ${duration}s;
        animation-delay: -${delay}s;
        top: 0;
      `;

      container.appendChild(flake);
    }
  },

  createStarParticles(container, count) {
    for (let i = 0; i < count; i++) {
      const star = document.createElement('div');
      star.className = 'star-particle';

      const left = Math.random() * 100;
      const top = Math.random() * 80; 
      const size = 1 + Math.random() * 3; 
      const duration = 1.5 + Math.random() * 3; 
      const delay = Math.random() * 3;

      star.style.cssText = `
        left: ${left}%;
        top: ${top}%;
        width: ${size}px;
        height: ${size}px;
        animation-duration: ${duration}s;
        animation-delay: -${delay}s;
      `;

      container.appendChild(star);
    }
  },

  createCloudParticles(container, count) {
    for (let i = 0; i < count; i++) {
      const cloud = document.createElement('div');
      cloud.className = 'cloud-particle';

      const top = 10 + Math.random() * 50;
      const width = 150 + Math.random() * 200;
      const height = 60 + Math.random() * 60;
      const duration = 25 + Math.random() * 40; 
      const delay = Math.random() * 20;

      cloud.style.cssText = `
        top: ${top}%;
        left: -${width}px;
        width: ${width}px;
        height: ${height}px;
        animation-duration: ${duration}s;
        animation-delay: -${delay}s;
      `;

      container.appendChild(cloud);
    }
  },

  showError(title, message) {
    const errorDiv = document.getElementById('errorMessage');
    const errorTitle = document.getElementById('errorTitle');
    const errorDesc = document.getElementById('errorDesc');

    if (errorTitle) errorTitle.textContent = title;
    if (errorDesc) errorDesc.textContent = message;
    if (errorDiv) {
      errorDiv.classList.remove('hidden');

      setTimeout(() => this.hideError(), 6000);
    }
  },

  hideError() {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) errorDiv.classList.add('hidden');
  },

  startLiveClock() {

    this.updateClock();

    this.state.clockInterval = setInterval(() => {
      this.updateClock();
    }, 1000);
  },

  updateClock() {
    const now = new Date();

    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');

    const timeEl = document.getElementById('currentTime');
    if (timeEl) timeEl.textContent = `${hours}:${minutes}:${seconds}`;

    const dateOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };

    const dateStr = now.toLocaleDateString('ar-EG', dateOptions);
    const dateEl = document.getElementById('currentDate');
    if (dateEl) dateEl.textContent = dateStr;
  },

  applyContentAnimation() {
    const animatedElements = [
      '.weather-main-card',
      '.hourly-section',
      '.forecast-section',
      '.info-section'
    ];

    animatedElements.forEach((selector, index) => {
      const el = document.querySelector(selector);
      if (el) {
        el.style.animation = 'none';
        el.offsetHeight; 
        el.style.animation = `fadeInUp 0.5s ease ${index * 0.1}s both`;
      }
    });
  },

  setLoadingState(isLoading) {
    const searchBtn = document.getElementById('searchBtn');
    const locationBtn = document.getElementById('locationBtn');

    if (isLoading) {
      if (searchBtn) {
        searchBtn.disabled = true;
        searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>جارٍ...</span>';
      }
      if (locationBtn) {
        locationBtn.disabled = true;
        locationBtn.classList.add('loading');
      }
    } else {
      if (searchBtn) {
        searchBtn.disabled = false;
        searchBtn.innerHTML = '<i class="fas fa-search"></i> <span>بحث</span>';
      }
      if (locationBtn) {
        locationBtn.disabled = false;
        locationBtn.classList.remove('loading');
      }
    }
  },

  setElementText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? '--';
  },

  updateScrollProgress(scrollPercent) {
    const fill = document.getElementById('scrollProgressFill');
    if (!fill) return;

    const circumference = 100.53;
    const offset = circumference - (scrollPercent / 100) * circumference;
    fill.style.strokeDashoffset = offset;
  },

  toggleScrollTopBtn(show) {
    const btn = document.getElementById('scrollTopBtn');
    if (!btn) return;

    if (show) {
      btn.removeAttribute('hidden');
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
      setTimeout(() => {
        if (!btn.classList.contains('visible')) {
          btn.setAttribute('hidden', '');
        }
      }, 300);
    }
  },

  showSuggestions(suggestions) {
    const list = document.getElementById('searchSuggestions');
    if (!list) return;
    list.innerHTML = '';
    if (!suggestions || suggestions.length === 0) { list.style.display = 'none'; return; }

    suggestions.forEach(suggestion => {
      const li = document.createElement('li');
      li.className = 'suggestion-item location-suggestion';
      li.setAttribute('role', 'option');
      const meta = [suggestion.region, suggestion.country, suggestion.type].filter(Boolean).join(' • ');
      li.innerHTML = `
        <i class="fas fa-map-marker-alt" aria-hidden="true"></i>
        <span class="suggestion-copy">
          <strong>${this.escapeHTML(suggestion.name)}</strong>
          <small>${this.escapeHTML(meta || suggestion.displayName || '')}</small>
        </span>`;
      li.addEventListener('click', () => {
        const input = document.getElementById('citySearch');
        if (input) input.value = suggestion.name;
        list.style.display = 'none';
        document.dispatchEvent(new CustomEvent('searchCity', { detail: suggestion }));
      });
      list.appendChild(li);
    });
    list.style.display = 'block';
  },

  escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  },

  hideSuggestions() {
    const list = document.getElementById('searchSuggestions');
    if (list) list.style.display = 'none';
  },

  cleanup() {
    if (this.state.clockInterval) clearInterval(this.state.clockInterval);
    if (this.state.particlesInterval) clearInterval(this.state.particlesInterval);
  }
};
