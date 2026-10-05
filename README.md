# Meal Prep · Reiff household

Mobile-first static web app for weekly meal prep (Rory, Wendy, Chloe).

**Live:** https://roryreiff.github.io/meal-prep/

## Run locally

```bash
cd mealprep-app   # or this repo root
python3 -m http.server 8765
# open http://127.0.0.1:8765/
```

## Update next week's plan

1. Edit `data/week.json` (dinners, Chloe's lunches, grocery, prep steps, components).
2. Commit and push to `main`:

```bash
git add data/week.json
git commit -m "Week of Oct 19: update menu + grocery"
git push
```

GitHub Pages rebuilds in about a minute. No other deploy step.

## Features

- **Menu** — dinners with estimated cal/protein for Rory's ~600/45g plate, Chloe's Mon–Thu lunches, breakfasts, Creami
- **Grocery** — Sprouts list by section, checkboxes persist in localStorage
- **Prep** — Sunday ~90-min timeline with checkable steps
- **Macros** — weigh plate components (prefilled per-100g, editable) or define a custom batch
- **Ratings** — thumbs up/down + note per meal, persisted for future rotations

Macros are labeled as estimates. Offline after first load (service worker). Works under the `/meal-prep/` GitHub Pages subpath.
