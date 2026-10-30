# Atode

Atode (Japanese for "later") helps you hand a worry over now and collect it at a set time, based on the CBT technique of worry postponement.

This repo holds a coded prototype for user testing (Falmouth MA UX Design, GDO71). It currently covers the **onboarding and first worry** flow from the Figma file "Designs-for-Rapid-Ideation" (section "Onboarding and first worry", node 41:1311):

1. Welcome
2. How it works
3. When should you collect your worries? (6pm default, 8pm, or your own time, plus reminder switch)
4. What's on your mind right now? (pick a topic, optional words, park it)
5. Ticket and "back to your day" refocus
6. Help (999, NHS 111 option 2, Samaritans 116 123, SHOUT 85258)

It also covers the **Add a worry** flow (Figma section "Add a worry", node 41:1499), which onboarding now leads into:

7. Home: worry time, reminder status, "Park a new worry", "Review worries early"
8. Add your worry: Quick add or Detailed entry
9. Quick add: same topic tiles and words as onboarding, then the same ticket screen

Worry time ("Review worries early") and Detailed entry aren't designed yet, so they open a "Not in this prototype yet" screen.

Once onboarding is done, opening the app again goes straight to Home. To reset a device between participants, open the address with `#reset` on the end.

## Hi-fi version

The hi-fidelity design lives separately in [`hifi/`](hifi/) and is served at `/hifi/`. Changes there don't touch the wireframe prototype.

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

then go to http://localhost:8000. Each screen has its own address (`#welcome`, `#how`, `#time`, `#worry`, `#ticket`, `#help`, `#home`, `#add`, `#quick`), so you can jump straight to one.

## Privacy

Everything stays in the browser's local storage on the tester's own device. Nothing is sent to a server. Opening `#reset` deletes it.

## Accessibility

- Text is 14px or larger, and all text meets 4.5:1 contrast.
- Real radio buttons, a real switch and form labels, so it works with a keyboard and screen readers.
- Focus moves to the heading on each new screen, with a visible focus outline.
- Phone numbers are real `tel:` and `sms:` links.
