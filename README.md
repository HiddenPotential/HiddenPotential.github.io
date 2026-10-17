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

- `games/coin-pusher/`, `games/claw-machine/`, `games/wacky-rage-golf/`: one page per game, each with a `thumbnail.jpg` used on the homepage. Coin Pusher and Claw Machine show the arcade from `arcade/` in a frame (`?solo` shows just one game); Wacky Rage Golf shows `golf/`.
- `arcade/`: the arcade game itself (`index.html` and its `audio/` music), copied from the `cool` repo. To update it, copy those files over again.
- `golf/`: Wacky Rage Golf (`index.html`), copied from the `coolgame` repo. To update it, copy that file over again. Its page sizes the frame to fit the game.
- `apps/fluffipets/`: Fluffipets app page, privacy policy, and support
- `google444b4c14092b6f73.html`: Google Search Console verification (don't delete!)

## Preview locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
