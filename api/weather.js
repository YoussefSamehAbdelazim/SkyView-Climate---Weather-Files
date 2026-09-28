

const WEATHER_API_BASE = 'https://api.weatherapi.com/v1';

const CACHE_TTL_MS = 5 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 30;
const SEARCH_RATE_LIMIT = 15;

const inMemoryCache = new Map();
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

function getParam(url, name) {
  return (url.searchParams.get(name) || '').trim();
}

function normalizeQuery(value) {
  return value.replace(/\s+/g, ' ').slice(0, 120);
}

function normalizeType(value) {
  return value.toLowerCase() === 'search'
    ? 'search'
    : 'forecast';
}

function clampDays(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return 3;
  }

  return Math.min(Math.max(parsed, 1), 14);
}

function normalizeLang(value) {
  return value.toLowerCase() === 'en'
    ? 'en'
    : 'ar';
}

function makeCacheKey(type, params) {
  return [
    type,
    params.q,
    params.days,
    params.aqi,
    params.alerts,
    params.lang,
  ].join(':');
}

function getClientIp(request) {
  const forwarded = request.headers
    .get('x-forwarded-for')
    ?.split(',')[0]
    ?.trim();

  return forwarded || 'unknown';
}

function isRateLimited(ip, type) {
  const now = Date.now();

  const limit =
    type === 'search'
      ? SEARCH_RATE_LIMIT
      : RATE_LIMIT;

  const existing = requestBuckets.get(ip);

  if (
    !existing ||
    now - existing.startedAt >= RATE_WINDOW_MS
  ) {
    requestBuckets.set(ip, {
      startedAt: now,
      count: 1,
    });

    return false;
  }

  existing.count += 1;

  return existing.count > limit;
}

function cleanupRateBuckets() {
  const now = Date.now();

  for (const [ip, bucket] of requestBuckets) {
    if (
      now - bucket.startedAt >=
      RATE_WINDOW_MS * 2
    ) {
      requestBuckets.delete(ip);
    }
  }
}

async function readUpstreamJson(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: {
        message:
          'Invalid response from weather service.',
      },
    };
  }
}

export async function GET(request) {
  cleanupRateBuckets();

  const rawApiKey =
    process.env.WEATHER_API_KEY;

  const apiKey =
    typeof rawApiKey === 'string'
      ? rawApiKey.trim()
      : '';

  if (!apiKey) {
    return json(
      {
        error: {
          code: 2006,
          message:
            'Weather service is not configured.',
        },
      },
      500
    );
  }

  const url = new URL(request.url);

  const type = normalizeType(
    getParam(url, 'type')
  );

  const q = normalizeQuery(
    getParam(url, 'q')
  );

  if (!q || q.length < 2) {
    return json(
      {
        error: {
          code: 1003,
          message:
            'A valid location is required.',
        },
      },
      400
    );
  }

  const clientIp =
    getClientIp(request);

  if (
    isRateLimited(
      clientIp,
      type
    )
  ) {
    return json(
      {
        error: {
          code: 429,
          message:
            'Too many requests. Please wait a moment and try again.',
        },
      },
      429,
      'no-store'
    );
  }

  const params = {
    q,

    days: clampDays(
      getParam(url, 'days')
    ),

    aqi:
      getParam(url, 'aqi')
        .toLowerCase() === 'no'
        ? 'no'
        : 'yes',

    alerts:
      getParam(url, 'alerts')
        .toLowerCase() === 'no'
        ? 'no'
        : 'yes',

    lang: normalizeLang(
      getParam(url, 'lang')
    ),
  };

  const cacheKey =
    makeCacheKey(
      type,
      params
    );

  const cached =
    inMemoryCache.get(
      cacheKey
    );

  if (
    cached &&
    Date.now() -
      cached.timestamp <
      CACHE_TTL_MS
  ) {
    return json(
      cached.payload,
      200,
      'public, max-age=300, s-maxage=300'
    );
  }

  const endpoint =
    type === 'search'
      ? 'search.json'
      : 'forecast.json';

  const upstreamUrl =
    new URL(
      `${WEATHER_API_BASE}/${endpoint}`
    );

  upstreamUrl.searchParams.set(
    'key',
    apiKey
  );

  upstreamUrl.searchParams.set(
    'q',
    params.q
  );

  if (
    type === 'forecast'
  ) {
    upstreamUrl.searchParams.set(
      'days',
      String(params.days)
    );

    upstreamUrl.searchParams.set(
      'aqi',
      params.aqi
    );

    upstreamUrl.searchParams.set(
      'alerts',
      params.alerts
    );

    upstreamUrl.searchParams.set(
      'lang',
      params.lang
    );
  }

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () =>
        controller.abort(),
      12000
    );

  try {
    const upstream =
      await fetch(
        upstreamUrl.toString(),
        {
          method: 'GET',

          signal:
            controller.signal,

          headers: {
            Accept:
              'application/json',
          },
        }
      );

    const payload =
      await readUpstreamJson(
        upstream
      );

    if (
      !upstream.ok
    ) {
      return json(
        payload,
        upstream.status
      );
    }

    inMemoryCache.set(
      cacheKey,
      {
        timestamp:
          Date.now(),

        payload,
      }
    );

    return json(
      payload,
      200,
      'public, max-age=300, s-maxage=300'
    );

  } catch (error) {
    const isTimeout =
      error?.name ===
      'AbortError';

    return json(
      {
        error: {
          code: 503,

          message:
            isTimeout
              ? 'Weather service request timed out.'
              : 'Weather service is temporarily unavailable.',
        },
      },

      isTimeout
        ? 504
        : 503
    );

  } finally {
    clearTimeout(
      timeoutId
    );
  }
}
