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

The illustrations live in `assets/illustrations/` (`welcome.png`, `clock.png`, `thought.png`, `hand.png`, and `thought-cloud.png` on Home, exported from Figma at 88px). To swap one, replace the file with the same name. If a file is missing, a simple icon shows in its place.
