// This site has moved into the KR Library. This service worker replaces the old
// offline cache: it deletes every cache, unregisters itself and reloads open tabs,
// so returning visitors reach the redirect page instead of a cached copy of the old app.
self.addEventListener("install", function () {
  self.skipWaiting();
});
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll({ type: "window" }); })
      .then(function (clients) {
        clients.forEach(function (c) { if ("navigate" in c) c.navigate(c.url); });
      })
  );
});
