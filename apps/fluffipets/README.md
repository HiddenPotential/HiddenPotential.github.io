# Publishing Fluffipets to the Mac App Store

Everything App Store Connect will ask you for is in this folder, written and
ready to paste. This file is the order to do it in.

Read **[Before you start](#before-you-start)** first — there are four things
only you can decide, and two of them change files in here.

---

## What is in this folder

```
publish/
  README.md                        this guide
  check-limits.sh                  verifies every text field fits Apple's limits

  metadata/
    en-US/
      name.txt                     Fluffipets
      title.txt                    the 30-char App Store name
      subtitle.txt                 the 30-char subtitle
      keywords.txt                 the 100-char keyword field
      description.txt              the product page body
      promotional-text.txt         the 170-char line you can change any time
      whats-new.txt                release notes
      support-url.txt              \
      marketing-url.txt             > need your details, see step 0
      privacy-url.txt              /
    app-review-notes.txt           PASTE THIS. It is what stops a rejection.
    privacy-nutrition-label.md     how to answer the App Privacy questionnaire
    categories-and-ratings.md      category, age rating, export compliance
    iap-fluffipets-pro.md          the in-app purchase record

  aso/
    keyword-strategy.md            why each word is where it is
    competitors.md                 the five apps you are up against

  screenshots/
    01..06 *.png                   six finished 2880x1800 screenshots
    make-screenshots.swift         regenerates them
    winlist.swift                  helper: lists window ids for capture
    source/                        the real window captures they composite
    README.md                      shot list, and the one shot still to take

  icon/
    AppIcon-1024.png               the App Store icon
    AppIcon.iconset/               every size macOS wants
    AppIcon.icns                   ready to drop into the app bundle
    make-icon.swift                regenerates all of the above

  site/
    index.html                     marketing page
    privacy.html                   privacy policy  (REQUIRED by Apple)
    support.html                   support page    (REQUIRED by Apple)
```

---

## Before you start

### 1. Four things only you can decide

| Thing | Status |
|---|---|
| **Your name or company name** | Appears as the seller and in the copyright. Replace `REPLACE-WITH-YOUR-NAME` in `site/*.html`. |
| **A support email address** | Replace `REPLACE-WITH-YOUR-EMAIL` in `site/privacy.html` and `site/support.html`. |
| **Where the two pages live** | You said "not sure yet". GitHub Pages is free and takes five minutes — see step 3. |
| **The bundle identifier** | `com.hiddenpotential.desktoppet` is a placeholder. It must match the Apple Developer account that ships the app. Changing it means changing the IAP product id too — see step 5. |

Find every placeholder at once:

```bash
grep -rn "REPLACE-WITH-YOUR\|<YOUR-GITHUB-USERNAME>" publish/
```

### 2. About the name

**Fluffipets is clean.** It returns no exact match on the App Store — searching
it produces only fuzzy fallbacks like *Fluvsies* and *Smolsies*, which is
Apple's search reporting that nothing is actually called this. Someone who
hears the name and types it will find you and nobody else, which is the
property you asked for and the one "Desktop Pet" and "Minipet" could not give.

Two consequences worth knowing:

- **The title had to shorten.** `Fluffipets: Desktop Pet Companion` is 33
  characters and the limit is 30, so the name is
  `Fluffipets: Desktop Pet Buddy` (29). "Buddy" catches "desktop buddy", and
  "companion" moved into the keyword field, where it is worth more anyway.
- **The name leans young.** Its nearest neighbours in Apple's index are casual
  pet games for children. This app is the opposite — a quiet companion for
  adults at a screen, whose main promise is that it never interrupts your work.
  Search does not care, but it means your subtitle, icon and first screenshot
  carry the positioning by themselves. They currently do this well; just do not
  let later copy drift toward that register to match the name.

### 3. One thing to fix in the app before you ship

`swift/App/Info.plist` sets `LSMinimumSystemVersion` to **13.0**, but
`docs/design.md` says macOS 14+. All the copy in this folder says **macOS 13
Ventura or later**, matching the plist, because that is what the built app
actually enforces. Decide which is true and make the two agree — if you mean
14, change the plist, `description.txt` and `site/*.html` together.

---

## Step 0 — Apple Developer Program

$99/year, at <https://developer.apple.com/programs/>. An individual account is
fine; a company account additionally needs a D-U-N-S number and takes longer.
Nothing below can start until this is active.

After the app is live, enrol in the **App Store Small Business Program** —
it drops Apple's cut from 30% to 15% under $1M/year, and it is a two-minute
form that most people forget.

---

## Step 1 — Publish the privacy policy and support pages

Apple **will not let you submit** without a working privacy policy URL, and a
support URL is required too. Both pages are written and waiting in `site/`.

Fill in your name and email first:

```bash
grep -rn "REPLACE-WITH-YOUR" publish/site/
```

Then, using GitHub Pages (free, no domain needed):

1. Create a public repository called `fluffipets`.
2. Copy `publish/site/*.html` into it and push.
3. Repository **Settings > Pages**, set Source to `main` / root, save.
4. Two minutes later the pages are live at:
   - `https://<your-username>.github.io/fluffipets/privacy.html`
   - `https://<your-username>.github.io/fluffipets/support.html`
5. Put those two URLs into `metadata/en-US/privacy-url.txt` and
   `support-url.txt` so you have them to paste later.

Open both in a browser before continuing. A privacy URL that 404s is a
guaranteed rejection, and it is the single most common reason a first
submission bounces.

---

## Step 2 — Get an Xcode project that can archive

This is the real engineering gap, and it is the only one left.

`swift/build.sh bundle` already produces a correct, signed, runnable
`DesktopPet.app` — but it cannot talk to App Store Connect. Uploading requires
an Xcode project or workspace so you can **Product > Archive**.

The cheapest route:

1. Open `swift/Package.swift` in Xcode (it opens as a Swift package).
2. Create a new **macOS App** target in a small wrapper Xcode project, and add
   the `PetCore` and `PetApp` sources to it.
3. Copy the settings that already carry product decisions out of
   `swift/App/Info.plist`: `LSUIElement` (true), `CFBundleIdentifier`,
   `LSMinimumSystemVersion`, and the icon.
4. Add the entitlements from `swift/App/DesktopPet.entitlements`. **App Sandbox
   is mandatory** for the App Store. It is already verified working —
   `docs/design.md` §5.2 records that window geometry, cursor polling,
   notifications, the login item and bundled assets all work sandboxed.
5. Set the signing team; let Xcode manage signing automatically.
6. Drop in the icon: `publish/icon/AppIcon.icns`, or drag the contents of
   `publish/icon/AppIcon.iconset/` into an `AppIcon` asset catalog entry.

Two things to check before you archive:

- **Build for release without `-DDEV_UNLOCK`.** This is already safe by
  construction — `build.sh bundle` never passes it — but your new Xcode target
  is a new build path, so confirm the flag is absent. With it, Pro is unlocked
  for free and the paywall does nothing.
- **Universal binary.** `build.sh` compiles for the host architecture only, so
  today's output is arm64-only and will not run on an Intel Mac. In Xcode set
  Architectures to **Standard (arm64, x86_64)** unless you intend to ship
  Apple-silicon-only.

Then **Product > Archive > Distribute App > App Store Connect**.

---

## Step 3 — Create the App Store Connect record

At <https://appstoreconnect.apple.com> > My Apps > **+** > New App.

| Field | Value |
|---|---|
| Platform | macOS |
| Name | `Fluffipets: Desktop Pet Buddy` (from `metadata/en-US/title.txt`) |
| Primary language | English (U.S.) |
| Bundle ID | the one you settled in "Before you start" |
| SKU | anything unique, e.g. `FLUFFIPETS001` |
| User access | Full Access |

The **Name** field is capped at 30 characters and `title.txt` is exactly 30.
Paste it, do not retype it.

---

## Step 4 — Fill in the product page

Paste each file into the matching field:

| App Store Connect field | File | Limit |
|---|---|---|
| Name | `metadata/en-US/title.txt` | 30 |
| Subtitle | `metadata/en-US/subtitle.txt` | 30 |
| Promotional Text | `metadata/en-US/promotional-text.txt` | 170 |
| Description | `metadata/en-US/description.txt` | 4000 |
| Keywords | `metadata/en-US/keywords.txt` | 100 |
| Support URL | `metadata/en-US/support-url.txt` | — |
| Marketing URL | `metadata/en-US/marketing-url.txt` | optional |
| What's New | `metadata/en-US/whats-new.txt` | — |

Verify everything still fits before pasting:

```bash
./publish/check-limits.sh
```

Then upload the six screenshots from `screenshots/`, **in filename order**.

Three rules about the keyword field that are easy to get wrong, all explained
in `aso/keyword-strategy.md`:

- no spaces after the commas — each one wastes a character
- no word repeated from the name or subtitle — repeats add nothing
- no multi-word phrases — Apple combines words across fields automatically

---

## Step 5 — Create the in-app purchase

Full details in `metadata/iap-fluffipets-pro.md`. In short:

- Type **Non-Consumable**, price **Tier 5 ($4.99)**
- Product ID `com.hiddenpotential.desktoppet.pro`

**The product id and the bundle id must agree with the code.** `Products.proID`
in `swift/Sources/PetApp/Products.swift` has to be exactly this string, and
this product has to belong to this app. If they do not match, `Product.products(for:)`
returns nothing, the purchase button stays disabled, and the app reports it has
nothing to sell — which is also what a reviewer would see.

Submit the IAP **together with** the first app version. A first version cannot
be approved with an in-app purchase that was never submitted for review.

---

## Step 6 — Privacy, category and ratings

- **App Privacy**: answer *"No, we do not collect data from this app"*. The
  reasoning, and the one question a reviewer might ask, is in
  `metadata/privacy-nutrition-label.md`. This earns the **Data Not Collected**
  label, which is a genuine selling point in this category — do not give it up
  by adding analytics before launch.
- **Category**: Entertainment primary, Productivity secondary.
- **Age rating**: answer None to everything; you get 4+.
- **Export compliance**: No encryption. Add
  `ITSAppUsesNonExemptEncryption = false` to Info.plist so you are never asked
  again.

All of this is spelled out in `metadata/categories-and-ratings.md`.

---

## Step 7 — App Review Information

Open `metadata/app-review-notes.txt` and paste the whole thing into the
**Notes** field.

Do not skip this. Fluffipets is an `LSUIElement` app: **no Dock icon, no
Command-Tab entry**. A reviewer who cannot work out how to quit your app will
reject it, and this has sunk plenty of menu-bar and agent apps. The notes open
by telling them: right-click the pet, then Quit.

The notes also pre-empt the other three things a reviewer will wonder about:
why the app reads window geometry (and that it reads geometry *only*), that the
free tier is a complete app rather than a demo, and why a "collects no data"
app carries the network entitlement (StoreKit).

No demo account is needed — the app has no login.

---

## Step 8 — TestFlight, then submit

Push a build to TestFlight and install it on a **second Mac** before you
submit. Notifications, launch at login and StoreKit all identify the app by its
bundle, so none of them behave correctly for a loose executable — a real
install is the only honest test.

Then Submit for Review. First reviews typically take 24-48 hours.

---

## After it is live

1. **Enrol in the Small Business Program.** 30% becomes 15%.
2. **Watch App Store Connect > Analytics** for which search terms actually
   convert. Move winners into the subtitle, cut dead words from keywords. The
   keyword field can only change in a new version; promotional text can change
   any time without review.
3. **Ask for ratings.** Rating count is a real ranking factor and it is the
   biggest lever a small app has.
4. **Record the preview video.** This product is motion, and a still cannot
   show a cat noticing your cursor. See `screenshots/README.md` for the shot
   order. Of everything left on this list, this is the one most likely to move
   the numbers.
5. **Consider localizing.** Each locale is a fresh 100-character keyword field.
   Simplified Chinese and Japanese are the obvious next two — the whole
   desktop-mascot tradition is Japanese, and `shimeji` is already in your
   keywords.

---

## Known gaps

Three things in this folder are deliberately unfinished, because they need
either your account or your hands:

1. **No Reminders-tab screenshot, and no purchase-point screenshot.** Both
   need input this machine will not synthesise — a click on a tab, and a
   scroll to the bottom of General. Settings > General itself *is* captured
   (`screenshots/source/settings-general-window.png`). The manual procedures
   are in `screenshots/README.md` and `metadata/iap-fluffipets-pro.md`; the
   purchase-point one is required by App Store Connect for the IAP record.
2. **No preview video.** Same reason, plus it wants a human eye. See above.
3. **The URLs are placeholders** until you do step 1.
