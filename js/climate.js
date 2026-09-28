

const ClimateAPI = {
  PROXY_URL: '/api/climate',
  CACHE_DURATION: 30 * 60 * 1000,
  cache: new Map(),

  async getClimate(lat, lon, years = 10) {
    const cleanLat = Number(lat);
    const cleanLon = Number(lon);
    const cleanYears = Math.min(Math.max(Number(years) || 10, 5), 20);

    if (!Number.isFinite(cleanLat) || !Number.isFinite(cleanLon)) {
      throw new Error('إحداثيات الموقع غير متاحة للتحليل المناخي.');
    }

    const key = `${cleanLat.toFixed(4)}:${cleanLon.toFixed(4)}:${cleanYears}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    const url = `${this.PROXY_URL}?lat=${encodeURIComponent(cleanLat)}&lon=${encodeURIComponent(cleanLon)}&years=${encodeURIComponent(cleanYears)}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.error?.message || 'تعذر تحميل البيانات المناخية.');
    }

    this.cache.set(key, { timestamp: Date.now(), data: payload });
    return payload;
  },

  clearCache() {
    this.cache.clear();
  },
};

window.ClimateCenter = {
  state: {
    data: null,
    years: 10,
    chartType: 'temperature',
    charts: {
      temperature: null,
      rainfall: null,
      monthly: null,
    },
    requestId: 0,
    airQuality: null,
  },

  async loadForLocation(location, airQuality = null, force = false) {
    if (!location) return;

    const lat = Number(location.lat);
    const lon = Number(location.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const requestId = ++this.state.requestId;
    this.state.airQuality = airQuality;

    this.renderAirQuality(airQuality);
    this.renderLocationMeta(location);
    this.setStatus('loading');

    try {
      if (force) ClimateAPI.clearCache();

      const data = await ClimateAPI.getClimate(lat, lon, this.state.years);
      if (requestId !== this.state.requestId) return;

      this.state.data = data;
      this.render(data);
      this.setStatus('ready');
    } catch (error) {
      if (requestId !== this.state.requestId) return;
      console.error('❌ Climate Center:', error);
      this.setStatus('error', error.message);
    }
  },

  async changeRange(years) {
    const nextYears = Number(years);
    if (![5, 10, 20].includes(nextYears)) return;

    this.state.years = nextYears;

    document.querySelectorAll('.climate-range-btn').forEach(button => {
      button.classList.toggle('active', Number(button.dataset.years) === nextYears);
    });

    const weatherData = UI.state.currentData;
    if (!weatherData?.location) return;

    await this.loadForLocation(
      weatherData.location,
      weatherData.current?.air_quality || null
    );
  },

  render(data) {
    const annual = Array.isArray(data.annual) ? data.annual : [];
    const validAnnual = annual.filter(item => Number.isFinite(item.avgTemp));

    this.setText('climatePeriod', this.formatPeriod(data.period));
    this.setText('climateYearsCount', `${validAnnual.length} سنوات`);
    this.setText(
      'climateAvailableDays',
      `${Number(data.period?.availableDays || 0).toLocaleString('ar-EG')} يوم`
    );

    this.setText('climateAvgTemp', this.formatTemp(this.average(validAnnual.map(item => item.avgTemp))));
    this.setText('climateRecordHigh', this.formatTemp(data.records?.high?.value));
    this.setText('climateRecordHighDate', this.formatDate(data.records?.high?.date));
    this.setText('climateRecordLow', this.formatTemp(data.records?.low?.value));
    this.setText('climateRecordLowDate', this.formatDate(data.records?.low?.date));

    const heatDays = Number(data.heat?.totalDays || 0);
    this.setText('climateHeatDays', heatDays.toLocaleString('ar-EG'));
    this.setText(
      'climateHeatDaysMeta',
      `أيام بلغت ${data.heat?.thresholdC ?? 35}°C أو أكثر`
    );

    this.setText(
      'climateTotalRain',
      `${this.formatNumber(data.rainfall?.averageAnnualMm, 0)} مم/سنة`
    );
    this.setText(
      'climateTotalRainMeta',
      `متوسط سنوي عبر ${validAnnual.length} سنوات`
    );

    const slope = Number(data.trend?.slopeCPerYear);
    const direction = data.trend?.direction || 'stable';
    const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
    const directionText =
      direction === 'up'
        ? 'اتجاه حراري صاعد'
        : direction === 'down'
          ? 'اتجاه حراري هابط'
          : 'اتجاه قريب من الاستقرار';

    const slopeText = Number.isFinite(slope)
      ? `${arrow} ${Math.abs(slope).toFixed(2)}°C / سنة`
      : 'غير كافٍ للحساب';

    this.setText('climateTrendValue', slopeText);
    this.setText('climateTrendLabel', directionText);
    this.setText(
      'climateTrendMeta',
      Number.isFinite(data.trend?.changeC)
        ? `فرق تقريبي ${data.trend.changeC >= 0 ? '+' : ''}${data.trend.changeC.toFixed(1)}°C بين أول وآخر سنة`
        : 'لا توجد سنوات كافية لحساب الاتجاه'
    );

    this.setText('climateWettestYear', data.rainfall?.wettestYear?.year || '--');
    this.setText(
      'climateWettestRain',
      `${this.formatNumber(data.rainfall?.wettestYear?.precipitation, 0)} مم`
    );
    this.setText('climateDriestYear', data.rainfall?.driestYear?.year || '--');
    this.setText(
      'climateDriestRain',
      `${this.formatNumber(data.rainfall?.driestYear?.precipitation, 0)} مم`
    );
    this.setText('climateHottestYear', data.heat?.hottestYear?.year || '--');
    this.setText(
      'climateHottestDays',
      `${this.formatNumber(data.heat?.hottestYear?.extremeHeatDays, 0)} يوم`
    );

    const note = data.source?.note || 'البيانات التاريخية مبنية على إعادة تحليل مناخي.';
    this.setText('climateDataNote', note);

    this.renderCharts(data);
    this.renderComparison(data);
    this.renderAirQuality(this.state.airQuality);
    this.setChartType(this.state.chartType);
  },

  renderCharts(data) {
    if (typeof Chart === 'undefined') return;

    const annual = Array.isArray(data.annual) ? data.annual : [];
    const labels = annual.map(item => String(item.year));
    const temps = annual.map(item => item.avgTemp);
    const rain = annual.map(item => item.precipitation);

    this.destroyCharts();

    const tempCanvas = document.getElementById('climateTemperatureChart');
    if (tempCanvas) {
      const ctx = tempCanvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 0, 320);
      gradient.addColorStop(0, 'rgba(102,126,234,0.34)');
      gradient.addColorStop(1, 'rgba(102,126,234,0)');

      this.state.charts.temperature = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'متوسط الحرارة',
            data: temps,
            borderColor: '#667eea',
            backgroundColor: gradient,
            borderWidth: 3,
            pointRadius: 3,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.34,
          }],
        },
        options: this.baseChartOptions('°C', false),
      });
    }

    const rainCanvas = document.getElementById('climateRainfallChart');
    if (rainCanvas) {
      this.state.charts.rainfall = new Chart(rainCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'الأمطار السنوية',
            data: rain,
            backgroundColor: 'rgba(79,172,254,0.55)',
            borderColor: '#4facfe',
            borderWidth: 1,
            borderRadius: 8,
          }],
        },
        options: this.baseChartOptions('مم', true),
      });
    }

    const monthlyCanvas = document.getElementById('climateMonthlyChart');
    const monthly = Array.isArray(data.monthly) ? data.monthly : [];
    if (monthlyCanvas) {
      this.state.charts.monthly = new Chart(monthlyCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: monthly.map(item => this.monthName(item.month)),
          datasets: [{
            label: 'المتوسط التاريخي الشهري',
            data: monthly.map(item => item.avgTemp),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245,158,11,0.10)',
            borderWidth: 3,
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: true,
            tension: 0.3,
          }],
        },
        options: this.baseChartOptions('°C', false),
      });
    }
  },

  baseChartOptions(unit, beginAtZero) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          rtl: true,
          displayColors: false,
          callbacks: {
            label: context => `${context.parsed.y} ${unit}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 10, font: { family: 'Cairo' } },
        },
        y: {
          beginAtZero,
          grid: { color: 'rgba(102,126,234,0.10)' },
          ticks: {
            font: { family: 'Cairo' },
          },
        },
      },
    };
  },

  destroyCharts() {
    Object.values(this.state.charts).forEach(chart => chart?.destroy?.());
    this.state.charts = { temperature: null, rainfall: null, monthly: null };
  },

  setChartType(type) {
    if (!['temperature', 'rainfall', 'monthly'].includes(type)) return;

    this.state.chartType = type;

    document.querySelectorAll('.climate-chart-tab').forEach(button => {
      button.classList.toggle('active', button.dataset.climateChart === type);
    });

    document.querySelectorAll('.climate-chart-panel').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.climatePanel === type);
    });
  },

  renderComparison(data) {
    const host = document.getElementById('compareYears');
    if (!host) return;
    const annual = Array.isArray(data.annual) ? data.annual : [];
    host.innerHTML = annual.map((item, index) => `
      <button type="button" class="compare-year-btn ${index < 2 ? 'active' : ''}" data-compare-year="${item.year}">${item.year}</button>
    `).join('');
    const selected = annual.slice(0, 3).map(item => item.year);
    const paint = () => {
      const years = [...host.querySelectorAll('.compare-year-btn.active')].map(btn => Number(btn.dataset.compareYear)).slice(0, 3);
      annual.forEach(item => {
        const btn = host.querySelector(`[data-compare-year="${item.year}"]`);
        if (btn) btn.classList.toggle('active', years.includes(item.year));
      });
      const rows = [
        ['compareYear', years, y => y || '—'],
        ['compareTemp', years, y => { const x=annual.find(i=>i.year===y); return Number.isFinite(x?.avgTemp) ? `${x.avgTemp.toFixed(1)}°C` : '—'; }],
        ['compareRain', years, y => { const x=annual.find(i=>i.year===y); return Number.isFinite(x?.precipitation) ? `${this.formatNumber(x.precipitation,0)} مم` : '—'; }],
        ['compareHeat', years, y => { const x=annual.find(i=>i.year===y); return Number.isFinite(x?.extremeHeatDays) ? `${this.formatNumber(x.extremeHeatDays,0)} يوم` : '—'; }],
      ];
      rows.forEach(([prefix, ys, formatter]) => {
        ['A','B','C'].forEach((letter, i) => this.setText(`${prefix}${letter}`, formatter(ys[i])));
      });
      this.setText('compareHint', years.length ? `تم اختيار ${years.length} سنوات` : 'اختر السنوات من البطاقات');
    };
    host.querySelectorAll('.compare-year-btn').forEach(btn => btn.addEventListener('click', () => {
      const active = host.querySelectorAll('.compare-year-btn.active').length;
      if (btn.classList.contains('active')) { if (active <= 1) return; btn.classList.remove('active'); }
      else { if (active >= 3) return; btn.classList.add('active'); }
      paint();
    }));

    selected.forEach(y => host.querySelector(`[data-compare-year="${y}"]`)?.classList.add('active'));
    paint();
  },

  renderAirQuality(airQuality) {
    const metrics = [
      ['climateAQI', airQuality?.['us-epa-index'], ''],
      ['climatePM25', airQuality?.pm2_5, 'µg/m³'],
      ['climatePM10', airQuality?.pm10, 'µg/m³'],
      ['climateNO2', airQuality?.no2, 'µg/m³'],
      ['climateO3', airQuality?.o3, 'µg/m³'],
    ];

    metrics.forEach(([id, value, suffix]) => {
      const valueEl = document.getElementById(id);
      const suffixEl = document.getElementById(`${id}Suffix`);
      const numeric = Number(value);

      if (valueEl) valueEl.textContent = Number.isFinite(numeric)
        ? this.formatNumber(numeric, id === 'climateAQI' ? 0 : 1)
        : '--';

      if (suffixEl) suffixEl.textContent = suffix;
    });

    const aqiValue = Number(airQuality?.['us-epa-index']);
    const label = Number.isFinite(aqiValue)
      ? WeatherHelpers.getAirQuality(aqiValue).label
      : 'غير متاح';

    this.setText('climateAQILabel', label);
    this.setText(
      'climateAirSource',
      airQuality
        ? 'مؤشرات جودة الهواء الحالية من WeatherAPI'
        : 'بيانات جودة الهواء غير متاحة حاليًا'
    );
  },

  renderLocationMeta(location) {
    this.setText(
      'climateLocation',
      [location?.name, location?.region, location?.country].filter(Boolean).join(' • ') || '--'
    );
  },

  setStatus(status, message = '') {
    const loading = document.getElementById('climateLoading');
    const error = document.getElementById('climateError');
    const content = document.getElementById('climateContent');

    loading?.classList.toggle('hidden', status !== 'loading');
    error?.classList.toggle('hidden', status !== 'error');
    content?.classList.toggle('hidden', status !== 'ready');

    if (status === 'error') {
      this.setText('climateErrorText', message || 'تعذر تحميل المركز المناخي.');
    }
  },

  formatPeriod(period) {
    if (!period?.start || !period?.end) return '--';
    return `${period.start.slice(0, 4)} — ${period.end.slice(0, 4)}`;
  },

  formatDate(date) {
    if (!date) return '--';
    const parsed = new Date(`${date}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString('ar-EG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  },

  formatTemp(value) {
    return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}°C` : '--';
  },

  formatNumber(value, digits = 0) {
    return Number.isFinite(Number(value))
      ? Number(value).toLocaleString('ar-EG', {
          maximumFractionDigits: digits,
          minimumFractionDigits: digits === 0 ? 0 : 1,
        })
      : '--';
  },

  monthName(month) {
    const names = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    return names[Number(month) - 1] || '--';
  },

  average(values) {
    const clean = values.filter(Number.isFinite);
    return clean.length
      ? clean.reduce((sum, value) => sum + value, 0) / clean.length
      : null;
  },

  setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  },
};

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.climate-range-btn').forEach(button => {
    button.addEventListener('click', () => window.ClimateCenter.changeRange(button.dataset.years));
  });

  document.querySelectorAll('.climate-chart-tab').forEach(button => {
    button.addEventListener('click', () => {
      window.ClimateCenter.setChartType(button.dataset.climateChart);
    });
  });

  window.ClimateCenter.setChartType('temperature');
});
