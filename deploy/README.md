# Deploying the web build

The live URL Lara and Rabon use:

**https://dist-one-xi-6l5bcv6rkc.vercel.app**

Vercel project `dist` (team `aidan-herstiks-projects`). Permanent — it never
changes, so nobody has to be sent a new link.

## Deploy

```bash
npm run deploy:web
```

**That is the ONLY supported way.** It runs `scripts/deploy-web.sh`.

<details>
<summary>The manual commands, and why they are WRONG (kept as a warning)</summary>

```bash
npx expo export --platform web
copy deploy\vercel.json dist\vercel.json
cd dist
npx vercel deploy --prod --yes
```

These steps ship a build with NO ICONS. `expo export` emits every
`@expo/vector-icons` font under `dist/assets/node_modules/@expo/...`, and
**Vercel silently drops any path containing `node_modules`**. The fonts are
never uploaded, the catch-all rewrite answers the font request with
`index.html`, the browser cannot parse HTML as a font, and **every icon in the
app renders as a tofu box**.

Measured on the live deploy, 2026-08-18:

    /favicon.ico                          -> image/vnd.microsoft.icon   OK
    /_expo/static/css/web-....css         -> text/css                   OK
    /assets/node_modules/.../Ionicons.ttf -> text/html                  BROKEN

`deploy/vercel.json` cannot save you: a rewrite cannot serve a file that was
never uploaded.

</details>

### What the script does that you would forget

1. Moves `dist/assets/node_modules` to `dist/assets/vendor`, repoints every
   reference inside the JS and CSS bundles, and **hard-fails** if one survives.
2. Writes the SPA rewrite into `dist/` itself.
3. Deploys `dist/` to production.

The failure mode is invisible from the deploy output - it reports success, the
page loads, the layout is perfect, and only the glyphs are missing. That is
exactly why it shipped repeatedly.

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
