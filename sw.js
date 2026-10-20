/* Permite abrir la aplicación sin internet. Los datos se guardan aparte, cifrados, en el almacenamiento del navegador. */
var VERSION = 'estudios-v1.1.0';
var FILES = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'css/app.css',
  'js/diag.js', 'js/vendor/firebase-app-compat.js', 'js/vendor/firebase-auth-compat.js', 'js/vendor/firebase-firestore-compat.js',
  'js/vendor/jspdf.umd.min.js', 'js/vendor/jspdf.plugin.autotable.min.js',
  'js/nube.js', 'js/app.js', 'img/logo.png', 'img/logo-doc.png', 'img/icon-192.png', 'img/icon-512.png',
  'img/icon-maskable-192.png', 'img/icon-maskable-512.png', 'img/apple-touch-icon.png', 'img/favicon.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase y Google nunca pasan por la caché
  // Red primero (una actualización publicada se ve al recargar); sin conexión, la copia guardada.
  var net = Promise.race([fetch(req, { cache: 'no-cache' }), new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, 5000); })]);
  e.respondWith(net.then(function (res) {
    if (res && res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); });
  }));
});
