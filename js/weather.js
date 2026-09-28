

const WeatherAPI = {

  PROXY_URL: '/api/weather',

  LANGUAGE: 'ar',

  FORECAST_DAYS: 3,

  CACHE_DURATION: 10 * 60 * 1000,

  cache: {},

  resolveQuery(query) {
    return String(query || '').trim().replace(/\s+/g, ' ');
  },

  async getForecast(query) {
    try {
      query = this.resolveQuery(query);

      const cacheKey = `forecast_${query.toLowerCase().trim()}`;

      if (this.cache[cacheKey] && Date.now() - this.cache[cacheKey].timestamp < this.CACHE_DURATION) {
        console.log('📦 جاري استخدام البيانات المخزنة مؤقتًا لـ:', query);
        return this.cache[cacheKey].data;
      }

      const url = `${this.PROXY_URL}?type=forecast&q=${encodeURIComponent(query)}&days=${this.FORECAST_DAYS}&aqi=yes&alerts=yes&lang=${this.LANGUAGE}`;

      console.log('🌐 جاري جلب بيانات الطقس لـ:', query);

      const response = await fetch(url);

      if (!response.ok) {

        const errorData = await response.json().catch(() => ({}));
        throw new Error(this.getErrorMessage(response.status, errorData));
      }

      const data = await response.json();

      this.cache[cacheKey] = {
        data: data,
        timestamp: Date.now()
      };

      console.log('✅ تم جلب البيانات بنجاح:', data.location.name);
      return data;

    } catch (error) {

      console.error('❌ خطأ في جلب بيانات الطقس:', error.message);
      throw error;
    }
  },

  async getSearchSuggestions(query) {
    try {

      if (!query || query.trim().length < 2) return [];

      const url = `${this.PROXY_URL}?type=search&q=${encodeURIComponent(query)}`;

      const response = await fetch(url);

      if (!response.ok) return [];

      const data = await response.json();
      return Array.isArray(data) ? data : [];

    } catch (error) {
      console.error('❌ خطأ في جلب الاقتراحات:', error.message);
      return []; 
    }
  },

  async getWeatherByCoords(latitude, longitude) {

    const query = `${latitude},${longitude}`;
    return this.getForecast(query);
  },

  getErrorMessage(statusCode, errorData) {

    const apiErrorCode = errorData?.error?.code;

    const apiErrors = {
      1002: 'تعذر الاتصال بخدمة الطقس. تحقق من إعدادات الخادم',
      1003: 'يرجى إدخال اسم مدينة',
      1005: 'طلب غير صالح من خدمة الطقس',
      1006: '❌ لم يتم العثور على المدينة. جرب اسمًا مختلفًا',
      2006: 'خدمة الطقس غير مهيأة حاليًا',
      2007: 'تم تجاوز الحد الشهري لطلبات API المجانية',
      2008: 'خدمة الطقس غير متاحة حاليًا',
      9000: 'طلب JSON غير صالح'
    };

    if (apiErrorCode && apiErrors[apiErrorCode]) {
      return apiErrors[apiErrorCode];
    }

    const httpErrors = {
      400: 'طلب غير صالح. يرجى التحقق من اسم المدينة',
      401: 'طبقة الاتصال غير صالح أو منتهي الصلاحية',
      403: 'وصول مرفوض. تحقق من صلاحيات طبقة الاتصال',
      404: 'المدينة غير موجودة. جرب اسمًا مختلفًا',
      429: 'تم تجاوز حد الطلبات. يرجى الانتظار قبل المحاولة مرة أخرى',
      500: 'خطأ في خوادم WeatherAPI. يرجى المحاولة لاحقًا',
      503: 'الخدمة غير متاحة حاليًا'
    };

    return httpErrors[statusCode] || `خطأ في الاتصال بـ API (كود: ${statusCode})`;
  },

  clearCache() {
    this.cache = {};
    console.log('🗑️ تم مسح الكاش');
  },

  isProxyConfigured() {
    return Boolean(this.PROXY_URL);
  }
};

const LocationSearch = {
  GEOCODE_URL: '/api/geocode',
  cache: {},

  normalizeQuery(query) {
    return String(query || '').trim().replace(/\s+/g, ' ');
  },

  async search(query) {
    const clean = this.normalizeQuery(query);
    if (!clean || clean.length < 2) return [];

    const cacheKey = clean.toLowerCase();
    if (this.cache[cacheKey]) return this.cache[cacheKey];

    const response = await fetch(`${this.GEOCODE_URL}?q=${encodeURIComponent(clean)}`, {
      headers: { Accept: 'application/json' }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.error?.message || 'تعذر الاتصال بخدمة البحث الجغرافي');
    }

    const results = Array.isArray(data.results) ? data.results : [];

    const normalizedResults = results
      .map(item => {
        const components = item.components || {};
        const name = components._normalized_city ||
          components.city || components.town || components.village ||
          components.municipality || components.county ||
          components.state || item.formatted;

        return {
          id: `${Number(item.geometry?.lat).toFixed(6)}:${Number(item.geometry?.lng).toFixed(6)}`,
          name,
          displayName: item.formatted || name,
          lat: Number(item.geometry?.lat),
          lon: Number(item.geometry?.lng),
          type: components._type || components._category || 'location',
          category: components._category || '',
          country: components.country || '',
          countryCode: components.country_code || '',
          region: components.state || components.region || components.county || '',
          confidence: Number(item.confidence || 0)
        };
      })
      .filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lon));

    this.cache[cacheKey] = normalizedResults;
    return normalizedResults;
  },

  clearCache() {
    this.cache = {};
  }
};

const WeatherHelpers = {

  convertTemp(value, from = 'C') {
    if (from === 'C') {

      return Math.round((value * 9/5) + 32);
    } else {

      return Math.round((value - 32) * 5/9);
    }
  },

  getWeatherIcon(code, isDay = true) {

    const conditions = {

      1000: isDay
        ? { icon: 'fa-sun', color: '#fda085', bgClass: 'sunny', emoji: '☀️' }
        : { icon: 'fa-moon', color: '#a0a0c0', bgClass: 'night-clear', emoji: '🌙' },

      1003: isDay
        ? { icon: 'fa-cloud-sun', color: '#4facfe', bgClass: 'partly-cloudy', emoji: '⛅' }
        : { icon: 'fa-cloud-moon', color: '#7a8ef0', bgClass: 'night', emoji: '🌤️' },

      1006: { icon: 'fa-cloud', color: '#8e9eab', bgClass: 'cloudy', emoji: '☁️' },
      1009: { icon: 'fa-cloud', color: '#8e9eab', bgClass: 'cloudy', emoji: '☁️' },

      1030: { icon: 'fa-smog', color: '#c9d6df', bgClass: 'foggy', emoji: '🌫️' },
      1135: { icon: 'fa-smog', color: '#c9d6df', bgClass: 'foggy', emoji: '🌫️' },
      1147: { icon: 'fa-smog', color: '#c9d6df', bgClass: 'foggy', emoji: '🌫️' },

      1063: { icon: 'fa-cloud-rain', color: '#4facfe', bgClass: 'rainy', emoji: '🌧️' },
      1150: { icon: 'fa-cloud-rain', color: '#4facfe', bgClass: 'rainy', emoji: '🌦️' },
      1153: { icon: 'fa-cloud-rain', color: '#4facfe', bgClass: 'rainy', emoji: '🌦️' },
      1168: { icon: 'fa-cloud-rain', color: '#4facfe', bgClass: 'rainy', emoji: '🌦️' },
      1180: { icon: 'fa-cloud-rain', color: '#4facfe', bgClass: 'rainy', emoji: '🌧️' },
      1183: { icon: 'fa-cloud-rain', color: '#4facfe', bgClass: 'rainy', emoji: '🌧️' },
      1186: { icon: 'fa-cloud-rain', color: '#4facfe', bgClass: 'rainy', emoji: '🌧️' },
      1189: { icon: 'fa-cloud-rain', color: '#4facfe', bgClass: 'rainy', emoji: '🌧️' },
      1192: { icon: 'fa-cloud-showers-heavy', color: '#1a1a2e', bgClass: 'rainy', emoji: '🌧️' },
      1195: { icon: 'fa-cloud-showers-heavy', color: '#1a1a2e', bgClass: 'rainy', emoji: '🌧️' },
      1240: { icon: 'fa-cloud-rain', color: '#4facfe', bgClass: 'rainy', emoji: '🌦️' },
      1243: { icon: 'fa-cloud-showers-heavy', color: '#1a1a2e', bgClass: 'rainy', emoji: '🌧️' },
      1246: { icon: 'fa-cloud-showers-heavy', color: '#1a1a2e', bgClass: 'rainy', emoji: '🌧️' },

      1087: { icon: 'fa-bolt', color: '#ffd700', bgClass: 'stormy', emoji: '⛈️' },
      1273: { icon: 'fa-cloud-bolt', color: '#ffd700', bgClass: 'stormy', emoji: '⛈️' },
      1276: { icon: 'fa-cloud-bolt', color: '#ffd700', bgClass: 'stormy', emoji: '⛈️' },
      1279: { icon: 'fa-cloud-bolt', color: '#ffd700', bgClass: 'stormy', emoji: '⛈️' },
      1282: { icon: 'fa-cloud-bolt', color: '#ffd700', bgClass: 'stormy', emoji: '⛈️' },

      1066: { icon: 'fa-snowflake', color: '#dfe9f3', bgClass: 'snowy', emoji: '❄️' },
      1069: { icon: 'fa-snowflake', color: '#dfe9f3', bgClass: 'snowy', emoji: '🌨️' },
      1072: { icon: 'fa-snowflake', color: '#dfe9f3', bgClass: 'snowy', emoji: '🌨️' },
      1114: { icon: 'fa-snowflake', color: '#dfe9f3', bgClass: 'snowy', emoji: '❄️' },
      1117: { icon: 'fa-snowflake', color: '#dfe9f3', bgClass: 'snowy', emoji: '❄️' },
      1171: { icon: 'fa-snowflake', color: '#dfe9f3', bgClass: 'snowy', emoji: '🌨️' },
      1204: { icon: 'fa-snowflake', color: '#dfe9f3', bgClass: 'snowy', emoji: '🌨️' },
      1207: { icon: 'fa-snowflake', color: '#dfe9f3', bgClass: 'snowy', emoji: '🌨️' },
      1210: { icon: 'fa-snowflake', color: '#dfe9f3', bgClass: 'snowy', emoji: '❄️' },
      1213: { icon: 'fa-snowflake', color: '#dfe9f3', bgClass: 'snowy', emoji: '❄️' },
      1216: { icon: 'fa-snowflake', color: '#dfe9f3', bgClass: 'snowy', emoji: '❄️' },
      1219: { icon: 'fa-snowflake', color: '#dfe9f3', bgClass: 'snowy', emoji: '❄️' },
      1222: { icon: 'fa-snowflake', color: '#dfe9f3', bgClass: 'snowy', emoji: '❄️' },
      1225: { icon: 'fa-snowflake', color: '#dfe9f3', bgClass: 'snowy', emoji: '❄️' },
      1237: { icon: 'fa-snowflake', color: '#dfe9f3', bgClass: 'snowy', emoji: '🌨️' },
      1255: { icon: 'fa-snowflake', color: '#dfe9f3', bgClass: 'snowy', emoji: '❄️' },
      1258: { icon: 'fa-snowflake', color: '#dfe9f3', bgClass: 'snowy', emoji: '❄️' },
      1261: { icon: 'fa-snowflake', color: '#dfe9f3', bgClass: 'snowy', emoji: '🌨️' },
      1264: { icon: 'fa-snowflake', color: '#dfe9f3', bgClass: 'snowy', emoji: '🌨️' },
    };

    return conditions[code] || {
      icon: 'fa-cloud-sun',
      color: '#4facfe',
      bgClass: 'partly-cloudy',
      emoji: '🌤️'
    };
  },

  getWeatherTip(code, temp, humidity, uvIndex) {

    if (code === 1000) {

      if (uvIndex >= 8) {
        return { tip: '🕶️ مؤشر الأشعة فوق البنفسجية مرتفع جدًا! استخدم واقي الشمس وتجنب الخروج بين 10 صباحًا و4 مساءً', emoji: '☀️' };
      }
      if (temp > 35) {
        return { tip: '💧 الجو حار جدًا! اشرب الماء كثيرًا وتجنب التعرض المطول للشمس', emoji: '🥵' };
      }
      return { tip: '😊 طقس رائع اليوم! مناسب للنزهة والأنشطة الخارجية', emoji: '☀️' };
    }

    if ([1063, 1150, 1153, 1180, 1183, 1186, 1189, 1192, 1195, 1240, 1243, 1246].includes(code)) {

      return { tip: '🌂 لا تنسَ مظلتك! الطقس ممطر اليوم. تجنب القيادة بسرعة على الطرق المبللة', emoji: '🌧️' };
    }

    if ([1087, 1273, 1276, 1279, 1282].includes(code)) {

      return { tip: '⚠️ عاصفة رعدية! ابقَ في المنزل وابتعد عن النوافذ والأماكن المكشوفة', emoji: '⛈️' };
    }

    if ([1066, 1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225].includes(code)) {

      return { tip: '🧤 الطقس ثلجي! ارتدِ ملابس دافئة وكن حذرًا على الطرق المتجمدة', emoji: '❄️' };
    }

    if ([1030, 1135, 1147].includes(code)) {

      return { tip: '🌫️ رؤية محدودة بسبب الضباب. كن حذرًا أثناء القيادة وشغّل الأضواء', emoji: '🌫️' };
    }

    if (humidity > 80) {
      return { tip: '💧 رطوبة عالية! قد تشعر بحرارة أكثر من المعتاد. اشرب الماء بانتظام', emoji: '💧' };
    }

    if (temp < 5) {
      return { tip: '🧥 الجو بارد جدًا! ارتدِ طبقات من الملابس الدافئة واحمِ أطراف جسمك', emoji: '🥶' };
    }

    return { tip: '🌤️ طقس لطيف! استمتع بيومك', emoji: '⛅' };
  },

  getUVLevel(uv) {
    if (uv <= 2) return { label: 'منخفض', class: 'low' };
    if (uv <= 5) return { label: 'متوسط', class: 'moderate' };
    if (uv <= 7) return { label: 'مرتفع', class: 'high' };
    if (uv <= 10) return { label: 'شديد', class: 'high' };
    return { label: 'خطير', class: 'extreme' };
  },

  getPressureStatus(pressure) {
    if (pressure < 1000) return { label: 'منخفض', class: 'low' };
    if (pressure > 1020) return { label: 'مرتفع', class: 'high' };
    return { label: 'طبيعي', class: 'normal' };
  },

  getWindDirection(dir) {
    const directions = {
      'N': 'شمال', 'NNE': 'شمال شمال شرق', 'NE': 'شمال شرق',
      'ENE': 'شرق شمال شرق', 'E': 'شرق', 'ESE': 'شرق جنوب شرق',
      'SE': 'جنوب شرق', 'SSE': 'جنوب جنوب شرق', 'S': 'جنوب',
      'SSW': 'جنوب جنوب غرب', 'SW': 'جنوب غرب', 'WSW': 'غرب جنوب غرب',
      'W': 'غرب', 'WNW': 'غرب شمال غرب', 'NW': 'شمال غرب', 'NNW': 'شمال شمال غرب'
    };
    return directions[dir] || dir;
  },

  getWindArrowDegree(dir) {
    const degrees = {
      'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
      'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
      'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
      'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5
    };
    return degrees[dir] || 0;
  },

  getDayName(dateStr) {
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const date = new Date(dateStr);
    return days[date.getDay()];
  },

  formatDate(dateStr) {
    const months = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    const date = new Date(dateStr);
    return `${date.getDate()} ${months[date.getMonth()]}`;
  },

  formatTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') {
    return '--:--';
  }

  const value = timeStr.trim();
 
  if (
    value.toLowerCase().includes('does not rise') ||
    value.toLowerCase().includes('does not set') ||
    value.toLowerCase().includes('no moonrise') ||
    value.toLowerCase().includes('no moonset')
  ) {
    return value;
  }

  const parts = value.split(/\s+/);
  const time = parts[0];
  const period = parts[1]?.toUpperCase();

  if (!time || !time.includes(':')) {
    return '--:--';
  }

  const [hoursText, minutesText] = time.split(':');

  let hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return '--:--';
  }

  if (period === 'PM' && hours !== 12) {
    hours += 12;
  }

  if (period === 'AM' && hours === 12) {
    hours = 0;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
},

  getMoonPhase(phase) {
    const phases = {
      'New Moon': { name: 'محاق', emoji: '🌑' },
      'Waxing Crescent': { name: 'هلال متصاعد', emoji: '🌒' },
      'First Quarter': { name: 'تربيع أول', emoji: '🌓' },
      'Waxing Gibbous': { name: 'أحدب متصاعد', emoji: '🌔' },
      'Full Moon': { name: 'بدر', emoji: '🌕' },
      'Waning Gibbous': { name: 'أحدب متناقص', emoji: '🌖' },
      'Last Quarter': { name: 'تربيع أخير', emoji: '🌗' },
      'Waning Crescent': { name: 'هلال متناقص', emoji: '🌘' }
    };
    return phases[phase] || { name: phase || '--', emoji: '🌕' };
  },

  getAirQuality(aqi) {
    const levels = {
      1: { label: 'ممتاز 😊', color: '#10b981', percentage: 15 },
      2: { label: 'جيد 🙂', color: '#84fab0', percentage: 30 },
      3: { label: 'مقبول 😐', color: '#f59e0b', percentage: 50 },
      4: { label: 'غير صحي 😷', color: '#ef4444', percentage: 70 },
      5: { label: 'خطير ⚠️', color: '#991b1b', percentage: 85 },
      6: { label: 'شديد الخطورة ☠️', color: '#4c0519', percentage: 100 }
    };
    return levels[aqi] || { label: 'غير متاح', color: '#8888aa', percentage: 0 };
  },

  getSunPosition(sunriseStr, sunsetStr) {
    try {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const sunriseTime = this.formatTime(sunriseStr);
      const sunsetTime = this.formatTime(sunsetStr);

      const [srH, srM] = sunriseTime.split(':').map(Number);
      const [ssH, ssM] = sunsetTime.split(':').map(Number);

      const sunriseMinutes = srH * 60 + srM;
      const sunsetMinutes = ssH * 60 + ssM;
      const totalDayMinutes = sunsetMinutes - sunriseMinutes;

      if (currentMinutes < sunriseMinutes) return 0;
      if (currentMinutes > sunsetMinutes) return 100;

      const elapsed = currentMinutes - sunriseMinutes;
      return Math.round((elapsed / totalDayMinutes) * 100);

    } catch {
      return 50; 
    }
  }
};
