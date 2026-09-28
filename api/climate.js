



const OPEN_METEO_ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';

const CACHE_TTL_MS = 30 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 8;
const HEAT_THRESHOLD_C = 35;

const cache = new Map();
const requestBuckets = new Map();

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
};

function json(data, status = 200, cacheControl = 'no-store') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...JSON_HEADERS,
      'Cache-Control': cacheControl,
    },
  });
}

function getClientIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

function cleanupRateBuckets() {
  const now = Date.now();
  for (const [ip, bucket] of requestBuckets) {
    if (now - bucket.startedAt >= RATE_WINDOW_MS * 2) requestBuckets.delete(ip);
  }
}

function isRateLimited(ip) {
  const now = Date.now();
  const bucket = requestBuckets.get(ip);
  if (!bucket || now - bucket.startedAt >= RATE_WINDOW_MS) {
    requestBuckets.set(ip, { startedAt: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT;
}

function finiteNumber(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function clampYears(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(Math.max(parsed, 5), 20);
}

function getPeriod(years) {
  const today = new Date();
  const completeYear = today.getUTCFullYear() - 1;
  const startYear = completeYear - years + 1;
  return {
    start: `${startYear}-01-01`,
    end: `${completeYear}-12-31`,
    startYear,
    endYear: completeYear,
  };
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function round(value, digits = 1) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function analyzeDaily(payload, period) {
  const daily = payload?.daily || {};
  const times = Array.isArray(daily.time) ? daily.time : [];
  const means = Array.isArray(daily.temperature_2m_mean) ? daily.temperature_2m_mean : [];
  const maxes = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max : [];
  const mins = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min : [];
  const rain = Array.isArray(daily.precipitation_sum) ? daily.precipitation_sum : [];

  const annualMap = new Map();
  const monthlyMap = new Map();
  let recordHigh = null;
  let recordLow = null;

  for (let i = 0; i < times.length; i += 1) {
    const date = String(times[i]).slice(0, 10);
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7));
    const mean = Number(means[i]);
    const max = Number(maxes[i]);
    const min = Number(mins[i]);
    const precipitation = Number(rain[i]);

    if (!Number.isFinite(year) || year < period.startYear || year > period.endYear) continue;

    if (!annualMap.has(year)) {
      annualMap.set(year, {
        year,
        meanTemps: [],
        maxTemps: [],
        minTemps: [],
        precipitation: 0,
        precipitationDays: 0,
        extremeHeatDays: 0,
        days: 0,
      });
    }

    const annual = annualMap.get(year);
    if (Number.isFinite(mean)) annual.meanTemps.push(mean);
    if (Number.isFinite(max)) {
      annual.maxTemps.push(max);
      if (max >= HEAT_THRESHOLD_C) annual.extremeHeatDays += 1;
    }
    if (Number.isFinite(min)) annual.minTemps.push(min);
    if (Number.isFinite(precipitation)) {
      annual.precipitation += precipitation;
      if (precipitation > 0.1) annual.precipitationDays += 1;
    }
    annual.days += 1;

    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, {
        month,
        meanTemps: [],
        precipitation: [],
      });
    }
    const monthly = monthlyMap.get(month);
    if (Number.isFinite(mean)) monthly.meanTemps.push(mean);
    if (Number.isFinite(precipitation)) monthly.precipitation.push(precipitation);

    if (Number.isFinite(max) && (!recordHigh || max > recordHigh.value)) {
      recordHigh = { value: max, date };
    }
    if (Number.isFinite(min) && (!recordLow || min < recordLow.value)) {
      recordLow = { value: min, date };
    }
  }

  const annual = Array.from(annualMap.values())
    .sort((a, b) => a.year - b.year)
    .map(item => ({
      year: item.year,
      avgTemp: round(average(item.meanTemps), 2),
      avgHigh: round(average(item.maxTemps), 2),
      avgLow: round(average(item.minTemps), 2),
      precipitation: round(item.precipitation, 1),
      precipitationDays: item.precipitationDays,
      extremeHeatDays: item.extremeHeatDays,
      days: item.days,
    }));

  const monthly = Array.from({ length: 12 }, (_, index) => {
    const item = monthlyMap.get(index + 1);
    return {
      month: index + 1,
      avgTemp: round(average(item?.meanTemps || []), 2),
      avgDailyPrecipitation: round(average(item?.precipitation || []), 2),
    };
  });

  const usableAnnual = annual.filter(item => Number.isFinite(item.avgTemp));
  let slope = null;
  if (usableAnnual.length >= 2) {
    const xMean = average(usableAnnual.map(item => item.year));
    const yMean = average(usableAnnual.map(item => item.avgTemp));
    const numerator = usableAnnual.reduce(
      (sum, item) => sum + (item.year - xMean) * (item.avgTemp - yMean),
      0
    );
    const denominator = usableAnnual.reduce(
      (sum, item) => sum + (item.year - xMean) ** 2,
      0
    );
    slope = denominator ? numerator / denominator : null;
  }

  const totalHeatDays = annual.reduce((sum, item) => sum + (item.extremeHeatDays || 0), 0);
  const totalRain = annual.reduce((sum, item) => sum + (item.precipitation || 0), 0);
  const first = usableAnnual[0] || null;
  const latest = usableAnnual[usableAnnual.length - 1] || null;

  return {
    period: {
      ...period,
      availableDays: times.length,
    },
    annual,
    monthly,
    records: {
      high: recordHigh ? { value: round(recordHigh.value, 1), date: recordHigh.date } : null,
      low: recordLow ? { value: round(recordLow.value, 1), date: recordLow.date } : null,
    },
    heat: {
      thresholdC: HEAT_THRESHOLD_C,
      totalDays: totalHeatDays,
      hottestYear: annual.reduce(
        (best, item) => (!best || item.extremeHeatDays > best.extremeHeatDays ? item : best),
        null
      ),
    },
    rainfall: {
      totalMm: round(totalRain, 1),
      averageAnnualMm: annual.length ? round(totalRain / annual.length, 1) : null,
      wettestYear: annual.reduce(
        (best, item) => (!best || item.precipitation > best.precipitation ? item : best),
        null
      ),
      driestYear: annual.reduce(
        (best, item) => (!best || item.precipitation < best.precipitation ? item : best),
        null
      ),
    },
    trend: {
      slopeCPerYear: round(slope, 3),
      changeC: first && latest ? round(latest.avgTemp - first.avgTemp, 2) : null,
      direction: slope == null ? 'stable' : slope > 0.03 ? 'up' : slope < -0.03 ? 'down' : 'stable',
      firstYear: first?.year || null,
      lastYear: latest?.year || null,
      firstAvg: first?.avgTemp ?? null,
      lastAvg: latest?.avgTemp ?? null,
    },
  };
}

export async function GET(request) {
  cleanupRateBuckets();

  if (isRateLimited(getClientIp(request))) {
    return json(
      { error: { message: 'طلبات المركز المناخي كثيرة حاليًا. حاول مرة أخرى بعد قليل.' } },
      429
    );
  }

  const url = new URL(request.url);
  const lat = finiteNumber(url.searchParams.get('lat'), -90, 90);
  const lon = finiteNumber(url.searchParams.get('lon'), -180, 180);
  const years = clampYears(url.searchParams.get('years'));

  if (lat === null || lon === null) {
    return json({ error: { message: 'إحداثيات الموقع غير صالحة.' } }, 400);
  }

  const period = getPeriod(years);
  const cacheKey = `${lat.toFixed(4)}:${lon.toFixed(4)}:${years}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return json(cached.payload, 200, 'public, max-age=1800, s-maxage=1800');
  }

  const upstreamUrl = new URL(OPEN_METEO_ARCHIVE);
  upstreamUrl.searchParams.set('latitude', String(lat));
  upstreamUrl.searchParams.set('longitude', String(lon));
  upstreamUrl.searchParams.set('start_date', period.start);
  upstreamUrl.searchParams.set('end_date', period.end);
  upstreamUrl.searchParams.set(
    'daily',
    'temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum'
  );
  upstreamUrl.searchParams.set('temperature_unit', 'celsius');
  upstreamUrl.searchParams.set('precipitation_unit', 'mm');
  upstreamUrl.searchParams.set('timezone', 'auto');
  upstreamUrl.searchParams.set('models', 'era5');
  upstreamUrl.searchParams.set('cell_selection', 'land');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(upstreamUrl.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: { message: 'Invalid response from the climate data provider.' } };
    }

    if (!response.ok) {
      return json(
        {
          error: {
            message:
              payload?.reason ||
              payload?.error?.message ||
              'تعذر جلب البيانات المناخية التاريخية.',
          },
        },
        response.status
      );
    }

    const result = analyzeDaily(payload, period);
    const output = {
      ...result,
      location: {
        requestedLat: lat,
        requestedLon: lon,
        gridLat: payload?.latitude ?? lat,
        gridLon: payload?.longitude ?? lon,
        timezone: payload?.timezone || 'auto',
      },
      source: {
        provider: 'Open-Meteo',
        dataset: 'ERA5 reanalysis',
        note: 'البيانات التاريخية إعادة تحليل وليست قراءات محطة رصد مباشرة.',
      },
      generatedAt: new Date().toISOString(),
    };

    cache.set(cacheKey, { timestamp: Date.now(), payload: output });
    return json(output, 200, 'public, max-age=1800, s-maxage=1800');
  } catch (error) {
    const timeout = error?.name === 'AbortError';
    return json(
      {
        error: {
          message: timeout
            ? 'انتهت مهلة الاتصال بمصدر البيانات المناخية.'
            : 'مصدر البيانات المناخية غير متاح حاليًا.',
        },
      },
      timeout ? 504 : 503
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
