# Sports UNIGE — mobile client for the Bureau des sports (React Native / Expo)

A nicer mobile UI over the official Bureau des sports inscription site
(https://wwwi.unige.ch/service/sport/inscription/home), for personal use.

## What's here

- **Sports**: the list from the site's dropdown, with search.
- **Séances**: the time slots of a sport, with an "Inscrit·e" badge on the ones
  you're already registered to.
- **Inscription**: tap a slot to open the site's signup form in the background;
  the app shows its details (lieu, enseignant·e, prix, délai, téléphone) and
  "S'inscrire" accepts the conditions and clicks "Enregistrer" on the site.
  A full slot is reported as soon as you tap it (the site shows its
  "Interdit / complet" page instead of the form). Leaving the screen abandons
  the form without booking. Paid activities are left to the site.
- **Mes inscriptions**: your registrations (upcoming / past), read from the
  site's summary table. Pull to refresh reloads it from the site.
- **Se désinscrire**: on upcoming registrations in "Mes inscriptions", or by
  tapping an "Inscrit·e" slot. After a native confirmation, the app clicks the
  site's "Se désinscrire" and reads its "… a été annulée" page; if that page
  doesn't show up, it re-reads your registrations to tell what happened.

## Run it

```bash
npm install
npm start          # then scan the QR code with Expo Go (iOS / Android)
```

Web is not supported: the app relies on `react-native-webview`.

## Build & share (Android APK)

Builds run on EAS (Expo's build service), which also keeps the signing key.
One-time setup:

```bash
npx eas-cli login          # your Expo account
npx eas-cli init           # links this folder to an EAS project (writes projectId into app.json)
```

Then, for each release:

```bash
npx eas-cli build -p android --profile preview
```

The `preview` profile produces an installable **APK** and prints a link / QR
code to share. Version codes are incremented by EAS (`appVersionSource: remote`);
bump `version` in `app.json` for user-visible releases. The `production`
profile produces an AAB for the Play Store if ever needed.

Keep the same Expo account and package id (`com.mikefreeman.sportsunige`):
updates must be signed with the same key to install over a previous version.

## Build & share (iOS / TestFlight)

iOS has no APK equivalent, so sharing requires a paid **Apple Developer
account** (99 USD/year, enrol at developer.apple.com) and goes through
**TestFlight** instead of a direct link.

One-time setup, after enrolling:

```bash
npx eas-cli build -p ios --profile preview
```

The first run asks to log in with your Apple ID and walks through creating
the App Store Connect app record and signing credentials (EAS manages the
certificates and provisioning profile for you — just answer the prompts).

Then submit the finished build to TestFlight:

```bash
npx eas-cli submit -p ios --latest
```

In **App Store Connect → TestFlight**, add testers: internal (your team,
instant) or an external group via a public link (Apple does a short "Beta App
Review" the first time, usually a few hours). Testers install the **TestFlight**
app from the App Store, open your invite, and install Sports UNIGE from there.

Each build is usable for 90 days; push a new one before then to keep testers
on a working build. The `preview` iOS profile targets TestFlight directly
(`distribution: store`); there's no Android-style ad-hoc install link for iOS
without registering every tester's device individually.

## How it talks to the site

The site is an Oracle ADF + Shibboleth app with no API, so the app embeds it:

- `src/site/SiteWebView.tsx` mounts one WebView for the app's lifetime. It is
  hidden while the inscription app is loaded, and shown full-screen when it
  isn't (Shibboleth login, session expired, error page) so you can log in.
  The login session stays inside the WebView; the app never reads cookies.
- `src/site/bridge.ts` injects scripts into that page, one at a time (ADF is
  stateful), and returns their JSON result.
- `src/site/pageScripts.ts` holds those scripts. They read the ADF tables and
  drive the sport search like a user would (select sport → "Rechercher").
  **They depend on the site's element ids** (`pt1:qryId1:…`, `pt1:resId1`,
  `pt1:pc1:insTab`); if the site changes, this is the file to fix.
- `src/services/siteService.ts` is the only module the screens call.

The site stays authoritative: the app reads what the site shows and submits
through the site's own form, so its server-side checks (capacity, deadlines)
still apply. "Full" is only known when the site refuses to open the form.

## Known limits

- The site shows no capacity / spots left in the slot list, so neither can the app.
- Any answer other than "enregistrée" / "complet" is shown as-is, with a hint
  to check "Mes inscriptions".
- Location, teacher and price of a slot only appear once you start a signup on
  the site; the slot list shows description and date only.
- Very long result tables may be fetched lazily by ADF; only rows already
  rendered are read.

## Files

```
App.tsx                          navigation (tabs + stack) + the site WebView
src/site/                        WebView, bridge, page scripts
src/services/siteService.ts      the single boundary used by screens
src/hooks/useSiteQuery.ts        loading / error / refresh state
src/screens/*                    sports, slots, signup, my registrations
src/components/*                 Badge, QueryState
src/types.ts                     Slot / Registration + date/price helpers
```
