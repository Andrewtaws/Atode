// Atode prototype: onboarding and add a worry.
// Everything stays on this device (localStorage). Nothing is sent anywhere.

(function () {
  "use strict";

  var STORE_KEY = "atode.prototype.v2";
  var SCREENS = ["welcome", "how", "time", "worry", "ticket", "help", "home", "add", "quick", "soon"];

  var state = load();

  function load() {
    var fallback = { time: "18:00", reminder: true, worries: [], ticketCount: 0, onboarded: false, current: null, refocus: null };
    try {
      var saved = JSON.parse(localStorage.getItem(STORE_KEY));
      return saved ? Object.assign(fallback, saved) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }

  function reset() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
  }

  // "18:00" -> "6pm", "19:30" -> "7:30pm"
  function timeLabel(hhmm) {
    var parts = hhmm.split(":");
    var h = parseInt(parts[0], 10);
    var m = parts[1];
    var suffix = h >= 12 ? "pm" : "am";
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + (m === "00" ? "" : ":" + m) + suffix;
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function announce(msg) {
    var el = $("#announcer");
    el.textContent = "";
    setTimeout(function () { el.textContent = msg; }, 50);
  }

  function currentWorry() {
    for (var i = 0; i < state.worries.length; i++) {
      if (state.worries[i].ticket === state.current) return state.worries[i];
    }
    return null;
  }

  function renderTime() {
    $all("[data-time-label]").forEach(function (el) { el.textContent = timeLabel(state.time); });
    $all("[data-time-24]").forEach(function (el) { el.textContent = state.time; });
    $all("[data-reminder-status]").forEach(function (el) {
      el.textContent = state.reminder ? "Reminder on" : "Reminder off";
    });
  }

  // Routing: one section per Figma frame, switched by the URL hash so the
  // browser back button works and moderators can deep link to a screen.
  // #reset clears the device and starts onboarding again (for moderators).

  function show(id) {
    if (id === "reset") {
      reset();
      // Load the page again without a hash. Changing only the hash and then
      // reloading can reload "#reset" again in some browsers and loop.
      location.replace(location.pathname + location.search);
      return;
    }
    if (SCREENS.indexOf(id) === -1) id = "welcome";
    if (id === "ticket" && !currentWorry()) id = state.worries.length ? "home" : "worry";

    SCREENS.forEach(function (s) { $("#" + s).hidden = s !== id; });
    var screen = $("#" + id);
    document.title = screen.dataset.title + " · Atode";

    if (id === "ticket") renderTicket();
    if (id === "home" && !state.onboarded) { state.onboarded = true; save(); }
    // Leaving the add flow drops any half-finished edit.
    if (id === "home" || id === "add") {
      $all(".park-form").forEach(function (f) {
        if (f.dataset.editing) { delete f.dataset.editing; fillParkForm(f, null); }
      });
    }
    $all("[data-error]", screen).forEach(function (el) { el.hidden = true; });

    window.scrollTo(0, 0);
    var h1 = $("h1", screen);
    if (h1 && document.readyState === "complete") h1.focus({ preventScroll: true });
  }

  function current() { return location.hash.replace("#", "") || "welcome"; }

  function go(id) {
    if (current() === id) show(id);
    else location.hash = id;
  }

  window.addEventListener("hashchange", function () { show(current()); });

  // Back buttons: go back in history if we came from inside the app.
  var visited = 0;
  window.addEventListener("hashchange", function () { visited++; });
  $all("[data-back]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (visited > 0) history.back();
      else go(state.worries.length ? "home" : "welcome");
    });
  });

  // Onboarding 3. Collection time

  var timeForm = $("#time-form");
  var otherWrap = $("#other-time");
  var otherInput = $("#other-time-input");

  function syncTimeForm() {
    var picked = $("input[name=time]:checked", timeForm).value;
    otherWrap.hidden = picked !== "other";
    state.time = picked === "other" ? (otherInput.value || "19:00") : picked;
    renderTime();
  }

  // Restore saved choice
  (function () {
    var preset = $("input[name=time][value='" + state.time + "']", timeForm);
    if (preset) preset.checked = true;
    else {
      $("input[name=time][value=other]", timeForm).checked = true;
      otherInput.value = state.time;
    }
    $("#reminder").checked = state.reminder;
    syncTimeForm();
  })();

  timeForm.addEventListener("change", function (e) {
    if (e.target.name === "time" || e.target === otherInput) syncTimeForm();
    if (e.target.id === "reminder") {
      state.reminder = e.target.checked;
      renderTime();
      announce(state.reminder ? "Reminder on" : "Reminder off");
    }
  });
  otherInput.addEventListener("input", syncTimeForm);

  timeForm.addEventListener("submit", function (e) {
    e.preventDefault();
    syncTimeForm();
    save();
    go("worry");
  });

  // Parking a worry: onboarding step 2 (#worry) and Quick add (#quick)
  // share the same form behaviour.

  function fillParkForm(form, worry) {
    $all("input[name=topic]", form).forEach(function (r) {
      r.checked = !!worry && r.value === worry.topic;
    });
    $("[data-words]", form).value = worry ? worry.words : "";
  }

  $all(".park-form").forEach(function (form) {
    var error = $("[data-error]", form);

    form.addEventListener("change", function () { error.hidden = true; });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var topicInput = $("input[name=topic]:checked", form);
      var text = $("[data-words]", form).value.trim();
      if (!topicInput && !text) {
        error.hidden = false;
        $("input[name=topic]", form).focus();
        return;
      }
      var topic = topicInput ? topicInput.value : "Something else";
      var editing = form.dataset.editing ? currentWorry() : null;

      if (editing) {
        editing.topic = topic;
        editing.words = text;
      } else {
        state.ticketCount += 1;
        state.worries.push({
          ticket: state.ticketCount,
          topic: topic,
          words: text,
          parkedAt: new Date().toISOString(),
          source: form.dataset.source
        });
        state.current = state.ticketCount;
      }
      delete form.dataset.editing;
      state.refocus = null;
      save();
      fillParkForm(form, null);
      go("ticket");
    });
  });

  // Ticket

  function renderTicket() {
    var worry = currentWorry();
    $("[data-ticket-no]").textContent = worry.ticket;
    $("[data-ticket-topic]").textContent = worry.topic;
    $("[data-edit]").setAttribute("href", "#" + worry.source);
    $all("input[name=refocus]").forEach(function (r) { r.checked = r.value === state.refocus; });
  }

  // Edit keeps the worry and goes back to the form it came from, filled in.
  $("[data-edit]").addEventListener("click", function () {
    var worry = currentWorry();
    var form = $("#" + worry.source + " .park-form");
    fillParkForm(form, worry);
    form.dataset.editing = "true";
  });

  $("[data-undo]").addEventListener("click", function () {
    var worry = currentWorry();
    state.worries = state.worries.filter(function (w) { return w !== worry; });
    if (state.ticketCount === worry.ticket) state.ticketCount -= 1;
    state.current = null;
    save();
    var form = $("#" + worry.source + " .park-form");
    fillParkForm(form, null);
    delete form.dataset.editing;
    go(worry.source);
    announce("Ticket removed. Nothing new is parked.");
  });

  $("#ticket").addEventListener("change", function (e) {
    if (e.target.name === "refocus") { state.refocus = e.target.value; save(); }
  });

  // Returning users skip onboarding and land on home.
  var start = location.hash ? current() : (state.onboarded ? "home" : "welcome");
  if (!location.hash && start === "home") history.replaceState(null, "", "#home");
  show(start);
  window.addEventListener("load", function () {
    if (start !== "welcome") { var h1 = $("#" + start + " h1"); if (h1) h1.focus({ preventScroll: true }); }
  });
})();
