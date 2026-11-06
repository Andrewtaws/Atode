// Atode service worker: only here so reminders can be shown and tapped.
// No fetch handler and no caching, so it never serves an old copy of the app.

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });

function todayKey() {
  var d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

self.addEventListener("notificationclick", function (e) {
  e.notification.close();

  // "Not today": remember it, so the in-app card stays away too.
  // The service worker can't read localStorage, so the flag goes in Cache Storage.
  if (e.action === "later") {
    e.waitUntil(caches.open("atode-flags").then(function (c) {
      return c.put("skip-day", new Response(todayKey()));
    }).then(function () {
      return self.clients.matchAll({ type: "window", includeUncontrolled: true });
    }).then(function (list) {
      list.forEach(function (c) { c.postMessage({ type: "atode-skip-today" }); });
    }));
    return;
  }

  var url = new URL((e.notification.data && e.notification.data.url) || "./#review", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.indexOf(self.registration.scope) === 0 && "focus" in list[i]) {
        list[i].postMessage({ type: "atode-open-review" });
        return list[i].focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
