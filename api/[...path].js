const https = require('https');

const API_TARGET = 'act.tmlyun.com';
const API_PREFIX = '/activity-api/vote/h5';

module.exports = (req, res) => {
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

  const reqUrl = req.url || '';
  const qIndex = reqUrl.indexOf('?');
  const pathname = qIndex >= 0 ? reqUrl.slice(0, qIndex) : reqUrl;
  const queryString = qIndex >= 0 ? reqUrl.slice(qIndex) : '';
  const targetPath = pathname.replace(/^\/api/, '');
  const fullUrl = API_PREFIX + targetPath + queryString;

  const headers = {};
  for (const key of Object.keys(req.headers)) {
    const lowerKey = key.toLowerCase();
    if (['host', 'content-length', 'accept-encoding', 'connection', 'origin', 'referer'].includes(lowerKey)) continue;
    headers[key] = req.headers[key];
  }
  headers['host'] = API_TARGET;
  headers['origin'] = 'https://' + API_TARGET;
  headers['referer'] = 'https://' + API_TARGET + '/';
  headers['accept'] = 'application/json';
  headers['user-agent'] = headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

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

  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    if (body) {
      proxyReq.setHeader('content-length', Buffer.byteLength(body));
      proxyReq.write(body);
    }
    proxyReq.end();
  });
};
