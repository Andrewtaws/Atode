# Atode hi-fidelity prototype

The hi-fi version of Atode, kept apart from the wireframe prototype in the repo root.

- Wireframe prototype: https://andrewtaws.github.io/Atode/
- Hi-fi prototype: https://andrewtaws.github.io/Atode/hifi/
- Design system: https://andrewtaws.github.io/Atode/hifi/design-system.html

**Look and feel (3 Nov 2026):** every screen uses the style from Figma section 156:1955: black Inter titles with the Atode wordmark beside them, yellow buttons with a black outline, black choice pills, a tinted Home and a sticky-note stack on Review Notes. Home and the Review flow follow those frames closely; the other screens take the same tokens and components.

**Help button and Review (3 Nov 2026, night):** from Figma 169:867 and 160:1956, the help button on every screen is now red, "I need help now", with a white cross. Primary buttons are flat yellow (#ffbe00, no outline). On phones, outside onboarding, the help button sits in the title row and the wordmark beside titles is gone. Review Note step 1 stacks No / Yes / See all. Review Notes tabs are "Today’s Notes" and "Past Notes" (yellow dot on the open one). **Past Notes** lists every reviewed note, newest first; tapping one opens a read-only Past Note screen (`#past-note`) with the worry, when it was added and reviewed, what was decided, and the note added to it.

**Onboarding (3 Nov 2026, later):** the six onboarding screens (marked `.onb`) follow Figma node 160:1956: white page, wordmark and "This can't wait" in a header row, lilac cloud illustrations, yellow / violet / lilac step cards, yellow selection, lilac ticket, lilac secondary buttons on Help. Its colours are the `--onb-*` tokens. Two changes for accessibility: tile, option, input and ticket edges use `--onb-line-control` (3:1) instead of Figma's #e6e0ef, and 13px labels are 14px. Help now shows the pill too; tapping it there jumps to "Call 999".

Onboarding was first built from the Figma hi-fi frames (node 69:2274), and Home and Quick add follow the hi-fi "Add a worry" frames (node 115:905). "Add a new note" on Home opens Quick add directly: the "Add your worry" choice screen and the detailed entry were removed (3 Nov). Done at the end of onboarding opens Home. "Review notes early" on Home opens Review Notes (node 150:1911): tap a sticky note, say whether it still affects you (step 1 of 2), choose what can be done and add a note (step 2 of 2), and it moves to Reviewed notes (or is parked again till tomorrow).

It saves to its own storage (`atode.hifi.v1`), so testing one version doesn't affect the other. Add `#reset` to the end of the address to clear it between testers.

## Worry report (PDF)

Review Notes has a "Download or share report" button (Figma 172:1209 said "email"; renamed on 4 Nov to match the sheet, which has no email option). It opens the Download Report sheet (173:1331). Both buttons make a PDF on the device, in Atode's colours and the Inter font: worries added, the most common theme, a bar for each theme, then every note as a sticky note (when it was added, whether it's been reviewed, what was decided and the note added), and where to get help.

- **Download to device** saves `atode-worry-report-YYYY-MM-DD.pdf`.
- **Share my report** opens the device share sheet with the PDF attached, so it can go by Mail, Messages or any app. Where files can't be shared (most computers), it saves the PDF instead so it can be attached by hand. There's no server, so nothing is sent to Atode.

jsPDF and the Inter font files are in `vendor/` and only load when a report is asked for.

The PDF is tagged for screen readers (PDF/UA-1, checked with veraPDF 1.28): headings, paragraphs and lists are in a structure tree in reading order, and backgrounds, bars, rules and the running header and footer are marked as artifacts. jsPDF can't tag on its own, so `pdfTagger()` in `app.js` adds the marked content, structure tree, parent tree and XMP metadata. Anything new drawn in `buildReport()` needs wrapping in `T.leaf(...)` (text) or `T.artifact(...)` / `fillBox(...)` (decoration), or the file stops validating.

## Worry time reminders

At the worry time picked in onboarding, Atode invites people back to collect their notes. The copy is in `reminders.js` and shown in full on the design system page (with a "Send a test reminder" button).

**When it fires.** Only when the reminder switch is on, at least one note was parked before today's worry time, and the person hasn't opened Review Notes or tapped "Not today" yet today. A note parked after worry time waits for tomorrow. No notes waiting means no reminder: success is needing Atode less. A notification is never sent more than 2 hours late (too close to bed); Home shows a card instead.

**How it reaches people.**
- **Notification:** asked for once, when "Use 6pm" is tapped with the switch on (the switch is the soft ask, so the browser prompt never comes cold). Shown through a small service worker (`sw.js`, no caching). Tapping it opens Review Notes. "Not today" on the notification is remembered.
- **Card on Home:** "Your notes are ready to collect", with "Look at my notes" and "Not today". Shows whenever Atode is opened after worry time with notes waiting, so it still works where notifications don't.
- Home's "Review note time" card says "Reminder on", "Reminder on, in Atode only" (no permission) or "Reminder off", with "Get a notification too" while the browser hasn't been asked.

**Copy rules.** An invitation, never an instruction, and always a way out. Never shows a worry, topic or count, and says "notes", not "worries", so a lock screen gives nothing away. No streaks, "missed" or catching up. No exclamation marks or emoji. Titles 34 characters or fewer. One message a day, in turn; notes waiting more than a day get "Your notes are still here / No catching up needed".

**Limits (it's a static site, no server).** The browser can't wake a closed web app at a set time: the Notification Triggers API that would have done this was dropped, and Web Push needs a server to send from. So the notification only fires while Atode is open, including in a background tab or a backgrounded installed app, until the system closes it. If Atode is fully closed, the person sees the Home card next time they open it. On iPhone and iPad, notifications only work once Atode is added to the Home Screen (iOS 16.4+). Reliable reminders need either a small push server or the planned native app (Flutter `flutter_local_notifications` schedules them on the device, no server).

**For testing:** add `#try-reminder` to the address. Home shows the card, and 5 seconds later a notification (time to lock the phone or switch app).

## Install it like an app

- **Android (phone or tablet):** open the hi-fi link in Chrome, tap ⋮, then **Add to Home screen** (or **Install app**).
- **iPhone or iPad:** open it in Safari, tap Share, then **Add to Home Screen**.

It opens full screen with the Atode icon. Worries stay in that installed copy's storage on the device.

## Tablet

Phones are unchanged. From 768px wide:

- The Atode wordmark moves into the header (left, opposite "This can't wait"), so page titles get the full width.
- Text steps up a size (body 17px, titles 40px, 44px from 1280px).
- **Portrait tablets (768–1023px):** one centred column, 600px wide.
- **Landscape tablets and desktop (1024px and up):** two columns (Figma node 130:1445), held in a centred column (928px, 1040px from 1280px) and centred vertically so screens don't sit in the top half.

## Design system

- `tokens.css`: every colour, size, space, radius and shadow. A palette layer (raw colours) and a roles layer (what each colour is for). Components only use roles, so most restyles are a change to this one file.
- `styles.css`: the components (buttons, header pill, cards, safety note, steps, options, switch, tiles, ticket, illustration slots).
- Motion tokens (`--motion-*`, `--ease-*`) set the loading screen, page transitions and small touches. All of it is off when the phone asks to reduce motion.
- `design-system.html`: shows every token and component, with contrast worked out live from the current values.

## Illustrations

Onboarding uses `onb-welcome.png`, `onb-clock.png`, `onb-thought.png` and `onb-help.png` (Figma 160:1956, 1x exports, so they soften on tablets until 2x files replace them). The older illustrations live in `assets/illustrations/` too (`welcome.png`, `clock.png`, `thought.png`, `hand.png`, and `thought-cloud.png` on Home, exported from Figma at 88px). To swap one, replace the file with the same name. If a file is missing, a simple icon shows in its place.
