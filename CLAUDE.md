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
  - `app/` routing, shell, providers · `api/` HTTP client, types, repositories ·
    `features/` screens · `ui/` shared components and icons · `theme/` tokens · `i18n/` en, uk.
  - `features/cards/`: the grid (`CardsSection`), the card dialog (`CardModal` → `CardView` /
    `editor/CardEditor`), `images/` (slots with upload queue, gallery, lightbox, file drop),
    `markdown/` (render with Shiki, toolbar edits), `cardModalStore` (who opens the dialog),
    `useCards` (queries and optimistic mutations), `drafts` (local editor drafts).

## Conventions

- No hard-coded user-facing text: every string is a key in `i18n/en.json` and `i18n/uk.json`
  (`npm run i18n:check` compares them). English texts as on the mockups. Code and commits in English.
- No literal colours in components: only the variables of `theme/tokens.css`.
- CSS Modules per component; animate only `transform` and `opacity` (plus theme colours).
- The backend answers every call with `{ success, message, data }`; `api/http.ts` unwraps it.
  Each repository is an interface in `api/repositories.ts`, implemented over HTTP in `api/http/`
  and wired in `api/index.ts`. There are no mocks: the client needs prep-deck-backend running at
  `VITE_API_URL`. Areas the backend does not serve yet (practice, sharing) are not in
  `Repositories`; their interfaces stay in the file as the contract.
- What a user may do on a topic goes through `can(action, topic)` in
  `features/topics/permissions.ts`, from `topic.role`; nothing else looks at roles. Actions the
  role does not allow are not rendered (not shown disabled). The backend answers `owner` until
  sharing exists; `VITE_FORCE_ROLE=viewer|editor` (development only) tries the other roles.
- Dialogs use `ui/dialogLayer.ts`: layers stack, only the top one takes Escape and Tab. A widget
  that handles Escape itself while open marks itself `data-own-escape`.
- A file dropped on the window never opens in it: `main.tsx` cancels stray drops and the main
  process refuses navigation; drop zones use `features/cards/images/useFileDrop`.
- Icons are in-house SVGs in `ui/icons.tsx`, drawn in the Lucide style.
