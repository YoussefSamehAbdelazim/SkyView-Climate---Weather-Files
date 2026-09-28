

const AppState = {
  isDarkMode: false,           
  isCelsius: true,             
  isAutoTheme: true,           
  currentCity: '',             
  currentLocation: null,       
  searchDebounceTimer: null,   
  searchRequestId: 0,          
  autoRefreshInterval: null,   
  themeCheckInterval: null,    
};

async function initApp() {
  console.log('🚀 بدء تشغيل SkyView Weather...');

  UI.init();
  setupEducationInteractions();

  await runPreloader();
}

async function runPreloader() {

  UI.updatePreloader(10, '🔧 جارٍ إعداد التطبيق...');
  await sleep(200);

  setupAutoTheme();
  UI.updatePreloader(20, '🎨 جارٍ تطبيق الثيم...');
  await sleep(200);

  setupEventListeners();
  UI.updatePreloader(40, '⚡ جارٍ تحميل الوظائف...');
  await sleep(300);

  UI.updatePreloader(60, '📍 جارٍ تحديد موقعك...');

  try {

    const position = await getCurrentPosition();
    UI.updatePreloader(75, '🌍 جارٍ جلب بيانات طقسك...');
    await sleep(200);

    const data = await WeatherAPI.getWeatherByCoords(
      position.coords.latitude,
      position.coords.longitude
    );

    UI.updatePreloader(90, '✨ جارٍ تحديث الواجهة...');
    await sleep(300);

    UI.updateWeatherDisplay(data, AppState.isCelsius);
    AppState.currentCity = data.location.name;
    AppState.currentLocation = { name: data.location.name, country: data.location.country, region: data.location.region || '', lat: data.location.lat, lon: data.location.lon };

  } catch (geoError) {

    console.warn('⚠️ لم يتم السماح بتحديد الموقع:', geoError.message);
    UI.updatePreloader(75, '🌍 جارٍ تحميل الطقس الافتراضي...');
    await sleep(200);

    try {

      const data = await WeatherAPI.getForecast('Cairo');
      UI.updatePreloader(90, '✨ جارٍ تحديث الواجهة...');
      await sleep(200);
      UI.updateWeatherDisplay(data, AppState.isCelsius);
      AppState.currentCity = data.location.name;
      AppState.currentLocation = { name: data.location.name, country: data.location.country, region: data.location.region || '', lat: data.location.lat, lon: data.location.lon };
    } catch (apiError) {

      console.error('❌ خطأ في API:', apiError.message);
      UI.updatePreloader(90, '⚠️ يرجى البحث عن مدينة يدويًا...');
    }
  }

  UI.updatePreloader(100, '✅ جاهز!');
  await sleep(400);

  UI.hidePreloader(() => {

    startAutoRefresh();

    startThemeCheck();
    console.log('✅ التطبيق جاهز للاستخدام!');
  });
}

function setupEducationInteractions() {
  document.querySelectorAll('.education-tab').forEach(button => {
    button.addEventListener('click', () => {
      const type = button.dataset.education;
      document.querySelectorAll('.education-tab').forEach(b => b.classList.toggle('active', b === button));
      document.querySelectorAll('.education-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.educationPanel === type));
    });
  });

  const techText = {
    data: 'تبدأ الرحلة من بيانات بيئية مثل الحرارة والأمطار وجودة الهواء المتاحة من المصادر المستخدمة في المشروع.',
    sources: 'يستخدم المشروع واجهات ومصادر بيانات محددة، مع إظهار مصدر كل مجموعة بيانات بدل تقديم أرقام بلا سياق.',
    processing: 'تُجمع البيانات اليومية وتُرتب حسب السنة والشهر لحساب المؤشرات التي تظهر في Climate Center.',
    analysis: 'تتحول البيانات إلى متوسطات وسجلات ومقارنات واتجاهات تاريخية بسيطة مع توضيح حدود التفسير.',
    visualization: 'تُعرض النتائج في بطاقات ورسوم تفاعلية لتسهيل قراءة الاختلافات والأنماط عبر السنوات.'
  };
  document.querySelectorAll('[data-tech]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-tech]').forEach(b => b.classList.toggle('active', b === button));
      const target = document.getElementById('techExplanation');
      if (target) target.textContent = techText[button.dataset.tech] || '';
    });
  });

  const modal = document.getElementById('explainModal');
  const title = document.getElementById('explainTitle');
  const text = document.getElementById('explainText');
  const close = () => modal?.classList.add('hidden');
  document.getElementById('explainClose')?.addEventListener('click', close);
  document.getElementById('explainBackdrop')?.addEventListener('click', close);
  const explanations = {
    temperature: ['اتجاه الحرارة', 'يوضح هذا الرسم متوسط درجة الحرارة لكل سنة ضمن الفترة المحددة، ويساعد على ملاحظة الاختلافات والاتجاهات التاريخية في البيانات.'],
    rainfall: ['الأمطار السنوية', 'يقارن كمية الأمطار المسجلة لكل سنة من السنوات المتاحة، ويُستخدم لدراسة الاختلافات التاريخية بين السنوات.'],
    monthly: ['البصمة الشهرية', 'يعرض متوسط الحرارة لكل شهر عبر الفترة المختارة، مما يساعد على رؤية الشكل الموسمي للسنة المناخية.']
  };
  document.querySelectorAll('.chart-explain-btn').forEach(button => button.addEventListener('click', () => {
    const item = explanations[button.dataset.explain];
    if (!item || !modal) return;
    if (title) title.textContent = `ماذا يعني ${item[0]}؟`;
    if (text) text.textContent = item[1];
    modal.classList.remove('hidden');
  }));
}

function setupEventListeners() {
  document.querySelectorAll('.chart-tab').forEach(button => {
    button.addEventListener('click', () => {
      UI.setChartType(button.dataset.chart);
    });
  });


  const searchInput = document.getElementById('citySearch');
  const searchBtn = document.getElementById('searchBtn');

  if (searchInput) {

    searchInput.addEventListener('input', handleSearchInput);

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        UI.hideSuggestions();
        handleSearch(searchInput.value.trim());
      }

      if (e.key === 'Escape') UI.hideSuggestions();
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      const query = searchInput?.value.trim();
      if (query) {
        UI.hideSuggestions();
        handleSearch(query);
      }
    });
  }

  document.addEventListener('searchCity', (e) => {
    handleSearch(e.detail);
  });

  const locationBtn = document.getElementById('locationBtn');
  if (locationBtn) {
    locationBtn.addEventListener('click', handleLocationRequest);
  }
const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {

      AppState.isAutoTheme = false;
      toggleTheme();
    });
  }

  const unitToggle = document.getElementById('unitToggle');
  if (unitToggle) {
    unitToggle.addEventListener('click', toggleTemperatureUnit);
  }

  const aboutToggle = document.getElementById('aboutToggle');
  const aboutModal = document.getElementById('aboutModal');
  const aboutClose = document.getElementById('aboutClose');
  const aboutBackdrop = document.getElementById('aboutBackdrop');

  function openAboutModal() {
    if (!aboutModal) return;
    aboutModal.classList.remove('hidden');
    document.body.classList.add('about-open');
    aboutClose?.focus();
  }

  function closeAboutModal() {
    if (!aboutModal) return;
    aboutModal.classList.add('hidden');
    document.body.classList.remove('about-open');
    aboutToggle?.focus();
  }

  if (aboutToggle) aboutToggle.addEventListener('click', openAboutModal);
  if (aboutClose) aboutClose.addEventListener('click', closeAboutModal);
  if (aboutBackdrop) aboutBackdrop.addEventListener('click', closeAboutModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aboutModal && !aboutModal.classList.contains('hidden')) {
      closeAboutModal();
    }
  });

  const errorClose = document.getElementById('errorClose');
  if (errorClose) {
    errorClose.addEventListener('click', () => UI.hideError());
  }

  const scrollTopBtn = document.getElementById('scrollTopBtn');
  if (scrollTopBtn) {
    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  window.addEventListener('scroll', handleScroll, { passive: true });

  const hourlyScrollLeft = document.getElementById('hourlyScrollLeft');
  const hourlyScrollRight = document.getElementById('hourlyScrollRight');
  const hourlyContainer = document.getElementById('hourlyContainer');

  if (hourlyScrollLeft && hourlyContainer) {
    hourlyScrollLeft.addEventListener('click', () => {
      hourlyContainer.scrollBy({ left: -200, behavior: 'smooth' });
    });
  }
  if (hourlyScrollRight && hourlyContainer) {
    hourlyScrollRight.addEventListener('click', () => {
      hourlyContainer.scrollBy({ left: 200, behavior: 'smooth' });
    });
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-input-group')) {
      UI.hideSuggestions();
    }
  });

  window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (navbar) {
      navbar.classList.toggle('scrolled', window.scrollY > 50);
    }
  }, { passive: true });

  setupTouchScroll();

  console.log('✅ تم تسجيل جميع الأحداث');
}

function handleSearchInput(e) {
  const query = e.target.value.trim();

  clearTimeout(AppState.searchDebounceTimer);

  if (query.length < 2) {
    UI.hideSuggestions();
    return;
  }

  const requestId = ++AppState.searchRequestId;

  AppState.searchDebounceTimer = setTimeout(async () => {
    try {
      const suggestions = await LocationSearch.search(query);
      if (requestId === AppState.searchRequestId) UI.showSuggestions(suggestions);
    } catch (error) {
      console.error('❌ خطأ في جلب الاقتراحات:', error);
      if (requestId === AppState.searchRequestId) UI.hideSuggestions();
    }
  }, 500);
}

async function handleSearch(city) {
  const isLocation = city && typeof city === 'object' && Number.isFinite(city.lat) && Number.isFinite(city.lon);
  const rawQuery = isLocation ? '' : String(city || '').trim();

  if (!isLocation && !rawQuery) {
    UI.showError('تنبيه', 'يرجى إدخال اسم مكان للبحث');
    return;
  }

  UI.hideSuggestions();
  UI.hideError();
  UI.setLoadingState(true);

  try {
    let selectedLocation = isLocation ? city : null;


    if (!selectedLocation) {
      const results = await LocationSearch.search(rawQuery);
      if (results.length) selectedLocation = results[0];
    }

    let data;
    if (selectedLocation) {
      console.log('🔍 البحث بالإحداثيات:', selectedLocation);
      data = await WeatherAPI.getWeatherByCoords(selectedLocation.lat, selectedLocation.lon);
      AppState.currentLocation = {
        name: selectedLocation.name,
        country: selectedLocation.country,
        region: selectedLocation.region,
        lat: selectedLocation.lat,
        lon: selectedLocation.lon,
        displayName: selectedLocation.displayName || selectedLocation.name,
      };
    } else {

      console.log('🔍 تعذر تحديد إحداثيات المكان، سيتم تجربة مزود الطقس بالاسم:', rawQuery);
      data = await WeatherAPI.getForecast(rawQuery);
      AppState.currentLocation = null;
    }

    UI.updateWeatherDisplay(data, AppState.isCelsius);
    AppState.currentCity = AppState.currentLocation?.name || data.location.name;

    const searchInput = document.getElementById('citySearch');
    if (searchInput) searchInput.value = AppState.currentLocation?.name || data.location.name;

    smoothScrollToCard();

  } catch (error) {
    console.error('❌ خطأ في البحث:', error.message);
    UI.showError('خطأ في البحث', error.message);
  } finally {
    UI.setLoadingState(false);
  }
}
async function handleLocationRequest() {
  UI.setLoadingState(true);
  UI.hideError();

  if (!navigator.geolocation) {
    UI.showError('غير مدعوم', 'متصفحك لا يدعم تحديد الموقع. جرب متصفحًا آخر');
    UI.setLoadingState(false);
    return;
  }

  try {
    console.log('📍 جارٍ تحديد الموقع...');

    const position = await getCurrentPosition();

    const data = await WeatherAPI.getWeatherByCoords(
      position.coords.latitude,
      position.coords.longitude
    );

    UI.updateWeatherDisplay(data, AppState.isCelsius);
    AppState.currentCity = data.location.name;

    const searchInput = document.getElementById('citySearch');
    if (searchInput) searchInput.value = data.location.name;

    smoothScrollToCard();

  } catch (error) {

    if (error.code === 1) {
      UI.showError('تم الرفض', 'يرجى السماح للموقع بالوصول إلى موقعك أو ابحث عن مدينة يدويًا');
    } else if (error.code === 2) {
      UI.showError('غير متاح', 'لا يمكن تحديد موقعك حاليًا. تحقق من إعدادات GPS');
    } else if (error.code === 3) {
      UI.showError('انتهى الوقت', 'استغرق تحديد الموقع وقتًا طويلًا. يرجى المحاولة مرة أخرى');
    } else {
      UI.showError('خطأ', error.message || 'حدث خطأ في تحديد الموقع');
    }
  } finally {
    UI.setLoadingState(false);
  }
}

function toggleTheme() {
  AppState.isDarkMode = !AppState.isDarkMode;

  const body = document.getElementById('body');
  const themeIcon = document.getElementById('themeIcon');

  if (AppState.isDarkMode) {

    body.className = 'theme-dark';
    if (themeIcon) themeIcon.className = 'fas fa-sun';
    localStorage.setItem('skyview_theme', 'dark');
  } else {

    body.className = 'theme-light';
    if (themeIcon) themeIcon.className = 'fas fa-moon';
    localStorage.setItem('skyview_theme', 'light');
  }

  console.log(`🌙 تم تغيير الثيم إلى: ${AppState.isDarkMode ? 'داكن' : 'فاتح'}`);
}

function setupAutoTheme() {

  const savedTheme = localStorage.getItem('skyview_theme');

  if (savedTheme) {

    AppState.isAutoTheme = false;
    AppState.isDarkMode = savedTheme === 'dark';
    applyTheme(AppState.isDarkMode);
    return;
  }

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (prefersDark) {

    AppState.isDarkMode = true;
    applyTheme(true);
  } else {

    applyThemeByTime();
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (AppState.isAutoTheme) {
      AppState.isDarkMode = e.matches;
      applyTheme(e.matches);
    }
  });

  console.log(`🎨 الثيم التلقائي: ${AppState.isDarkMode ? 'داكن' : 'فاتح'}`);
}

function applyThemeByTime() {
  const hour = new Date().getHours();

  const isNight = hour >= 20 || hour < 6;

  AppState.isDarkMode = isNight;
  applyTheme(isNight);
}

function applyTheme(isDark) {
  const body = document.getElementById('body');
  const themeIcon = document.getElementById('themeIcon');

  if (isDark) {
    body.className = 'theme-dark';
    if (themeIcon) themeIcon.className = 'fas fa-sun';
  } else {
    body.className = 'theme-light';
    if (themeIcon) themeIcon.className = 'fas fa-moon';
  }
}

function toggleTemperatureUnit() {
  AppState.isCelsius = !AppState.isCelsius;

  const unitText = document.getElementById('unitText');
  if (unitText) {
    unitText.textContent = AppState.isCelsius ? '°C' : '°F';

    unitText.style.animation = 'none';
    unitText.offsetHeight;
    unitText.style.animation = 'fadeInUp 0.3s ease';
  }

  if (UI.state.currentData) {
    UI.updateWeatherDisplay(UI.state.currentData, AppState.isCelsius);
  }

  console.log(`🌡️ وحدة الحرارة: ${AppState.isCelsius ? 'سيليزيوس' : 'فهرنهايت'}`);
}

function handleScroll() {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;

  const scrollPercent = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;

  UI.toggleScrollTopBtn(scrollTop > 300);

  UI.updateScrollProgress(scrollPercent);
}

function startAutoRefresh() {

  if (AppState.autoRefreshInterval) clearInterval(AppState.autoRefreshInterval);

  AppState.autoRefreshInterval = setInterval(async () => {
    if (AppState.currentCity) {
      console.log('🔄 تحديث تلقائي للبيانات...');

      WeatherAPI.clearCache();

      try {
        const data = await WeatherAPI.getForecast(AppState.currentCity);
        UI.updateWeatherDisplay(data, AppState.isCelsius);
        console.log('✅ تم التحديث التلقائي');
      } catch (error) {
        console.error('❌ فشل التحديث التلقائي:', error.message);
      }
    }
  }, 10 * 60 * 1000); 
}

function startThemeCheck() {
  if (AppState.themeCheckInterval) clearInterval(AppState.themeCheckInterval);

  AppState.themeCheckInterval = setInterval(() => {
    if (AppState.isAutoTheme) {
      applyThemeByTime();
    }
  }, 60 * 1000); 
}

function smoothScrollToCard() {
  const card = document.querySelector('.weather-main-card');
  if (card) {

    setTimeout(() => {
      card.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 100);
  }
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve, 
      reject,  
      {
        timeout: 10000,        
        enableHighAccuracy: true, 
        maximumAge: 300000     
      }
    );
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setupTouchScroll() {
  const container = document.getElementById('hourlyContainer');
  if (!container) return;

  let isDown = false;
  let startX;
  let scrollLeft;

  container.addEventListener('mousedown', (e) => {
    isDown = true;
    container.style.cursor = 'grabbing';
    startX = e.pageX - container.offsetLeft;
    scrollLeft = container.scrollLeft;
  });

  container.addEventListener('mouseleave', () => {
    isDown = false;
    container.style.cursor = 'grab';
  });

  container.addEventListener('mouseup', () => {
    isDown = false;
    container.style.cursor = 'grab';
  });

  container.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 2; 
    container.scrollLeft = scrollLeft - walk;
  });

  container.style.cursor = 'grab';
}

window.addEventListener('beforeunload', () => {

  if (AppState.autoRefreshInterval) clearInterval(AppState.autoRefreshInterval);
  if (AppState.themeCheckInterval) clearInterval(AppState.themeCheckInterval);

  UI.cleanup();
});

document.addEventListener('DOMContentLoaded', () => {

  if (!WeatherAPI.isProxyConfigured()) {
    console.warn('⚠️ طبقة الاتصال الآمنة غير مهيأة. تأكد من وجود api/weather.js');
  }

  initApp();
});

window.addEventListener('error', (e) => {
  console.error('❌ خطأ عام في التطبيق:', e.message);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('❌ Promise مرفوضة:', e.reason);

  e.preventDefault();
});

const Favorites = {
  KEY: 'skyview_favorite_locations',
  get() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); } catch { return []; }
  },
  save(items) { localStorage.setItem(this.KEY, JSON.stringify(items.slice(0, 30))); },
  key(location) {
    if (Number.isFinite(location?.lat) && Number.isFinite(location?.lon)) {
      return `${Number(location.lat).toFixed(5)}:${Number(location.lon).toFixed(5)}`;
    }
    return `${location?.name || ''}|${location?.country || ''}`.toLowerCase();
  },
  has(location) { return this.get().some(item => this.key(item) === this.key(location)); },
  toggle(location) {
    let items = this.get();
    const key = this.key(location);
    if (items.some(item => this.key(item) === key)) items = items.filter(item => this.key(item) !== key);
    else items.unshift({ ...location, savedAt: Date.now() });
    this.save(items);
    return items;
  },
  remove(location) { this.save(this.get().filter(item => this.key(item) !== this.key(location))); }
};

function getCurrentFavoriteCity() {
  if (AppState.currentLocation && Number.isFinite(AppState.currentLocation.lat) && Number.isFinite(AppState.currentLocation.lon)) {
    return { ...AppState.currentLocation };
  }

  const data = UI.state?.currentData;
  if (!data?.location) return null;
  return {
    name: data.location.name,
    country: data.location.country,
    region: data.location.region || '',
    lat: Number(data.location.lat),
    lon: Number(data.location.lon),
    displayName: `${data.location.name}, ${data.location.country}`,
  };
}

function updateFavoritesUI() {
  const city = getCurrentFavoriteCity();
  const btn = document.getElementById('favoriteCityBtn');
  const icon = document.getElementById('favoriteCityIcon');
  const count = document.getElementById('favoritesCount');
  const list = document.getElementById('favoritesList');
  const empty = document.getElementById('favoritesEmpty');
  const items = Favorites.get();

  if (count) { count.textContent = items.length; count.classList.toggle('has-items', items.length > 0); }
  if (btn) { btn.disabled = !city; btn.classList.toggle('is-favorite', !!city && Favorites.has(city)); btn.title = city && Favorites.has(city) ? 'إزالة من المفضلة' : 'إضافة للمفضلة'; }
  if (icon) icon.className = city && Favorites.has(city) ? 'fas fa-heart' : 'far fa-heart';

  if (list) {
    list.innerHTML = '';
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'favorite-item';
      const main = document.createElement('button');
      main.className = 'favorite-item-main';
      main.innerHTML = `<strong>${UI.escapeHTML(item.name)}</strong><span>${UI.escapeHTML([item.region, item.country].filter(Boolean).join(' • '))}</span>`;
      main.addEventListener('click', () => {
        document.getElementById('favoritesPanel')?.classList.add('hidden');
        handleSearch(item);
      });
      const remove = document.createElement('button');
      remove.className = 'favorite-remove';
      remove.title = 'إزالة';
      remove.innerHTML = '<i class="fas fa-trash"></i>';
      remove.addEventListener('click', () => { Favorites.remove(item); updateFavoritesUI(); });
      row.append(main, remove);
      list.appendChild(row);
    });
  }

  if (empty) empty.style.display = items.length ? 'none' : 'block';
}

const originalUpdateWeatherDisplay = UI.updateWeatherDisplay.bind(UI);
UI.updateWeatherDisplay = function(...args) {
  const result = originalUpdateWeatherDisplay(...args);
  updateFavoritesUI();
  return result;
};

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('favoritesToggle');
  const panel = document.getElementById('favoritesPanel');
  const close = document.getElementById('favoritesClose');
  const cityBtn = document.getElementById('favoriteCityBtn');
  toggle?.addEventListener('click', () => { panel?.classList.toggle('hidden'); updateFavoritesUI(); });
  close?.addEventListener('click', () => panel?.classList.add('hidden'));
  cityBtn?.addEventListener('click', () => { const city = getCurrentFavoriteCity(); if (city) { Favorites.toggle(city); updateFavoritesUI(); } });
  updateFavoritesUI();
});

(function initSectionNavigation(){
  const navLinks = document.getElementById('sectionNavLinks');
  const links = [...document.querySelectorAll('.section-nav-link[data-section-target]')];
  if (!navLinks || !links.length) return;

  const targets = links
    .map(link => document.getElementById(link.dataset.sectionTarget))
    .filter(Boolean);

  let activeId = '';
  let rafId = 0;
  let userScrolling = false;
  let scrollStopTimer = 0;

  const setActive = (id, center = false) => {
    if (!id || id === activeId) return;
    activeId = id;
    links.forEach(link => {
      const isActive = link.dataset.sectionTarget === id;
      link.classList.toggle('active', isActive);
      if (isActive) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });

    if (center) {
      const activeLink = links.find(link => link.dataset.sectionTarget === id);
      if (activeLink) {
        const left = activeLink.offsetLeft - (navLinks.clientWidth - activeLink.offsetWidth) / 2;
        navLinks.scrollTo({ left: Math.max(0, left), behavior: userScrolling ? 'auto' : 'smooth' });
      }
    }
  };

  const observer = new IntersectionObserver(entries => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible[0]) setActive(visible[0].target.id, true);
    });
  }, {
    rootMargin: '-18% 0px -62% 0px',
    threshold: [0.1, 0.35, 0.65]
  });

  targets.forEach(target => observer.observe(target));

  links.forEach(link => {
    link.addEventListener('click', () => {
      userScrolling = false;
      setActive(link.dataset.sectionTarget, true);
    });
  });

  window.addEventListener('scroll', () => {
    userScrolling = true;
    clearTimeout(scrollStopTimer);
    scrollStopTimer = setTimeout(() => { userScrolling = false; }, 100);
  }, { passive: true });
})();
