// Atode onboarding prototype.
// Everything stays on this device (localStorage). Nothing is sent anywhere.

(function () {
  "use strict";

  var STORE_KEY = "atode.onboarding.v1";
  var SCREENS = ["welcome", "how", "time", "worry", "ticket", "help", "done"];

  var state = load();

  function load() {
    var fallback = { time: "18:00", reminder: true, worry: null, ticketCount: 0, refocus: null };
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

  function renderTime() {
    $all("[data-time-label]").forEach(function (el) { el.textContent = timeLabel(state.time); });
  }

  // Routing: one section per Figma frame, switched by the URL hash so the
  // browser back button works and moderators can deep link to a screen.

  function show(id) {
    if (SCREENS.indexOf(id) === -1) id = "welcome";
    if (id === "ticket" && !state.worry) id = "worry";

    SCREENS.forEach(function (s) { $("#" + s).hidden = s !== id; });
    var screen = $("#" + id);
    document.title = screen.dataset.title + " · Atode";

    if (id === "ticket") renderTicket();
    if (id === "done") renderDone();
    if (id === "worry") $("#worry-error").hidden = true;

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
      else go("welcome");
    });
  });

  // 3. Collection time

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

  // 4. Add first worry

  var worryForm = $("#worry-form");
  var words = $("#words");
  var worryError = $("#worry-error");

  worryForm.addEventListener("change", function () { worryError.hidden = true; });

  worryForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var topicInput = $("input[name=topic]:checked", worryForm);
    var text = words.value.trim();
    if (!topicInput && !text) {
      worryError.hidden = false;
      $("input[name=topic]", worryForm).focus();
      return;
    }
    var editing = !!state.worry;
    if (!editing) state.ticketCount += 1;
    state.worry = {
      topic: topicInput ? topicInput.value : "Something else",
      words: text,
      parkedAt: new Date().toISOString(),
      ticket: state.ticketCount
    };
    save();
    go("ticket");
  });

  function fillWorryForm() {
    $all("input[name=topic]", worryForm).forEach(function (r) {
      r.checked = !!state.worry && r.value === state.worry.topic;
    });
    words.value = state.worry ? state.worry.words : "";
  }
  fillWorryForm();

  // 5. Ticket

  function renderTicket() {
    $("[data-ticket-no]").textContent = state.worry.ticket;
    $("[data-ticket-topic]").textContent = state.worry.topic;
    $all("input[name=refocus]").forEach(function (r) { r.checked = r.value === state.refocus; });
  }

  // Edit keeps the worry and goes back to the form with it filled in.
  $("[data-edit]").addEventListener("click", function () { fillWorryForm(); });

  $("[data-undo]").addEventListener("click", function () {
    state.worry = null;
    state.ticketCount = Math.max(0, state.ticketCount - 1);
    save();
    fillWorryForm();
    go("worry");
    announce("Ticket removed. Nothing is parked.");
  });

  $("#ticket").addEventListener("change", function (e) {
    if (e.target.name === "refocus") { state.refocus = e.target.value; save(); }
  });

  // End

  function renderDone() {
    $("[data-done-summary]").textContent = state.worry
      ? "Atode is holding 1 worry. Collect it at " + timeLabel(state.time) + "."
      : "Nothing parked yet. Your worry time is " + timeLabel(state.time) + ".";
  }

  $("[data-restart]").addEventListener("click", function () {
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    location.hash = "welcome";
    location.reload();
  });

  show(current());
  window.addEventListener("load", function () {
    if (current() !== "welcome") { var h1 = $("#" + current() + " h1"); if (h1) h1.focus({ preventScroll: true }); }
  });
})();
