const CACHE = "namecard-v2";
const SHELL = ["./", "index.html", "qrcode.js", "manifest.webmanifest", "icon.svg"];

self.addEventListener("install", e => {
  // 하나라도 못 받으면 설치 실패 → 다음 방문에 다시 시도 (반쪽짜리 캐시 방지)
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// 캐시 우선(오프라인·느린 망에서도 즉시 표시) + 뒤에서 최신본으로 갱신. 다음 실행 때 새 버전이 적용됩니다.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true }) || (req.mode === "navigate" ? await cache.match("index.html") : null);
    const refresh = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(refresh); return hit; }
    return (await refresh) || Response.error();
  })());
});
