// Atode worry time reminders: the copy, and how a reminder is shown.
// Used by app.js (scheduling) and design-system.html (copy deck + test button).
//
// Copy rules (see README "Worry time reminders"):
// - An invitation, never an instruction. Every message offers a way out.
// - Never shows a worry, a topic or a count. "Notes", not "worries", so a
//   lock screen or a shoulder-surfer learns nothing.
// - No streaks, no "you missed", no catching up, no exclamation marks, no emoji.
// - Plain words, short sentences. Title carries the point (lock screens cut
//   the body to one line), so titles stay at 34 characters or fewer.
// - Cloakroom voice: we hang on to your notes, you pick them up if you want.

(function () {
  "use strict";

  // {time} becomes "6pm", "7:30pm"...
  var NOTIFICATIONS = [
    { title: "It’s {time}. Your notes are ready", body: "Pick them up if you still want them. If not, that’s fine too." },
    { title: "We’ve kept your notes safe", body: "Collect them when you’re ready. A few minutes is plenty." },
    { title: "Time to collect your notes", body: "Some may not matter now. That’s normal, and it’s the point." },
    { title: "Your notes are where you left them", body: "Have a look now, or leave them for tomorrow." },
    { title: "Still hanging on to your notes", body: "Pick them up now, or we’ll keep them till tomorrow." },
    { title: "Your {time} pick-up", body: "See which notes still matter. You can let go of the rest." },
    { title: "A few minutes for your notes?", body: "Only if it suits you. They’ll keep." }
  ];

  // When notes have waited more than a day. Never says "missed".
  var CARRIED = { title: "Your notes are still here", body: "No catching up needed. Look at one, if that’s all you have time for." };

  // In-app card on Home, for when the app is open at worry time, a
  // notification can't be sent, or it was missed.
  var BANNER = {
    title: "Your notes are ready to collect",
    body: "It’s past {time}. Look at them now, or leave them for tomorrow.",
    go: "Look at my notes",
    skip: "Not today",
    count: "{n} notes waiting",
    countOne: "1 note waiting",
    countNone: "Your notes",
    skipped: "OK. We’ll keep them till {time} tomorrow."
  };

  // Home "Review note time" card, and the line under the switch in onboarding.
  var STATUS = {
    off: "Reminder off",
    on: "Reminder on",
    inApp: "Reminder on, in Atode only",
    ask: "Get a notification too",
    why: {
      denied: "Notifications are blocked for Atode in your browser settings, so you’ll see it when you open Atode.",
      unsupported: "This browser can’t send notifications, so you’ll see it when you open Atode.",
      ios: "To get a notification on iPhone or iPad, add Atode to your Home Screen first.",
      "default": "You’ll see it when you open Atode."
    }
  };

  function fill(s, time) { return s.replace(/\{time\}/g, time); }

  // One message a day, in turn, so it doesn't feel automated. The same day
  // always gets the same message.
  function pick(date, time, carried) {
    var c = carried ? CARRIED : NOTIFICATIONS[dayNumber(date) % NOTIFICATIONS.length];
    return { title: fill(c.title, time), body: fill(c.body, time) };
  }
  function dayNumber(d) {
    return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  }

  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var standalone = navigator.standalone === true ||
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);

  // "granted" | "default" | "denied" | "unsupported" | "ios" (Safari tab: needs Home Screen first)
  function permission() {
    if (!("Notification" in window) || !window.isSecureContext) return isIOS && !standalone ? "ios" : "unsupported";
    return Notification.permission;
  }

  function ask() {
    if (permission() !== "default") return Promise.resolve(permission());
    try {
      var p = Notification.requestPermission();
      return p && p.then ? p : Promise.resolve(Notification.permission);
    } catch (e) {
      return new Promise(function (resolve) { Notification.requestPermission(resolve); });
    }
  }

  var registration = null;
  function register() {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return Promise.resolve(null);
    return navigator.serviceWorker.register("sw.js").then(function (r) { registration = r; return r; }, function () { return null; });
  }

  // Shows one reminder. A service worker is needed on Android (and lets a tap
  // open Atode from a closed tab); desktop browsers can fall back to new Notification().
  function notify(msg) {
    if (permission() !== "granted") return Promise.resolve(false);
    var opts = {
      body: msg.body,
      icon: "assets/icons/icon-192.png",
      badge: "assets/icons/icon-192.png",
      tag: "atode-worry-time",  // a new one replaces the old, so they never pile up
      renotify: false,
      data: { url: "./#review" },
      lang: "en-GB"
    };
    var ready = registration ? Promise.resolve(registration)
      : ("serviceWorker" in navigator ? navigator.serviceWorker.getRegistration() : Promise.resolve(null));
    return ready.then(function (reg) {
      if (reg && reg.showNotification) {
        opts.actions = [{ action: "open", title: "Look now" }, { action: "later", title: "Not today" }];
        return reg.showNotification(msg.title, opts).then(function () { return true; });
      }
      var n = new Notification(msg.title, opts);
      n.onclick = function () { window.focus(); location.hash = "review"; n.close(); };
      return true;
    }).catch(function () { return false; });
  }

  window.AtodeReminders = {
    NOTIFICATIONS: NOTIFICATIONS, CARRIED: CARRIED, BANNER: BANNER, STATUS: STATUS,
    fill: fill, pick: pick, permission: permission, ask: ask, register: register, notify: notify
  };
})();
