# Oddumbthrifts Tracker

A mobile-friendly sales/expense tracker for a thrift reselling side gig, built to replace the
`Oddumbthrifts_Tracker_for_app.numbers` spreadsheet. Static site (works on GitHub Pages),
with Supabase as the backend so it syncs across devices.

## What it does

- **Items**: log something as soon as it's listed (cost, category, platform), then mark it
  sold later (sale price, platform fee, shipping cost). Net profit is calculated automatically.
- **Expenses**: log business costs that aren't tied to one item (supplies, subscriptions, etc.)
- **Dashboard**: this month's items sold, revenue, cost of goods, fees, expenses, net profit,
  margin, and average profit per item — plus a 6-month trend, matching the spreadsheet's dashboard.

## 1. Set up Supabase (free tier is plenty)

1. Go to [supabase.com](https://supabase.com), create an account, and create a new project.
2. Once it's ready, open **SQL Editor** → **New query**, paste in the contents of
   `supabase-schema.sql` from this folder, and click **Run**. This creates the `items` and
   `expenses` tables with Row Level Security, so each account only ever sees its own data.
3. Go to **Project Settings → API**. Copy the **Project URL** and the **anon / public** key.
4. Open `config.js` in this folder and paste those two values in:
   ```js
   export const SUPABASE_URL = "https://xxxxx.supabase.co";
   export const SUPABASE_ANON_KEY = "eyJhbGciOi...";
   ```
   The anon key is safe to publish in client-side code — Row Level Security is what actually
   keeps the data private, not hiding this key.
5. (Optional but recommended for one person's own use) Go to **Authentication → Providers →
   Email** and turn **off** "Confirm email" so the account works immediately after signup
   without waiting on a confirmation email.

## 2. Try it locally

Any static file server works, e.g. from this folder:
```
python3 -m http.server 8000
```
Then open `http://localhost:8000`. Create an account (email + password), and you're in.

## 3. Deploy to GitHub Pages

1. Push this folder's contents to a GitHub repo.
2. In the repo, go to **Settings → Pages**, set the source to your main branch (root folder).
3. GitHub gives you a URL like `https://yourusername.github.io/reponame/` — that's the app,
   installable to a phone's home screen from the browser's "Add to Home Screen" option.

## Notes

- All money math (net profit, margin, cost of goods sold) is done client-side from the raw
  numbers you enter — nothing is stored pre-calculated, so it stays accurate if you edit an
  item later.
- "Currently Listed" on the dashboard counts every item marked `Listed` right now, same as
  the spreadsheet's version — it isn't limited to the selected month.
- Categories and platforms in the dropdowns match what was already used in the spreadsheet
  (Tops, Bottoms, Dresses, Outerwear, Shoes, Accessories, Other / Depop, Vinted, Marketplace,
  Other). Edit the `<option>` lists in `index.html` if those need to change.
