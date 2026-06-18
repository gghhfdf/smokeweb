# Cabinet Ops Smokeweb

High-end product showcase for adult tobacco products. The site is a React + Vite frontend deployed on GitHub Pages, with product, image, settings, and local-demo administrator data stored in Supabase.

## Local Development

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example` and provide the Supabase URL plus public anon key.

## Deployment

Pushes to `main` run `.github/workflows/deploy-pages.yml`.

The workflow builds with:

- `GITHUB_PAGES=true`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Only the public anon key is used in the browser. Never place a Supabase `service_role` key in this repository or any frontend deployment environment.
