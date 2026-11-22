# prep-deck-client

The desktop client of Prep Deck: Electron + React 18 + TypeScript (strict) + electron-vite.
The spec is `../Recall — ТЗ для агента (Electron + Java).md` (the app was renamed from Recall to
Prep Deck; the deep link is `prepdeck://`). It is the source of truth; the mockups illustrate it.
Work goes stage by stage as the spec's «Етапи» section lists them. Windows only: no macOS code.

## Layout

- `src/main` — Electron main: the frameless window, its saved size and position, safeStorage.
- `src/preload` — the `window.prepDeck` bridge, typed in `src/shared/bridge.ts`.
- `src/renderer` — a plain web app; `vite.web.config.ts` runs it in a browser (the future web
  version). It reaches the host only through `app/platform.ts`, never `window.prepDeck`.
  - `app/` routing, shell, providers · `api/` HTTP client, types, repositories, `mocks/` ·
    `features/` screens · `ui/` shared components and icons · `theme/` tokens · `i18n/` en, uk.

## Conventions

- No hard-coded user-facing text: every string is a key in `i18n/en.json` and `i18n/uk.json`
  (`npm run i18n:check` compares them). English texts as on the mockups. Code and commits in English.
- No literal colours in components: only the variables of `theme/tokens.css`.
- CSS Modules per component; animate only `transform` and `opacity` (plus theme colours).
- The backend answers every call with `{ success, message, data }`; `api/http.ts` unwraps it.
  Each repository is an interface in `api/repositories.ts` with a mock in `api/mocks`
  (`VITE_USE_MOCKS=true`), so the client runs without a backend.
- Icons are in-house SVGs in `ui/icons.tsx`, drawn in the Lucide style.
