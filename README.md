# MKW Lounge All-Time Ladder Lab

An RT and CT statistics dashboard built from the public CSV exports provided by
[MKW Lounge](https://mkwlounge.gg/ladder/data.php?ladder_id=19). Event results,
player pages, and all source data remain attributed and linked to MKW Lounge.

## Automatic refresh and hosting

GitHub Actions discovers the current RT and CT seasons, refreshes their exports
every six hours, rebuilds the dashboard, runs the production tests, and deploys
the full application to Cloudflare Workers. The archived season exports are
cached between runs. The Cloudflare deployment keeps the `/api/live` server
route working; GitHub Pages would not run that endpoint.

The workflow also runs after every push to `main`, and it can be started at any
time from GitHub's **Actions** tab using **Run workflow**.

## First-time setup

1. Create a GitHub repository and push this project to its `main` branch.
2. Create or sign in to a Cloudflare account.
3. In Cloudflare, create an API token from the **Edit Cloudflare Workers**
   template and restrict it to the account that will host this site.
4. Copy the Cloudflare account ID from the Cloudflare dashboard.
5. In the GitHub repository, open **Settings > Secrets and variables > Actions**
   and add these repository secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
6. Open the GitHub **Actions** tab, select **Refresh MKW Lounge data and
   deploy**, and choose **Run workflow**.

The completed run prints the public `workers.dev` URL in its deployment step.
For a custom domain, open the deployed Worker in Cloudflare and use
**Settings > Domains & Routes > Add > Custom domain**.

## New seasons

The workflow probes MKW Lounge for the next odd-numbered RT ladder and the next
even-numbered CT ladder. When a new season appears, it automatically expands the
archive, refreshes the cache, and updates the live API to use the new ladder IDs.

## Local development

Requires Node.js `>=22.13.0`.

```bash
npm install
npm run data:refresh
npm run dev
```

Useful commands:

- `npm run data:download` downloads missing archived seasons and refreshes the
  current RT/CT seasons.
- `npm run data:discover` detects the latest RT and CT season IDs.
- `npm run data:build` generates `public/dashboard-data.json` from the CSVs.
- `npm test` builds the production Worker and runs the data/render tests.

The CSV archive under `work/csv/` is intentionally excluded from Git because it
is large. The generated dashboard JSON remains committed as a fallback snapshot.
