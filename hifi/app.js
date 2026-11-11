// Atode prototype: onboarding, add a worry and review notes.
// Everything stays on this device (localStorage). Nothing is sent anywhere.

(function () {
  "use strict";

  var STORE_KEY = "atode.hifi.v1";
  var SCREENS = ["welcome", "how", "time", "worry", "ticket", "help", "home", "quick", "review", "review-item", "review-act", "review-done", "past-note"];

  var state = load();
  var R = window.AtodeReminders; // reminders.js

  function load() {
    var fallback = { time: "18:00", reminder: true, worries: [], ticketCount: 0, onboarded: false, current: null, refocus: null, reviewing: null, lastOutcome: null, tab: "today", viewing: null, reviewedDay: null, skipDay: null, notifiedDay: null };
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
    clearSkipFlag();
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

  // Errors: shown, tied to their group with aria-describedby (so a screen
  // reader reads it with the first option) and announced (WCAG 3.3.1, 4.1.3).
  function showError(form, focusEl) {
    var error = $("[data-error]", form);
    var group = $("[data-error-group]", form);
    error.hidden = false;
    if (group) {
      var ids = (group.getAttribute("aria-describedby") || "").split(" ").filter(Boolean);
      if (ids.indexOf(error.id) === -1) ids.unshift(error.id);
      group.setAttribute("aria-describedby", ids.join(" "));
      group.setAttribute("aria-invalid", "true");
    }
    focusEl.focus();
    announce(error.textContent);
  }
  function hideError(form) {
    var error = $("[data-error]", form);
    var group = $("[data-error-group]", form);
    if (!error) return;
    error.hidden = true;
    if (group) {
      var ids = (group.getAttribute("aria-describedby") || "").split(" ").filter(function (id) { return id && id !== error.id; });
      if (ids.length) group.setAttribute("aria-describedby", ids.join(" ")); else group.removeAttribute("aria-describedby");
      group.removeAttribute("aria-invalid");
    }
  }

  // Phones, outside onboarding: the help pill sits in the title row (Figma
  // 169:867). When the title can't fit beside it (320px / 400% zoom, larger
  // text spacing, long titles), the pill takes its own row above the title
  // instead of covering it (WCAG 1.4.10, 1.4.12).
  function fitPill(screen) {
    if (!screen || screen.hidden || screen.classList.contains("onb")) return;
    screen.classList.remove("pill-row");
    if (window.innerWidth >= 768) return;
    var h1 = $("h1", screen), pill = $(".help-pill", screen);
    if (!h1 || !pill) return;
    h1.style.overflowWrap = "normal"; // measure whole words, not the break-word fallback
    var p = pill.getBoundingClientRect();
    var range = document.createRange();
    range.selectNodeContents(h1);
    var hit = Array.prototype.some.call(range.getClientRects(), function (t) {
      return t.right > p.left - 4 && t.left < p.right && t.bottom > p.top && t.top < p.bottom;
    });
    if (hit || h1.scrollWidth > h1.clientWidth + 1) screen.classList.add("pill-row");
    h1.style.overflowWrap = "";
  }
  function visibleScreen() {
    for (var i = 0; i < SCREENS.length; i++) { var el = $("#" + SCREENS[i]); if (!el.hidden) return el; }
    return null;
  }
  window.addEventListener("resize", function () { fitPill(visibleScreen()); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitPill(visibleScreen()); });
  if (window.ResizeObserver) {
    // The pill grows with text spacing or text size; refit when it does.
    var pillObserver = new ResizeObserver(function () { fitPill(visibleScreen()); });
    $all(".screen:not(.onb) .help-pill").forEach(function (el) { pillObserver.observe(el); });
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
    renderReminderStatus();
  }

  // Routing: one section per Figma frame, switched by the URL hash so the
  // browser back button works and moderators can deep link to a screen.
  // #reset clears the device and starts onboarding again (for moderators).

  // Screens visited, so a return to the previous one animates as "back".
  var trail = [];
  var swapTimer = null;
  var LEAVE_MS = 180; // matches --motion-leave in tokens.css

  function show(id) {
    if (id === "try-reminder") { tryReminder(); return; }
    if (id === "reset") {
      reset();
      // Load the page again without a hash. Changing only the hash and then
      // reloading can reload "#reset" again in some browsers and loop.
      location.replace(location.pathname + location.search);
      return;
    }
    // Old links: the entry-type screen and the detailed entry were removed.
    if (id === "add") id = "quick";
    if (id === "soon") id = "home";
    if (SCREENS.indexOf(id) === -1) id = "welcome";
    if (id === "ticket" && !currentWorry()) id = state.worries.length ? "home" : "worry";
    if ((id === "review-item" || id === "review-act") && !reviewingWorry()) id = "review";
    if (id === "review-done" && !state.lastOutcome) id = "review";
    if (id === "past-note" && !viewingWorry()) id = "review";

    var previous = trail[trail.length - 1];
    var back = trail.length > 1 && trail[trail.length - 2] === id;
    if (back) trail.pop();
    else if (previous !== id) trail.push(id);

    var screen = $("#" + id);
    document.title = screen.dataset.title + " · Atode";

    if (id === "ticket") renderTicket();
    if (id === "review") { renderReview(); markReviewedToday(); }
    if (id === "home") renderNudge();
    if (id === "review-item" || id === "review-act") renderReviewItem(screen, id);
    if (id === "review-done") renderDone();
    if (id === "past-note") renderPastNote();
    if (id === "home" && !state.onboarded) { state.onboarded = true; save(); }
    // Leaving the add flow drops any half-finished edit.
    if (id === "home") {
      $all(".park-form").forEach(function (f) {
        if (f.dataset.editing) { delete f.dataset.editing; fillParkForm(f, null); }
      });
    }
    $all("form", screen).forEach(hideError);

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
      fitPill(screen);
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

  // "This can't wait" on the Help screen itself: go straight to "Call 999".
  $all("[data-help-here]").forEach(function (pill) {
    pill.addEventListener("click", function (e) {
      e.preventDefault();
      var first = $("#help .btn-danger");
      first.scrollIntoView({ block: "center" });
      first.focus();
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
    // A new time starts the day afresh: notes already looked at, "Not today"
    // or a reminder already sent today don't hold back the new one.
    state.reviewedDay = state.skipDay = state.notifiedDay = null;
    clearSkipFlag();
    save();
    // The switch is the soft ask; the browser's own prompt comes only now,
    // from this tap, and only if the reminder is on.
    if (state.reminder) R.ask().then(function () { renderReminderStatus(); scheduleReminder(); });
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
    form.addEventListener("change", function () { hideError(form); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var topicInput = $("input[name=topic]:checked", form);
      var text = $("[data-words]", form).value.trim();
      if (!topicInput && !text) {
        showError(form, $("input[name=topic]", form));
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

  // A note from the Past Notes tab (already reviewed), opened to read.
  function viewingWorry() {
    for (var i = 0; i < state.worries.length; i++) {
      if (state.worries[i].ticket === state.viewing && state.worries[i].outcome) return state.worries[i];
    }
    return null;
  }

  function worryText(w) { return w.words || w.topic; }

  // Figma 156:1955 names: a short chip label and a sticky-note title per topic.
  var TOPIC_CHIP = { "My work": "Work", "Money": "Money", "Someone in my life": "Someone", "My health": "Health", "Something else": "Other" };
  var TOPIC_TITLE = { "My work": "Work related", "Money": "Money worries", "Someone in my life": "Someone in my life", "My health": "Health related", "Something else": "Something else" };
  function topicChip(t) { return TOPIC_CHIP[t] || t; }
  function topicTitle(t) { return TOPIC_TITLE[t] || t; }

  // "Added 9:32 Today" / "Added 14:54 Yesterday" / "Added 9:32, 1 Nov"
  function addedText(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    var hm = d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0");
    var today = new Date();
    var yest = new Date(); yest.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Added " + hm + " Today";
    if (d.toDateString() === yest.toDateString()) return "Added " + hm + " Yesterday";
    return "Added " + hm + ", " + d.getDate() + " " + d.toLocaleString("en-GB", { month: "short" });
  }

  function countText(n) {
    if (n === 0) return "Nothing to review right now. Notes you park will show here.";
    return "It’s time to review the notes you have added. It looks like you have added " +
      (n === 1 ? "1 note" : n + " notes") + ", we will take a look at " +
      (n === 1 ? "it" : "each one") + " and see if you need to create a plan for " + (n === 1 ? "it." : "them.");
  }

  function setTab(tab) {
    state.tab = tab;
    $all("#review [data-tab]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.tab === tab)); });
    $all("#review [data-panel]").forEach(function (p) { p.hidden = p.dataset.panel !== tab; });
  }

  // One sticky note. Colour and tilt come from its place in the stack.
  function noteCard(tag, w, i, extra) {
    var card = document.createElement(tag);
    card.className = "note note-" + (i % 4);
    var meta = document.createElement("span");
    meta.className = "note-meta";
    meta.textContent = "Note " + (i + 1) + " • " + addedText(w.parkedAt);
    var head = document.createElement("span");
    head.className = "note-head";
    var title = document.createElement("span");
    title.className = "note-title";
    title.textContent = topicTitle(w.topic);
    head.appendChild(title);
    if (tag === "button") {
      var icon = document.createElement("img");
      icon.src = "assets/arrow-down.svg"; icon.width = 32; icon.height = 32; icon.alt = "";
      head.appendChild(icon);
    }
    card.appendChild(meta);
    card.appendChild(head);
    if (w.words) {
      var words = document.createElement("span");
      words.className = "note-words";
      words.textContent = w.words;
      card.appendChild(words);
    }
    if (extra) {
      var ex = document.createElement("span");
      ex.className = "note-extra";
      ex.textContent = extra;
      card.appendChild(ex);
    }
    return card;
  }

  function renderReview() {
    var parked = parkedWorries();
    var passed = state.worries.filter(function (w) { return w.outcome; });
    $all("[data-review-count]").forEach(function (el) { el.textContent = countText(parked.length); });
    $("[data-review-tap]").hidden = parked.length === 0;
    $("[data-passed-count]").textContent = passed.length
      ? "These are the notes you’ve reviewed, newest first."
      : "Nothing here yet. Notes you review will show here.";
    $("[data-passed-tap]").hidden = passed.length === 0;

    var today = $("[data-list=today]");
    today.innerHTML = "";
    parked.forEach(function (w, i) {
      var li = document.createElement("li");
      var btn = noteCard("button", w, i);
      btn.type = "button";
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
    // Past Notes: every reviewed note, newest review first. Each opens.
    passed.slice().sort(function (a, b) { return (b.reviewedAt || "").localeCompare(a.reviewedAt || ""); })
      .forEach(function (w, i) {
        var li = document.createElement("li");
        var btn = noteCard("button", w, i, OUTCOMES[w.outcome] + (w.note ? " · Note added" : ""));
        btn.type = "button";
        btn.addEventListener("click", function () {
          state.viewing = w.ticket;
          save();
          go("past-note");
        });
        li.appendChild(btn);
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
    if (topic) topic.textContent = topicChip(w.topic);
    if (id === "review-act") {
      var form = $("#act-form");
      $all("input[name=outcome]", form).forEach(function (r) { r.checked = false; });
      $("[data-act-more]", form).hidden = true;
      $("#review-note").value = w.note || "";
    }
  }

  // "No": it doesn't affect me now, so it has faded.
  $("[data-affect=no]").addEventListener("click", function () {
    finishReview("faded", reviewingWorry().note || "");
  });

  var actForm = $("#act-form");
  // The note and save button appear once a choice is made (Figma 150:1859).
  actForm.addEventListener("change", function (e) {
    hideError(actForm);
    if (e.target.name === "outcome") $("[data-act-more]", actForm).hidden = false;
  });
  actForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var picked = $("input[name=outcome]:checked", actForm);
    if (!picked) {
      showError(actForm, $("input[name=outcome]", actForm));
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

  function reviewedText(iso) { return addedText(iso).replace("Added", "Reviewed"); }

  function renderPastNote() {
    var w = viewingWorry();
    $("[data-past-topic]").textContent = topicChip(w.topic);
    $("[data-past-words]").textContent = w.words || topicTitle(w.topic);
    $("[data-past-dates]").textContent = addedText(w.parkedAt) + (w.reviewedAt ? " · " + reviewedText(w.reviewedAt) : "");
    $("[data-past-outcome]").textContent = OUTCOMES[w.outcome];
    var note = $("[data-past-note]");
    note.textContent = w.note || "You didn’t add a note to this one.";
    note.classList.toggle("is-empty", !w.note);
  }

  // Worry time reminders (reminders.js has the copy).
  // A static site has no server, so there is no true push. Instead:
  // - while Atode is open (even in a background tab), a timer shows a
  //   notification at worry time, through the service worker (sw.js);
  // - whenever Atode is opened after worry time, Home shows a card instead.
  // Nothing fires when no notes are waiting, after notes were looked at
  // today, after "Not today", or more than 2 hours late (close to bed).

  var LATE_MS = 2 * 60 * 60 * 1000;
  var reminderTimer = null;
  var tryNudge = false;

  function pad2(n) { return String(n).padStart(2, "0"); }
  function dayKey(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function dueAt(d) {
    var p = state.time.split(":"), t = new Date(d);
    t.setHours(parseInt(p[0], 10), parseInt(p[1], 10), 0, 0);
    return t;
  }
  // Notes parked before today's worry time. One parked at 9pm waits for tomorrow.
  function dueNotes(now) {
    var cut = dueAt(now).getTime();
    return parkedWorries().filter(function (w) { return new Date(w.parkedAt).getTime() < cut; });
  }
  function reminderDue(now) {
    var today = dayKey(now);
    return state.reminder && state.onboarded && now >= dueAt(now) &&
      state.reviewedDay !== today && state.skipDay !== today && dueNotes(now).length > 0;
  }
  function reminderMessage(now) {
    var yesterdayDue = dueAt(now).getTime() - 864e5;
    var carried = dueNotes(now).some(function (w) { return new Date(w.parkedAt).getTime() < yesterdayDue; });
    return R.pick(now, timeLabel(state.time), carried);
  }

  function markReviewedToday() {
    state.reviewedDay = dayKey(new Date());
    tryNudge = false;
    save();
  }

  function renderReminderStatus() {
    var perm = R.permission();
    var text = !state.reminder ? R.STATUS.off : perm === "granted" ? R.STATUS.on : R.STATUS.inApp;
    $all("[data-reminder-status]").forEach(function (el) { el.textContent = text; });
    var ask = $("[data-reminder-ask]");
    ask.textContent = R.STATUS.ask;
    ask.hidden = !(state.reminder && perm === "default");
    // Onboarding: say why it's in-app only, once the browser has said no.
    var why = $("[data-reminder-why]");
    var reason = state.reminder && perm !== "granted" && perm !== "default" ? R.STATUS.why[perm] : "";
    why.textContent = reason;
    why.hidden = !reason;
  }

  function renderNudge() {
    var now = new Date();
    var box = $("[data-nudge]");
    var t = timeLabel(state.time);
    $("[data-nudge-title]", box).textContent = R.BANNER.title;
    $("[data-nudge-body]", box).textContent = R.fill(R.BANNER.body, t);
    $("[data-nudge-go]", box).textContent = R.BANNER.go;
    $("[data-nudge-skip]", box).textContent = R.BANNER.skip;
    // One paper layer per waiting note, capped at 3; the exact count is in the text.
    var n = dueNotes(now).length;
    box.setAttribute("data-layers", String(Math.min(Math.max(n, 1), 3)));
    $("[data-nudge-count]", box).textContent = !n ? R.BANNER.countNone : n === 1 ? R.BANNER.countOne : R.BANNER.count.replace("{n}", n);
    box.hidden = !(tryNudge || reminderDue(now));
  }

  function skipToday() {
    state.skipDay = dayKey(new Date());
    tryNudge = false;
    save();
    renderNudge();
  }

  $("[data-nudge-skip]").addEventListener("click", function () {
    skipToday();
    $("#home h1").focus();
    announce(R.fill(R.BANNER.skipped, timeLabel(state.time)));
  });
  $("[data-reminder-ask]").addEventListener("click", function () {
    R.ask().then(function (perm) {
      renderReminderStatus();
      scheduleReminder();
      announce(perm === "granted" ? "Notifications on." : R.STATUS.why[perm] || "");
      if (perm !== "default") $("#home h1").focus();
    });
  });

  function tick() {
    var now = new Date();
    if (current() === "home") {
      var wasHidden = $("[data-nudge]").hidden;
      renderNudge();
      if (wasHidden && !$("[data-nudge]").hidden && document.visibilityState === "visible") announce(R.BANNER.title);
    }
    if (!reminderDue(now) || state.notifiedDay === dayKey(now) || now - dueAt(now) > LATE_MS) return;
    state.notifiedDay = dayKey(now);
    save();
    // On time, it always sends, even with Atode on screen (people testing
    // watch the screen). A late catch-up while Atode is on screen doesn't:
    // the card on Home is enough.
    if (document.visibilityState !== "visible" || now - dueAt(now) < 2 * 60 * 1000) R.notify(reminderMessage(now));
  }

  // A timer for the next worry time, plus a check each minute and on
  // returning to the tab (background tabs slow timers down).
  function scheduleReminder() {
    clearTimeout(reminderTimer);
    var now = new Date(), next = dueAt(now);
    if (next <= now) next.setDate(next.getDate() + 1);
    reminderTimer = setTimeout(function () { tick(); scheduleReminder(); }, next - now + 1000);
  }

  // For moderators: #try-reminder shows the Home card and, 5 seconds later
  // (time to lock the phone or switch app), a notification.
  function tryReminder() {
    tryNudge = true;
    history.replaceState(null, "", "#home");
    show("home");
    announce("Test reminder in 5 seconds.");
    R.ask().then(function () {
      renderReminderStatus();
      setTimeout(function () { R.notify(reminderMessage(new Date())); }, 5000);
    });
  }

  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener("message", function (e) {
      if (!e.data) return;
      if (e.data.type === "atode-open-review") go("review");
      if (e.data.type === "atode-skip-today") skipToday();
    });
  }

  // "Not today" tapped on a notification while Atode was closed.
  function clearSkipFlag() {
    if (window.caches) caches.delete("atode-flags").catch(function () {});
  }
  function readSkipFlag() {
    if (!window.caches) return Promise.resolve();
    return caches.open("atode-flags").then(function (c) { return c.match("skip-day"); })
      .then(function (r) { return r && r.text(); })
      .then(function (day) { if (day && day === dayKey(new Date()) && state.skipDay !== day) skipToday(); })
      .catch(function () {});
  }

  R.register();
  readSkipFlag();
  scheduleReminder();
  setInterval(tick, 60 * 1000);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") { readSkipFlag(); renderReminderStatus(); }
    tick();
  });
  window.addEventListener("storage", function (e) {
    if (e.key === STORE_KEY) { state = load(); renderTime(); if (current() === "home") renderNudge(); }
  });

  // Download Report (Figma 172:1209 / 172:1270)
  // The PDF is made here, on the device, with jsPDF and the Inter font.
  // Both load only when someone asks for a report. Nothing is sent to Atode:
  // "Share my report" hands the file to the device share sheet, or where that
  // can't share files (most computers) saves it so it can be attached by hand.

  var VENDOR = {
    jspdf: "vendor/jspdf.umd.min.js",
    fonts: { normal: "vendor/fonts/Inter-Regular.ttf", semibold: "vendor/fonts/Inter-SemiBold.ttf", black: "vendor/fonts/Inter-Black.ttf" }
  };
  var vendorReady = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  function toBase64(buf) {
    var bytes = new Uint8Array(buf), out = "", CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) out += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(out);
  }
  function loadVendor() {
    if (vendorReady) return vendorReady;
    var inline = window.ATODE_FONTS_B64; // set by the single-file preview build
    var lib = window.jspdf ? Promise.resolve() : loadScript(VENDOR.jspdf);
    var fonts = inline ? Promise.resolve(inline) : Promise.all(Object.keys(VENDOR.fonts).map(function (k) {
      return fetch(VENDOR.fonts[k]).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(function (b) { return [k, toBase64(b)]; });
    })).then(function (pairs) { var o = {}; pairs.forEach(function (p) { o[p[0]] = p[1]; }); return o; });
    vendorReady = Promise.all([lib, fonts]).then(function (r) { return r[1]; });
    vendorReady.catch(function () { vendorReady = null; });
    return vendorReady;
  }

  var C = {
    ink: "#1a1a1a", body: "#555550", muted: "#55505f", paper: "#fafaf7", white: "#ffffff",
    yellow: "#ffbe00", line: "#e8e8e8", stone: "#eee9df", lilacCard: "#f6f2fa", red: "#c1121f",
    notes: ["#fff1b0", "#fadde4", "#dfeffb", "#ede2fd"]
  };

  function dayText(d) { return d.getDate() + " " + d.toLocaleString("en-GB", { month: "short" }) + " " + d.getFullYear(); }
  function hmText(d) { return d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0"); }

  function reportData() {
    var list = state.worries.slice().sort(function (a, b) { return (a.parkedAt || "").localeCompare(b.parkedAt || ""); });
    var counts = {};
    list.forEach(function (w) { counts[w.topic] = (counts[w.topic] || 0) + 1; });
    var themes = Object.keys(counts).map(function (t) { return { topic: t, n: counts[t] }; })
      .sort(function (a, b) { return b.n - a.n; });
    var top = themes.length ? themes.filter(function (t) { return t.n === themes[0].n; }) : [];
    return {
      worries: list,
      themes: themes,
      top: top,
      reviewed: list.filter(function (w) { return w.outcome; }).length
    };
  }

  // Tagged PDF (PDF/UA-1). jsPDF has no tagging, so this adds it: every piece
  // of text is wrapped in marked content (BDC/EMC) with an MCID and tied to a
  // structure element (H1, H2, P, L/LI/LBody); backgrounds, bars, rules and the
  // running header and footer are marked as artifacts. The structure tree,
  // parent tree, MarkInfo and XMP metadata (with the PDF/UA identifier) are
  // written into the file as it's built.
  function pdfTagger(doc) {
    var root = { S: "Document", kids: [] };
    var stack = [root];
    var nextMcid = {};
    var api = doc.internal;
    function top() { return stack[stack.length - 1]; }
    function page() { return api.getCurrentPageInfo().pageNumber; }
    function open(S) {
      var el = { S: S, kids: [], parent: top() };
      top().kids.push(el);
      stack.push(el);
      return el;
    }
    function close() { stack.pop(); }
    // Content that belongs to the open element.
    function mc(draw) {
      var pg = page(), id = nextMcid[pg] || 0;
      nextMcid[pg] = id + 1;
      api.write("/" + top().S + " <</MCID " + id + ">> BDC");
      draw();
      api.write("EMC");
      top().kids.push({ page: pg, mcid: id, owner: top() });
    }
    function leaf(S, draw) { open(S); mc(draw); close(); }
    function artifact(draw, kind) {
      api.write(kind === "page" ? "/Artifact <</Type /Pagination>> BDC" : "/Artifact BMC");
      draw();
      api.write("EMC");
    }

    var ids = { root: 0, parentTree: 0, xmp: 0 };
    api.events.subscribe("putPage", function (d) {
      api.out("/StructParents " + (d.pageNumber - 1));
      api.out("/Tabs /S");
    });
    api.events.subscribe("putAdditionalObjects", function () {
      var all = [];
      (function walk(el) { all.push(el); el.kids.forEach(function (k) { if (k.S) walk(k); }); })(root);
      ids.root = api.newObjectDeferred();
      ids.parentTree = api.newObjectDeferred();
      all.forEach(function (el) { el.id = api.newObjectDeferred(); });
      var byPage = {};
      all.forEach(function (el) {
        var kids = el.kids.map(function (k) {
          if (k.S) return k.id + " 0 R";
          (byPage[k.page] = byPage[k.page] || [])[k.mcid] = el.id;
          return "<< /Type /MCR /Pg " + api.getPageInfo(k.page).objId + " 0 R /MCID " + k.mcid + " >>";
        });
        api.newObjectDeferredBegin(el.id, true);
        api.out("<< /Type /StructElem /S /" + el.S + " /P " + (el.parent ? el.parent.id : ids.root) + " 0 R /K [" + kids.join(" ") + "] >>");
        api.out("endobj");
      });
      var pages = api.getNumberOfPages(), nums = [];
      for (var pg = 1; pg <= pages; pg++) {
        nums.push((pg - 1) + " [" + (byPage[pg] || []).map(function (id) { return id + " 0 R"; }).join(" ") + "]");
      }
      api.newObjectDeferredBegin(ids.parentTree, true);
      api.out("<< /Nums [" + nums.join(" ") + "] >>");
      api.out("endobj");
      api.newObjectDeferredBegin(ids.root, true);
      api.out("<< /Type /StructTreeRoot /K [" + root.id + " 0 R] /ParentTree " + ids.parentTree + " 0 R /ParentTreeNextKey " + pages + " >>");
      api.out("endobj");
      // XMP: title, language and the PDF/UA identifier.
      var xmp = '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
        '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:pdfuaid="http://www.aiim.org/pdfua/ns/id/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/" xmlns:xmp="http://ns.adobe.com/xap/1.0/">' +
        '<dc:title><rdf:Alt><rdf:li xml:lang="x-default">Atode worry report</rdf:li></rdf:Alt></dc:title>' +
        '<dc:description><rdf:Alt><rdf:li xml:lang="x-default">Worries parked in Atode</rdf:li></rdf:Alt></dc:description>' +
        '<dc:creator><rdf:Seq><rdf:li>Atode</rdf:li></rdf:Seq></dc:creator>' +
        '<dc:language><rdf:Bag><rdf:li>en-GB</rdf:li></rdf:Bag></dc:language>' +
        '<pdf:Producer>' + api.pdfEscape("jsPDF") + '</pdf:Producer><xmp:CreatorTool>Atode</xmp:CreatorTool>' +
        '<pdfuaid:part>1</pdfuaid:part></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';
      ids.xmp = api.newObject();
      api.out("<< /Type /Metadata /Subtype /XML /Length " + xmp.length + " >>");
      api.out("stream");
      api.out(xmp);
      api.out("endstream");
      api.out("endobj");
    });
    api.events.subscribe("putCatalog", function () {
      api.out("/MarkInfo << /Marked true >>");
      api.out("/StructTreeRoot " + ids.root + " 0 R");
      api.out("/Metadata " + ids.xmp + " 0 R");
    });
    return { open: open, close: close, mc: mc, leaf: leaf, artifact: artifact };
  }

  function buildReport(fonts) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: "mm", format: "a4", compress: true, putOnlyUsedFonts: true });
    doc.addFileToVFS("Inter-Regular.ttf", fonts.normal); doc.addFont("Inter-Regular.ttf", "Inter", "normal");
    doc.addFileToVFS("Inter-SemiBold.ttf", fonts.semibold); doc.addFont("Inter-SemiBold.ttf", "Inter", "semibold");
    doc.addFileToVFS("Inter-Black.ttf", fonts.black); doc.addFont("Inter-Black.ttf", "Inter", "black");
    doc.setProperties({ title: "Atode worry report", subject: "Worries parked in Atode", creator: "Atode", author: "Atode" });
    if (doc.setLanguage) doc.setLanguage("en-GB");
    // Show "Atode worry report" in the viewer's title bar, not the file name.
    if (doc.viewerPreferences) doc.viewerPreferences({ DisplayDocTitle: true });
    var T = pdfTagger(doc);

    var data = reportData();
    var W = 210, H = 297, M = 18, CW = W - 2 * M, FOOT = 18;
    var now = new Date();
    var y = 0;

    function bg() { T.artifact(function () { doc.setFillColor(C.paper); doc.rect(0, 0, W, H, "F"); }); }
    function fillBox(color, x, top, w, h, r) { T.artifact(function () { doc.setFillColor(color); doc.roundedRect(x, top, w, h, r, r, "F"); }); }
    function font(style, size, color) { doc.setFont("Inter", style); doc.setFontSize(size); doc.setTextColor(color || C.ink); }
    function lh(size, f) { return size * 0.3528 * (f || 1.35); }
    function lines(text, width) { return doc.splitTextToSize(String(text), width); }
    function block(textLines, x, top, size, f) {
      var step = lh(size, f);
      // A trailing space on wrapped lines keeps words apart when the text is
      // read out or copied (each line is its own text run).
      textLines.forEach(function (l, i) { doc.text(i < textLines.length - 1 ? l + " " : l, x, top + size * 0.3528 + i * step); });
      return textLines.length * step;
    }
    function newPage() { doc.addPage(); bg(); y = M; miniHead(); }
    function ensure(h) { if (y + h > H - FOOT - 4) newPage(); }
    // The running header repeats on every page after the first: an artifact.
    function miniHead() {
      T.artifact(function () {
        font("black", 11); doc.text("Atode", M, y + 4);
        font("normal", 8.5, C.muted); doc.text("Worry report · " + dayText(now), W - M, y + 4, { align: "right" });
      }, "page");
      y += 12;
    }
    function heading(text) {
      ensure(16);
      T.leaf("H2", function () { font("black", 15); doc.text(text, M, y + 5.5); });
      y += 11;
    }

    // Page 1 header
    bg();
    y = M;
    T.leaf("P", function () { font("black", 20); doc.text("Atode", M, y + 7); });
    fillBox(C.yellow, M, y + 10, 13, 1.6, 0.8);
    T.leaf("P", function () { font("normal", 9, C.muted); doc.text("Made on " + dayText(now) + ", on this device", W - M, y + 7, { align: "right" }); });
    y += 22;
    T.leaf("H1", function () { font("black", 30); doc.text("Your worry report", M, y + 10); });
    y += 17;

    var first = data.worries[0], last = data.worries[data.worries.length - 1];
    var span = first ? (dayText(new Date(first.parkedAt)) === dayText(new Date(last.parkedAt))
      ? "on " + dayText(new Date(first.parkedAt))
      : "from " + dayText(new Date(first.parkedAt)) + " to " + dayText(new Date(last.parkedAt))) : "";
    T.leaf("P", function () {
      font("normal", 11, C.body);
      y += block(lines("The worries you parked in Atode " + span + ". You can give this to someone you trust, or use it as notes at your next therapy appointment.", CW), M, y, 11, 1.45);
    });
    y += 8;

    // Summary cards: a list of three, read card by card.
    var gap = 5, cw = (CW - 2 * gap) / 3, ch = 38;
    var topLabel = data.top.map(function (t) { return t.topic; }).join(" and ");
    var cards = [
      { fill: C.notes[0], label: "Worries added", big: String(data.worries.length), sub: first ? "Since " + dayText(new Date(first.parkedAt)) : "" },
      { fill: C.notes[3], label: "Most common theme", theme: topLabel || "None yet",
        sub: data.top.length ? data.top[0].n + " of " + data.worries.length + " worries" + (data.top.length > 1 ? " each" : "") : "" },
      { fill: C.notes[2], label: "Reviewed", big: String(data.reviewed), sub: (data.worries.length - data.reviewed) + " still parked" }
    ];
    T.open("L");
    cards.forEach(function (c, i) {
      var x = M + i * (cw + gap);
      fillBox(c.fill, x, y, cw, ch, 5);
      T.open("LI"); T.open("LBody");
      T.leaf("P", function () { font("semibold", 9, C.muted); doc.text(c.label, x + 5, y + 8); });
      T.leaf("P", function () {
        if (c.big) { font("black", 30); doc.text(c.big, x + 5, y + 23); }
        else {
          var size = 15, tl;
          do { font("black", size); tl = lines(c.theme, cw - 10); size -= 1; } while (tl.length > 2 && size > 10);
          block(tl, x + 5, y + 11.5, size + 1, 1.1);
        }
      });
      if (c.sub) T.leaf("P", function () { font("normal", 9, C.ink); doc.text(c.sub, x + 5, y + ch - 5); });
      T.close(); T.close();
    });
    T.close();
    y += ch + 10;

    // Themes: a list, "Money 3". The bars are decoration.
    if (data.themes.length) {
      heading("Themes");
      var labelW = 46, barX = M + labelW, barW = CW - labelW - 14, max = data.themes[0].n;
      T.open("L");
      data.themes.forEach(function (t) {
        ensure(9);
        T.open("LI"); T.open("LBody");
        T.leaf("P", function () { font("normal", 10.5); doc.text(t.topic, M, y + 4.2); });
        T.leaf("P", function () { font("semibold", 10.5); doc.text(String(t.n), W - M, y + 4.2, { align: "right" }); });
        T.close(); T.close();
        fillBox(C.stone, barX, y, barW, 5.5, 2.75);
        fillBox(C.yellow, barX, y, Math.max(5.5, barW * t.n / max), 5.5, 2.75);
        y += 8.5;
      });
      T.close();
      y += 5;
    }

    // Each note, as a sticky note like the app: a list item with its own heading.
    heading("Your notes");
    var pad = 6, inner = CW - 2 * pad;
    T.open("L");
    data.worries.forEach(function (w, i) {
      var added = new Date(w.parkedAt);
      var meta = "Note " + (i + 1) + " • Added " + hmText(added) + ", " + dayText(added);
      var status = w.outcome ? "Reviewed" + (w.reviewedAt ? " " + dayText(new Date(w.reviewedAt)) : "") : "Still parked";
      font("black", 16); var titleL = lines(topicTitle(w.topic), inner - 40);
      font("normal", 11); var wordsL = lines(w.words || "No words added.", inner);
      var rows = [];
      if (w.outcome) rows.push(["What you decided", OUTCOMES[w.outcome]]);
      if (w.note) rows.push(["Your note", w.note]);
      font("normal", 10.5);
      var rowL = rows.map(function (r) { return lines(r[1], inner); });
      var h = pad + 4 + 3 + titleL.length * lh(16, 1.15) + 2 + wordsL.length * lh(11, 1.4)
        + rows.reduce(function (s, r, k) { return s + 5 + 1.5 + rowL[k].length * lh(10.5, 1.4); }, 0)
        + (rows.length ? 3 : 0) + pad;
      ensure(h + 5);
      var top = y;
      fillBox(C.notes[i % 4], M, top, CW, h, 6);
      var cy = top + pad;
      T.open("LI"); T.open("LBody");
      font("black", 16); // title first in reading order, then its details
      T.leaf("H3", function () { block(titleL, M + pad, cy + 7, 16, 1.15); });
      T.leaf("P", function () { font("normal", 9, C.ink); doc.text(meta, M + pad, cy + 3); });
      font("semibold", 8.5, C.ink);
      var sw = doc.getTextWidth(status) + 6;
      fillBox(w.outcome ? C.ink : C.white, W - M - pad - sw, cy - 1, sw, 5.6, 2.8);
      T.leaf("P", function () {
        font("semibold", 8.5, w.outcome ? C.white : C.ink);
        doc.text(status, W - M - pad - sw / 2, cy + 2.9, { align: "center" });
      });
      cy += 4 + 3;
      cy += titleL.length * lh(16, 1.15) + 2;
      T.leaf("P", function () { font("normal", 11, w.words ? C.ink : C.muted); cy += block(wordsL, M + pad, cy, 11, 1.4); });
      if (rows.length) {
        cy += 3;
        var lineY = cy;
        T.artifact(function () {
          doc.setDrawColor(C.muted); doc.setLineWidth(0.15); doc.setLineDashPattern([1, 1], 0);
          doc.line(M + pad, lineY, W - M - pad, lineY); doc.setLineDashPattern([], 0);
        });
        rows.forEach(function (r, k) {
          cy += 5;
          T.leaf("H4", function () { font("semibold", 9.5, C.muted); doc.text(r[0], M + pad, cy); });
          cy += 1.5;
          T.leaf("P", function () { font("normal", 10.5, C.ink); cy += block(rowL[k], M + pad, cy, 10.5, 1.4); });
        });
      }
      T.close(); T.close();
      y = top + h + 5;
    });
    T.close();

    // Where to get help
    var helpL;
    font("normal", 10); helpL = lines("If you’re in danger, call 999. For urgent mental health help, call NHS 111 and choose option 2. To talk to someone, call Samaritans on 116 123, or text SHOUT to 85258. They’re free and confidential.", CW - 12);
    var hh = 6 + 6 + helpL.length * lh(10, 1.4) + 6;
    ensure(hh + 4);
    y += 3;
    fillBox(C.stone, M, y, CW, hh, 6);
    T.leaf("H2", function () { font("black", 12); doc.text("If you need help now", M + 6, y + 9); });
    T.leaf("P", function () { font("normal", 10); block(helpL, M + 6, y + 12, 10, 1.4); });

    // Footers repeat on every page: artifacts.
    var pages = doc.getNumberOfPages();
    for (var p = 1; p <= pages; p++) {
      doc.setPage(p);
      T.artifact(function () {
        doc.setDrawColor(C.line); doc.setLineWidth(0.3); doc.line(M, H - 13, W - M, H - 13);
        font("normal", 8.5, C.muted);
        doc.text("Atode · Made on this device. Not a medical record.", M, H - 8);
        doc.text("Page " + p + " of " + pages, W - M, H - 8, { align: "right" });
      }, "page");
    }
    return doc;
  }

  function reportFile() {
    return loadVendor().then(function (fonts) {
      var blob = buildReport(fonts).output("blob");
      var d = new Date();
      var name = "atode-worry-report-" + d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + ".pdf";
      var file;
      try { file = new File([blob], name, { type: "application/pdf" }); } catch (e) { file = blob; file.name = name; }
      return file;
    });
  }

  // Inside the claude.ai preview, files go through its downloads prompt;
  // everywhere else (GitHub Pages, the installed app) a normal download.
  function saveFile(file) {
    if (window.claude && window.claude.use) {
      return window.claude.use("downloads").then(function (dl) {
        if (!dl) return plainSave(file);
        return dl.save({ filename: file.name, data: file });
      });
    }
    return Promise.resolve(plainSave(file));
  }
  function plainSave(file) {
    var url = URL.createObjectURL(file);
    var a = document.createElement("a");
    a.href = url; a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }

  var dialog = $("#report-dialog");
  var statusEl = $("[data-report-status]", dialog);
  var opener = null;

  function setStatus(msg) { statusEl.textContent = msg; }
  function setBusy(busy) {
    $all("[data-report-share], [data-report-download]", dialog).forEach(function (b) { b.disabled = busy || !state.worries.length; });
  }

  $all("[data-report-open]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      opener = btn;
      var empty = !state.worries.length;
      $("[data-report-empty]", dialog).hidden = !empty;
      setStatus(""); setBusy(false);
      if (dialog.showModal) dialog.showModal(); else dialog.setAttribute("open", "");
      loadVendor().catch(function () {}); // warm up before they choose
    });
  });
  function closeDialog() { if (dialog.close) dialog.close(); else dialog.removeAttribute("open"); }
  $("[data-report-close]", dialog).addEventListener("click", closeDialog);
  dialog.addEventListener("click", function (e) { if (e.target === dialog) closeDialog(); }); // tap outside
  dialog.addEventListener("close", function () { if (opener) opener.focus(); });

  $("[data-report-download]", dialog).addEventListener("click", function () {
    setBusy(true); setStatus("Making your report…");
    reportFile().then(function (file) {
      return saveFile(file).then(function () {
        setStatus("Your report is saved as " + file.name + ".");
      }, function (err) {
        setStatus(err && err.code === "declined" ? "Not saved. You can try again." : "Sorry, the report couldn’t be saved here.");
      });
    }).catch(function () {
      setStatus("Sorry, the report couldn’t be made. Check your connection and try again.");
    }).then(function () { setBusy(false); });
  });

  // Share my report: the device's share sheet with the PDF attached (Mail, Messages, WhatsApp…).
  // Where files can't be shared (most computers), save it so it can be attached by hand.
  $("[data-report-share]", dialog).addEventListener("click", function () {
    setBusy(true); setStatus("Making your report…");
    reportFile().then(function (file) {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        setStatus("Choose who to share it with.");
        return navigator.share({ files: [file], title: "Atode worry report", text: "Here is my Atode worry report." }).then(function () {
          setStatus("Shared.");
        }, function (err) {
          setStatus(err && err.name === "AbortError" ? "Not shared. You can try again, or download it instead." : "Sharing didn’t work here. Try “Download to device”.");
        });
      }
      return saveFile(file).then(function () {
        setStatus("Sharing isn’t available on this device, so your report is saved as " + file.name + ". You can attach it to an email or message from your downloads.");
      }, function (err) {
        setStatus(err && err.code === "declined" ? "Not saved. You can try again." : "Sorry, the report couldn’t be shared or saved here.");
      });
    }).catch(function () {
      setStatus("Sorry, the report couldn’t be made. Check your connection and try again.");
    }).then(function () { setBusy(false); });
  });

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
