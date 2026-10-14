# Anna Wang's Homepage ✏️

Live at **https://annawang.net/**

A notebook-style personal website. Plain HTML/CSS/JS, no build step.
Click the ☀️/🌙 button to switch between notebook paper and chalkboard.

## Editing

All the words are in **`index.html`**, written right in the page so search engines can read them.
Find the section you want (About Me, Things I Do, My Favorite Things, Stuff I Made) and change the text.

> 🔒 Keep it safe: don't put your address, phone number, full school name, or personal email on a public site.

- Change colors: edit the variables at the top of `styles.css`.
- Secret easter eggs live in `eggs.js` (shh!).
- When you add a new page, add it to `sitemap.xml` too.

## Other pages on this site

- `games/coin-pusher/`, `games/claw-machine/`: one page per game, each with a `thumbnail.jpg` used on the homepage. Each page shows the arcade from `arcade/` in a frame; `?solo` shows just one game.
- `arcade/`: the arcade game itself (`index.html` and its `audio/` music), copied from the `cool` repo. To update it, copy those files over again.
- `apps/fluffipets/`: Fluffipets app page, privacy policy, and support
- `google444b4c14092b6f73.html`: Google Search Console verification (don't delete!)

## Preview locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
