# Deploying the web build

The live URL Lara and Rabon use:

**https://dist-one-xi-6l5bcv6rkc.vercel.app**

Vercel project `dist` (team `aidan-herstiks-projects`). Permanent — it never
changes, so nobody has to be sent a new link.

## Deploy

```bash
npx expo export --platform web
copy deploy\vercel.json dist\vercel.json
cd dist
npx vercel deploy --prod --yes
```

⚠️ **The copy step is not optional.** `expo export` wipes and rewrites `dist/`,
so a `vercel.json` living only in there disappears on every build — and this
repo's `.gitignore` covers `dist/`, so git will not save you either. That is
exactly how it was lost the first time.

## Why the rewrite exists

`app.json` sets `web.output: "single"`, i.e. a single-page app: the server must
return `index.html` for **every** route and let the client router take over.
Without the rewrite, `/` works and every deep link 404s.

That failure is easy to miss, because the deploy reports success and the home
page looks perfect. On 2026-08-17 a deploy without it took `/feed` — the exact
URL Lara had been given — from 200 to 404. **Check a deep link after every
deploy, not just the root.**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://dist-one-xi-6l5bcv6rkc.vercel.app/feed
```

## Notes

- This is the WEB build. Useful for showing people quickly, but it is not the
  app: the native map, the camera and the image picker are degraded or absent.
  Real device testing is Expo Go or a TestFlight/APK build.
- The deployment is **public** and points at the real Supabase project
  (`dgxmesiouwajazyhbhkn`) with real accounts. Anyone with the URL can sign up.
- Google OAuth does not work from this origin unless the Vercel URL is added to
  Supabase's allowed redirect URLs. Email sign-in works.
