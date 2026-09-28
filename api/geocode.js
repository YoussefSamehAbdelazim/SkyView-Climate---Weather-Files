
const OPENCAGE_API_URL = 'https://api.opencagedata.com/geocode/v1/json';
const CACHE_TTL_MS = 10 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 30;

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
    headers: { ...JSON_HEADERS, 'Cache-Control': cacheControl },
  });
}

function getClientIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
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

function cleanupRateBuckets() {
  const now = Date.now();
  for (const [ip, bucket] of requestBuckets) {
    if (now - bucket.startedAt >= RATE_WINDOW_MS * 2) requestBuckets.delete(ip);
  }
}

function normalizeQuery(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 160);
}

function makeCacheKey(query) {
  return query.toLowerCase();
}

async function callOpenCage(query, apiKey) {
  const cacheKey = makeCacheKey(query);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return cached.payload;

  const url = new URL(OPENCAGE_API_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('language', 'ar');
  url.searchParams.set('limit', '15');
  url.searchParams.set('no_annotations', '1');
  url.searchParams.set('no_record', '1');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const text = await response.text();
    let payload;
    try { payload = JSON.parse(text); }
    catch { payload = { error: { message: 'Invalid response from geocoding service.' } }; }

    if (!response.ok) {
      const error = new Error(payload?.status?.message || payload?.error?.message || 'Geocoding request failed.');
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    cache.set(cacheKey, { timestamp: Date.now(), payload });
    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(request) {
  cleanupRateBuckets();

  const apiKey = typeof process.env.OPENCAGE_API_KEY === 'string'
    ? process.env.OPENCAGE_API_KEY.trim()
    : '';

  if (!apiKey) {
    return json({ error: { message: 'OpenCage service is not configured.' } }, 500);
  }

  const requestUrl = new URL(request.url);
  const query = normalizeQuery(requestUrl.searchParams.get('q'));

  if (query.length < 2) {
    return json({ error: { message: 'يرجى إدخال اسم مكان مكوّن من حرفين على الأقل.' } }, 400);
  }

  if (isRateLimited(getClientIp(request))) {
    return json({ error: { message: 'طلبات البحث كثيرة جدًا. انتظر لحظة ثم حاول مرة أخرى.' } }, 429);
  }

  try {
    const payload = await callOpenCage(query, apiKey);
    return json(payload, 200, 'public, max-age=60, s-maxage=600');
  } catch (error) {
    const status = error?.name === 'AbortError' ? 504 : (Number(error?.status) || 503);
    return json({
      error: {
        message: error?.name === 'AbortError'
          ? 'انتهت مهلة الاتصال بخدمة البحث الجغرافي.'
          : (error?.payload?.status?.message || error?.message || 'خدمة البحث الجغرافي غير متاحة حاليًا.'),
      },
    }, status);
  }
}
