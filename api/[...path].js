// Vercel Serverless Function - API 反向代理
// 路径: /api/[...path]  ->  https://act.tmlyun.com/activity-api/vote/h5/[...path]
// 作用: 解决浏览器跨域问题，让前端可以直接调用投票官网的 API

const https = require('https');

const API_TARGET = 'act.tmlyun.com';
const API_PREFIX = '/activity-api/vote/h5';

export default function handler(req, res) {
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  // Vercel 将 [...path] 的匹配结果放在 req.query.path 中（数组）
  const pathSegments = Array.isArray(req.query.path)
    ? req.query.path
    : (req.query.path ? [req.query.path] : []);
  const targetPath = '/' + pathSegments.filter(Boolean).join('/');

  // 从 req.query 中重建查询字符串（排除 path 这个 key）
  const queryParams = { ...req.query };
  delete queryParams.path;
  const queryString = Object.keys(queryParams)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(queryParams[k]))
    .join('&');
  const fullUrl = API_PREFIX + targetPath + (queryString ? '?' + queryString : '');

  // 准备转发头：删除会导致问题的头，添加官网需要的头
  const headers = { ...req.headers };
  delete headers['host'];
  delete headers['content-length'];
  delete headers['accept-encoding']; // 不接受压缩，返回明文 JSON
  delete headers['connection'];
  delete headers['origin'];
  delete headers['referer'];
  headers['host'] = API_TARGET;
  headers['origin'] = 'https://' + API_TARGET;
  headers['referer'] = 'https://' + API_TARGET + '/';

  const options = {
    hostname: API_TARGET,
    port: 443,
    path: fullUrl,
    method: req.method,
    headers
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      'Content-Type': proxyRes.headers['content-type'] || 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (e) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: '代理请求失败: ' + e.message }));
  });

  // 转发请求体
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    if (body) proxyReq.write(body);
    proxyReq.end();
  });
}
