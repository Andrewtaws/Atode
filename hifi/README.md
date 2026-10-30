# Atode hi-fidelity prototype

The hi-fi version of Atode, kept apart from the wireframe prototype in the repo root.

- Wireframe prototype: https://andrewtaws.github.io/Atode/
- Hi-fi prototype: https://andrewtaws.github.io/Atode/hifi/
- Design system: https://andrewtaws.github.io/Atode/hifi/design-system.html

Screens 1 to 6 follow the Figma hi-fi onboarding (node 69:2274). Home, Add your worry and Quick add have no hi-fi frames yet, so they're built from the same parts.

It saves to its own storage (`atode.hifi.v1`), so testing one version doesn't affect the other. Add `#reset` to the end of the address to clear it between testers.

## Design system

- `tokens.css`: every colour, size, space, radius and shadow. A palette layer (raw colours) and a roles layer (what each colour is for). Components only use roles, so most restyles are a change to this one file.
- `styles.css`: the components (buttons, header pill, cards, safety note, steps, options, switch, tiles, ticket, illustration slots).
- `design-system.html`: shows every token and component, with contrast worked out live from the current values.

## Illustrations

The four illustrations live in `assets/illustrations/` (`welcome.png`, `clock.png`, `thought.png`, `hand.png`). To swap one, replace the file with the same name. If a file is missing, a simple icon shows in its place.
