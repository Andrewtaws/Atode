// Atode prototype: onboarding and add a worry.
// Everything stays on this device (localStorage). Nothing is sent anywhere.

(function () {
  "use strict";

  var STORE_KEY = "atode.hifi.v1";
  var SCREENS = ["welcome", "how", "time", "worry", "ticket", "help", "home", "add", "quick", "review", "review-item", "review-act", "review-done", "soon"];

  var state = load();

  function load() {
    var fallback = { time: "18:00", reminder: true, worries: [], ticketCount: 0, onboarded: false, current: null, refocus: null, reviewing: null, lastOutcome: null, tab: "today" };
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

  // Screens visited, so a return to the previous one animates as "back".
  var trail = [];
  var swapTimer = null;
  var LEAVE_MS = 180; // matches --motion-leave in tokens.css

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
    if ((id === "review-item" || id === "review-act") && !reviewingWorry()) id = "review";
    if (id === "review-done" && !state.lastOutcome) id = "review";

    var previous = trail[trail.length - 1];
    var back = trail.length > 1 && trail[trail.length - 2] === id;
    if (back) trail.pop();
    else if (previous !== id) trail.push(id);

    var screen = $("#" + id);
    document.title = screen.dataset.title + " · Atode";

    if (id === "ticket") renderTicket();
    if (id === "review") renderReview();
    if (id === "review-item" || id === "review-act") renderReviewItem(screen, id);
    if (id === "review-done") renderDone();
    if (id === "home" && !state.onboarded) { state.onboarded = true; save(); }
    // Leaving the add flow drops any half-finished edit.
    if (id === "home" || id === "add") {
      $all(".park-form").forEach(function (f) {
        if (f.dataset.editing) { delete f.dataset.editing; fillParkForm(f, null); }
      });
    }
    $all("[data-error]", screen).forEach(function (el) { el.hidden = true; });

    // Page transition: the old screen fades out, then the new one eases in
    // (from the right going forward, from the left going back).
    var outgoing = previous && previous !== id ? $("#" + previous) : null;
    clearTimeout(swapTimer);
    function swap() {
      SCREENS.forEach(function (s) {
        var el = $("#" + s);
        el.hidden = s !== id;
        el.classList.remove("leave");
      });
      if (outgoing) {
        screen.classList.remove("enter", "enter-back");
        void screen.offsetWidth; // restart the animation
        screen.classList.add(back ? "enter-back" : "enter");
      }
      window.scrollTo(0, 0);
      var h1 = $("h1", screen);
      if (h1 && document.readyState === "complete") h1.focus({ preventScroll: true });
    }
    if (outgoing && !outgoing.hidden) {
      outgoing.classList.add("leave");
      swapTimer = setTimeout(swap, LEAVE_MS);
    } else {
      swap();
    }
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

  // Review worries: a list of parked worries, then one worry at a time.
  // A reviewed worry gets an outcome and moves to "Passed worries".

  var OUTCOMES = {
    faded: "Doesn’t affect me now",
    action: "I can do something",
    letgo: "I can’t control this"
  };

  function parkedWorries() {
    return state.worries.filter(function (w) { return !w.outcome; });
  }

  function reviewingWorry() {
    for (var i = 0; i < state.worries.length; i++) {
      if (state.worries[i].ticket === state.reviewing && !state.worries[i].outcome) return state.worries[i];
    }
    return null;
  }

  function worryText(w) { return w.words || w.topic; }

  function countText(n) {
    if (n === 0) return "Nothing is parked right now.";
    return "You have parked " + n + (n === 1 ? " worry" : " worries") + ", select one to review and add any comments.";
  }

  function setTab(tab) {
    state.tab = tab;
    $all("#review [data-tab]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.tab === tab)); });
    $all("#review [data-panel]").forEach(function (p) { p.hidden = p.dataset.panel !== tab; });
  }

  function renderReview() {
    var parked = parkedWorries();
    var passed = state.worries.filter(function (w) { return w.outcome; });
    $all("[data-review-count]").forEach(function (el) { el.textContent = countText(parked.length); });
    $("[data-passed-count]").textContent = passed.length ? "Worries you’ve already looked at." : "Worries you look at will show here.";

    var today = $("[data-list=today]");
    today.innerHTML = "";
    parked.forEach(function (w) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "worry-item card";
      btn.textContent = worryText(w);
      if (w.words) {
        var meta = document.createElement("span");
        meta.className = "worry-meta";
        meta.textContent = w.topic;
        btn.appendChild(meta);
      }
      btn.addEventListener("click", function () {
        state.reviewing = w.ticket;
        save();
        go("review-item");
      });
      li.appendChild(btn);
      today.appendChild(li);
    });

    var list = $("[data-list=passed]");
    list.innerHTML = "";
    passed.forEach(function (w) {
      var li = document.createElement("li");
      li.className = "worry-item card";
      li.appendChild(document.createTextNode(worryText(w)));
      var meta = document.createElement("span");
      meta.className = "worry-meta";
      meta.textContent = OUTCOMES[w.outcome];
      li.appendChild(meta);
      if (w.note) {
        var note = document.createElement("span");
        note.className = "worry-note";
        note.textContent = "Note: " + w.note;
        li.appendChild(note);
      }
      list.appendChild(li);
    });
    setTab(state.tab || "today");
  }

  $all("#review [data-tab]").forEach(function (b) {
    b.addEventListener("click", function () { setTab(b.dataset.tab); save(); });
  });

  function renderReviewItem(screen, id) {
    var w = reviewingWorry();
    var parked = parkedWorries();
    $all("[data-review-count]", screen).forEach(function (el) { el.textContent = countText(parked.length); });
    $all("[data-review-words]", screen).forEach(function (el) { el.textContent = w.words || "No words added."; });
    var topic = $("[data-review-topic]", screen);
    if (topic) topic.textContent = w.topic;
    var pos = $("[data-review-position]", screen);
    if (pos) pos.textContent = "Worry " + (parked.indexOf(w) + 1) + " of " + parked.length;
    if (id === "review-act") {
      var form = $("#act-form");
      $all("input[name=outcome]", form).forEach(function (r) { r.checked = false; });
      $("#review-note").value = w.note || "";
    }
  }

  // "No": it doesn't affect me now, so it has faded.
  $("[data-affect=no]").addEventListener("click", function () {
    finishReview("faded", reviewingWorry().note || "");
  });

  var actForm = $("#act-form");
  actForm.addEventListener("change", function () { $("[data-error]", actForm).hidden = true; });
  actForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var picked = $("input[name=outcome]:checked", actForm);
    if (!picked) {
      $("[data-error]", actForm).hidden = false;
      $("input[name=outcome]", actForm).focus();
      return;
    }
    finishReview(picked.value, $("#review-note").value.trim());
  });

  function finishReview(outcome, note) {
    var w = reviewingWorry();
    w.note = note;
    if (outcome !== "again") {
      w.outcome = outcome;
      w.reviewedAt = new Date().toISOString();
    }
    state.lastOutcome = outcome;
    state.reviewing = null;
    save();
    go("review-done");
  }

  var FOCUS = "Want something else to focus on? Take 5 slow breaths · Go for a short walk · Text someone · Put on a song · Get back to what you were doing";

  function renderDone() {
    var t = timeLabel(state.time);
    var copy = {
      letgo: ["Saved.", "You can let this one go for now. Some worries are out of our hands.", "Atode will keep it, so you don’t have to.", FOCUS],
      action: ["Saved.", "You’ve spotted something you can do. Your note is kept with this worry.", "Pick one small step, and do it when you’re ready.", FOCUS],
      faded: ["Saved.", "This one doesn’t affect you now. Many worries fade by the time you collect them, and that’s the point.", FOCUS],
      again: ["Saved.", "It’s parked again. Atode will hold it till " + t + " tomorrow.", FOCUS]
    }[state.lastOutcome];
    var box = $("[data-done-copy]");
    box.innerHTML = "";
    copy.forEach(function (line) {
      var p = document.createElement("p");
      p.textContent = line;
      box.appendChild(p);
    });
    // Done goes back to the list while anything is left to look at.
    $("[data-done-next]").setAttribute("href", parkedWorries().length && state.lastOutcome !== "again" ? "#review" : "#home");
  }

  // Returning users skip onboarding and land on home.
  var start = location.hash ? current() : (state.onboarded ? "home" : "welcome");
  if (!location.hash && start === "home") history.replaceState(null, "", "#home");
  show(start);
  // Loading screen: hold the logo briefly, then fade it away.
  var splash = $("#splash");
  if (splash) {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(function () {
      splash.classList.add("splash-out");
      setTimeout(function () { splash.remove(); }, reduce ? 0 : 400);
    }, reduce ? 600 : 1300);
  }

  window.addEventListener("load", function () {
    if (start !== "welcome") { var h1 = $("#" + start + " h1"); if (h1) h1.focus({ preventScroll: true }); }
  });
})();
