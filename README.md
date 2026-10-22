# Coach Dee website (coachdee.fit)

The website for Coach Dee, Danielle Edmundson's personal training business in Santa Cruz. It's a plain HTML/CSS site with no build step, published to **GitHub Pages** automatically whenever `main` changes.

## What's where

```
coachdee-site/
├── site/                     ← everything that gets published
│   ├── index.html            ← ALL the words on the page, in labeled sections
│   ├── style.css             ← the look: colors, fonts and sizes are set at the top
│   ├── thanks.html           ← shown after someone sends the contact form
│   └── images/               ← photos, logo, video, browser-tab icon
├── .github/workflows/
│   └── deploy.yml            ← publishes site/ to GitHub Pages on every push to main
│                               (arrives in the main folder; setup step 0 moves it here)
└── README.md                 ← this file (not published)
```

## Previewing on your computer

Double-click `site/index.html` and it opens in your browser. After you edit and save, refresh the browser to see the change.

## Editing

**Words:** open `site/index.html`. Sections are marked in capitals (`HERO`, `THE D.E.E.`, `ABOUT DANIELLE`, `CLIENT QUOTE`, `HOW WE TRAIN`, `CONTACT`, `FOOTER`). Change only the text between `>` and `<`. Write `&` as `&amp;`. Phone numbers also appear inside `tel:8313457779` links, so change those too.

**Colors and fonts:** open `site/style.css`. Every setting is in the first box, with a note on each line. Change a color once and it updates everywhere.

**Photos:** drop a new photo into `site/images/`. Either give it the same name as the one it replaces, or update the name in `index.html`. Keep photos under about 500 KB (squoosh.app shrinks them).

A good free editor for all of this is **VS Code** (code.visualstudio.com). Open the `coachdee-site` folder in it to see everything side by side.

---

## Putting it on GitHub Pages (one-time setup)

The easiest way without the command line is **GitHub Desktop** (desktop.github.com).

0. **Move the workflow into place (once).** The deploy workflow arrived as `deploy.yml` in this folder, but GitHub only runs workflows stored in `.github/workflows/`. Open **Terminal** and paste:

   ```
   cd ~/Documents/coachdee-site && mkdir -p .github/workflows && mv deploy.yml .github/workflows/
   ```

   (Folders starting with a dot are hidden in Finder. Press Cmd + Shift + . to show them.)
1. **Create the repo.** In GitHub Desktop, choose *File › Add Local Repository*, pick this `coachdee-site` folder, and click *create a repository* when it offers. Then click **Publish repository**. Free GitHub accounts need the repo to be **public** for Pages.
2. **Turn on Pages.** On github.com, open the repo and go to **Settings › Pages**. Under *Build and deployment › Source*, choose **GitHub Actions**.
3. **Deploy.** Go to the **Actions** tab, open *Deploy site to GitHub Pages*, and click **Run workflow** (or just push any change). After a minute or so, the site is live at `https://<your-username>.github.io/coachdee-site/`.

**After that, every update works the same way:** edit, save, then in GitHub Desktop write a short summary, click **Commit to main**, then **Push origin**. The site updates itself within about a minute. You can watch progress in the repo's *Actions* tab.

## Connecting coachdee.fit

1. In the repo: **Settings › Pages › Custom domain**. Type `coachdee.fit` and save.
2. Wherever the domain is registered (GoDaddy, Namecheap, Squarespace, etc.), add these DNS records:

   | Type | Name | Value |
   |---|---|---|
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |
   | CNAME | www | `<your-username>.github.io` |

3. Wait for the check mark in Settings › Pages (it can take a few hours), then tick **Enforce HTTPS**.

## The contact form

The form sends each message to **danielleedmundson@gmail.com** through FormSubmit (formsubmit.co), a free service. GitHub Pages can't receive form messages on its own, so this handles it.

- **One-time activation:** the first time anyone submits the form (do a test yourself), FormSubmit emails Danielle an "Activate Form" link. She clicks it once, and every message after that arrives in her inbox. Check spam if it doesn't show up.
- **To hide her email from the page source:** after activation, FormSubmit gives a random alias address. Swap it into the form's `action="https://formsubmit.co/..."` in `index.html`.
- **To send messages elsewhere:** change the email address in that same `action`.

## Still to fill in

- **Client quote:** currently "— A Client". Add the name with their OK (search `CLIENT QUOTE`).
- **Prices:** the three training options say "Ask about pricing". Replace with real prices to show them (search `HOW WE TRAIN`).
