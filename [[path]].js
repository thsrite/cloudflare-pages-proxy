/**
 * =================================================================
 *  Cloudflare Pages Function - License 反向代理
 * =================================================================
 *  功能：
 *  - 路径白名单（由 _routes.json 控制）
 *  - IP/地区黑名单
 *  - 频率限制（防DDoS）
 *  - 纯反向代理
 *
 *  注意：
 *  - 路径过滤已在 _routes.json 中配置，无需在此重复
 *  - 此 Function 专注于安全检查和请求转发
 * =================================================================
 */

// ================== 配置区域 ==================

const CONFIG = {
  // 🔧 后端服务器地址（修改为您的后端地址）
  upstream: 'https://www.baidu.com',

  // 🔧 IP 黑名单（可选）
  blocked_ip: [],

  // 🔧 地区黑名单（可选，ISO 3166-1 alpha-2 代码）
  blocked_region: [],

  // ✅ 频率限制
  rateLimit: {
    enabled: true,
    maxRequests: 30,      // 每分钟最大请求数
    windowSeconds: 60,
  },

  // ✅ 日志开关
  enableLog: true,
};

// ================== 核心功能 ==================

// ✅ 频率限制检查
async function checkRateLimit(ip, env) {
  if (!CONFIG.rateLimit.enabled) return true;

  const cache = caches.default;
  const cacheKey = new Request(`https://ratelimit/${ip}`);
  const now = Date.now();

  try {
    const cached = await cache.match(cacheKey);

    if (!cached) {
      const data = { count: 1, timestamp: now };
      await cache.put(
        cacheKey,
        new Response(JSON.stringify(data), {
          headers: { 'Cache-Control': `max-age=${CONFIG.rateLimit.windowSeconds}` },
        })
      );
      return true;
    }

    const data = await cached.json();
    const windowStart = now - CONFIG.rateLimit.windowSeconds * 1000;

    if (data.timestamp < windowStart) {
      const newData = { count: 1, timestamp: now };
      await cache.put(
        cacheKey,
        new Response(JSON.stringify(newData), {
          headers: { 'Cache-Control': `max-age=${CONFIG.rateLimit.windowSeconds}` },
        })
      );
      return true;
    }

    if (data.count >= CONFIG.rateLimit.maxRequests) {
      return false;
    }

    const newData = { count: data.count + 1, timestamp: data.timestamp };
    await cache.put(
      cacheKey,
      new Response(JSON.stringify(newData), {
        headers: { 'Cache-Control': `max-age=${CONFIG.rateLimit.windowSeconds}` },
      })
    );

    return true;
  } catch (error) {
    console.error('Rate limit error:', error);
    return true;
  }
}

// 📝 日志输出
function log(level, message, data = {}) {
  if (!CONFIG.enableLog) return;
  console.log(JSON.stringify({ level, message, ...data, time: new Date().toISOString() }));
}

// ================== 主处理函数 ==================

export async function onRequest(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const region = request.headers.get('CF-IPCountry') || 'unknown';

  // 1. IP 黑名单
  if (CONFIG.blocked_ip.includes(clientIP)) {
    log('warn', 'IP blocked', { ip: clientIP });
    return new Response('Access denied: IP blocked', { status: 403 });
  }

  // 2. 地区黑名单
  if (CONFIG.blocked_region.includes(region)) {
    log('warn', 'Region blocked', { ip: clientIP, region });
    return new Response('Access denied: Region blocked', { status: 403 });
  }

  // 3. 构建请求路径（路径白名单已由 _routes.json 控制）
  const pathArray = context.params.path || [];
  const path = pathArray.length > 0 ? '/' + pathArray.join('/') : '/';

  // 4. 频率限制
  const rateLimitOk = await checkRateLimit(clientIP, env);
  if (!rateLimitOk) {
    log('warn', 'Rate limit exceeded', { ip: clientIP, path });
    return new Response('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': CONFIG.rateLimit.windowSeconds.toString() },
    });
  }

  // 5. 转发到上游（纯反向代理）
  const requestUrl = new URL(request.url);
  const upstream_url = new URL(CONFIG.upstream);
  upstream_url.pathname = path;
  upstream_url.search = requestUrl.search;

  const new_request = new Request(upstream_url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: 'follow',
  });

  // 添加代理头
  new_request.headers.set('X-Forwarded-For', clientIP);
  new_request.headers.set('X-Real-IP', clientIP);
  new_request.headers.set('X-Forwarded-Proto', 'https');

  try {
    const response = await fetch(new_request);

    // 直接返回响应
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-Proxy-By', 'Cloudflare-Pages');

    log('info', 'Request proxied', {
      ip: clientIP,
      method: request.method,
      path,
      status: response.status,
    });

    return newResponse;
  } catch (error) {
    log('error', 'Proxy error', { ip: clientIP, path, error: error.message });
    return new Response('Bad Gateway', { status: 502 });
  }
}
