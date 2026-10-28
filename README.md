# Atode

Atode (Japanese for "later") helps you hand a worry over now and collect it at a set time, based on the CBT technique of worry postponement.

This repo holds a coded prototype for user testing (Falmouth MA UX Design, GDO71). It currently covers the **onboarding and first worry** flow from the Figma file "Designs-for-Rapid-Ideation" (section "Onboarding and first worry", node 41:1311):

1. Welcome
2. How it works
3. When should you collect your worries? (6pm default, 8pm, or your own time, plus reminder switch)
4. What's on your mind right now? (pick a topic, optional words, park it)
5. Ticket and "back to your day" refocus
6. Help (999, NHS 111 option 2, Samaritans 116 123, SHOUT 85258)

A final "You're all set" screen marks the end of the prototype and has a **Start again** button so a moderator can reset between participants.

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

then go to http://localhost:8000. Each screen has its own address (`#welcome`, `#how`, `#time`, `#worry`, `#ticket`, `#help`, `#done`), so you can jump straight to one.

## Privacy

Everything stays in the browser's local storage on the tester's own device. Nothing is sent to a server. "Start again" deletes it.

## Accessibility

- Text is 14px or larger, and all text meets 4.5:1 contrast.
- Real radio buttons, a real switch and form labels, so it works with a keyboard and screen readers.
- Focus moves to the heading on each new screen, with a visible focus outline.
- Phone numbers are real `tel:` and `sms:` links.
