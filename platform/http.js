// Shared HTTP helpers (platform kernel - used by every domain, owns no business data).
const MAX_BODY = 64 * 1024;

function send(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > MAX_BODY) { reject(new Error('Body too large')); req.destroy(); }
    });
    req.on('end', () => {
      try {
        const v = data ? JSON.parse(data) : {};
        resolve(v && typeof v === 'object' && !Array.isArray(v) ? v : {});
      } catch { reject(new Error('Invalid JSON')); }
    });
  });
}

module.exports = { send, readJson };
