# Atode hi-fidelity prototype

The hi-fi version of Atode, kept apart from the wireframe prototype in the repo root.

- Wireframe prototype: https://andrewtaws.github.io/Atode/
- Hi-fi prototype: https://andrewtaws.github.io/Atode/hifi/
- Design system: https://andrewtaws.github.io/Atode/hifi/design-system.html

**Look and feel (3 Nov 2026):** every screen uses the style from Figma section 156:1955: black Inter titles with the Atode wordmark beside them, yellow buttons with a black outline, black choice pills, a tinted Home and a sticky-note stack on Review Notes. Home and the Review flow follow those frames closely; the other screens take the same tokens and components.

Onboarding follows the Figma hi-fi frames (node 69:2274), and Home, Add your worry and Quick add follow the hi-fi "Add a worry" frames (node 115:905). Done at the end of onboarding opens Home. "Review notes early" on Home opens Review Notes (node 150:1911): tap a sticky note, say whether it still affects you (step 1 of 2), choose what can be done and add a note (step 2 of 2), and it moves to Reviewed notes (or is parked again till tomorrow).

It saves to its own storage (`atode.hifi.v1`), so testing one version doesn't affect the other. Add `#reset` to the end of the address to clear it between testers.

## Install it like an app

- **Android (phone or tablet):** open the hi-fi link in Chrome, tap ⋮, then **Add to Home screen** (or **Install app**).
- **iPhone or iPad:** open it in Safari, tap Share, then **Add to Home Screen**.

It opens full screen with the Atode icon. Worries stay in that installed copy's storage on the device.

## Tablet

Screens 768px wide or more (iPad portrait and landscape) use the tablet layout from Figma (node 130:1445): wider margins, roomier cards and two columns. The Figma frames cover Home and the Review worries flow; the other screens follow the same pattern. Phones are unchanged.

## Design system

- `tokens.css`: every colour, size, space, radius and shadow. A palette layer (raw colours) and a roles layer (what each colour is for). Components only use roles, so most restyles are a change to this one file.
- `styles.css`: the components (buttons, header pill, cards, safety note, steps, options, switch, tiles, ticket, illustration slots).
- Motion tokens (`--motion-*`, `--ease-*`) set the loading screen, page transitions and small touches. All of it is off when the phone asks to reduce motion.
- `design-system.html`: shows every token and component, with contrast worked out live from the current values.

## Illustrations

The illustrations live in `assets/illustrations/` (`welcome.png`, `clock.png`, `thought.png`, `hand.png`, and `thought-cloud.png` on Home, exported from Figma at 88px). To swap one, replace the file with the same name. If a file is missing, a simple icon shows in its place.
