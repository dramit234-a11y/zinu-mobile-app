// Development-only gateway for previewing ZINU on a phone through ONE public tunnel address.
// It listens on 127.0.0.1 only; the tunnel (cloudflared) is the single way in from the internet.
//
//   /health, /v1/...            -> ZINU API (:4000), except /v1/admin/... which is refused (admin stays in the browser)
//   /<bucket>/... signed only   -> file storage (:9000): presigned uploads (POST form) and presigned downloads (GET with
//                                  X-Amz-Signature). Unsigned storage requests are refused, so nothing can be listed or read.
//   everything else             -> Expo / Metro (:8081), which serves the app's code to Expo Go
//
// PostgreSQL and Redis are never reachable through it. The Host header is passed through unchanged so presigned
// storage signatures (which include the host) stay valid.
import http from 'node:http';
import net from 'node:net';

const PORT = Number(process.env.GATEWAY_PORT || 8090);
const BUCKET = process.env.S3_BUCKET || 'zinu-dev';
const API = 4000;
const STORAGE = 9000;
const METRO = 8081;
// Metro debugger / editor endpoints are only needed from inside the Codespace, never from the phone.
const METRO_LOCAL_ONLY = ['/json', '/open-debugger', '/open-stack-frame', '/inspector/debug'];

/** Returns the upstream port for a request, or null to refuse it. */
export function route(method, rawUrl, headers) {
  const url = new URL(rawUrl, 'http://gateway');
  const p = url.pathname;
  if (p === '/health') return API;
  if (p === '/v1/admin' || p.startsWith('/v1/admin/')) return null;
  if (p === '/v1' || p.startsWith('/v1/')) return API;
  if (p === `/${BUCKET}` || p.startsWith(`/${BUCKET}/`)) {
    const signedRead = (method === 'GET' || method === 'HEAD') && url.searchParams.has('X-Amz-Signature');
    const signedUpload =
      method === 'POST' && (p === `/${BUCKET}` || p === `/${BUCKET}/`) && /^multipart\/form-data/i.test(headers['content-type'] || '');
    return signedRead || signedUpload ? STORAGE : null;
  }
  if (METRO_LOCAL_ONLY.some((x) => p === x || p.startsWith(`${x}/`))) return null;
  return METRO;
}

function refuse(res) {
  res.writeHead(404, { 'content-type': 'text/plain' }).end('Not available through the preview gateway\n');
}

const server = http.createServer((req, res) => {
  const port = route(req.method, req.url, req.headers);
  if (!port) return refuse(res);
  const up = http.request({ host: '127.0.0.1', port, method: req.method, path: req.url, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.rawHeaders);
    r.pipe(res);
  });
  up.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`Upstream on port ${port} is not running\n`);
  });
  req.pipe(up);
});

// WebSockets (Metro hot reload and dev messages).
server.on('upgrade', (req, socket, head) => {
  const port = route(req.method, req.url, req.headers);
  if (port !== METRO) return socket.destroy();
  const up = net.connect(port, '127.0.0.1', () => {
    let raw = `${req.method} ${req.url} HTTP/1.1\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) raw += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
    up.write(raw + '\r\n');
    if (head?.length) up.write(head);
    up.pipe(socket).pipe(up);
  });
  up.on('error', () => socket.destroy());
  socket.on('error', () => up.destroy());
});

if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(PORT, '127.0.0.1', () => console.log(`preview gateway on http://127.0.0.1:${PORT}`));
}
