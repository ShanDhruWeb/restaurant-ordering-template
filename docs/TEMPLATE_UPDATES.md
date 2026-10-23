# Pulling template updates into a restaurant's repository

Each restaurant has its own repository created from this template. When the template improves (a bug fix, a new feature), bring it in like this.

## The golden rule

Restaurant-specific changes go **only** in:

- `restaurant.config.ts`
- `public/restaurant/`
- `prisma/menu.json`
- environment variables (Vercel)

If you never edit anything else in a client repo, every update merges cleanly. If a restaurant really needs custom code, make it a config option in the template instead, so every restaurant benefits.

## One-time setup (per client repo)

```bash
git remote add template https://github.com/<org>/<template-repo>.git
git fetch template
```

"Use this template" on GitHub creates a repository with **unrelated history**, so the first merge needs a flag:

```bash
git merge template/main --allow-unrelated-histories
```

Expect conflicts in the files above on this first merge: keep the client's version (`git checkout --ours restaurant.config.ts public/restaurant prisma/menu.json`), keep the template's version of everything else, then commit.

## Each update

```bash
git checkout -b template-update-<version>
git fetch template
git merge template/main
npm install
npm run check                   # must pass
```

1. Read `CHANGELOG.md` for the new version: it says if there are new config fields, new environment variables or new migrations.
2. If `npm run check` complains about the config, add the new fields to `restaurant.config.ts`.
3. Open a pull request, let CI pass, merge, and let Vercel deploy.
4. Migrations: run `npm run db:migrate` against the production database (with `DATABASE_URL_UNPOOLED` set) **before** or right after the deploy, as the changelog says.
5. Check `/api/health` and place a test order if payments changed.
6. Update the client list with the new template version.
