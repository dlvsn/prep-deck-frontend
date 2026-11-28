# Prep Deck — client

**English** · [Українська](README.uk.md)

The desktop app of Prep Deck: flashcards in nested topics, Markdown answers with pictures,
spaced-repetition practice and topics shared with other people. Built for Windows with Electron;
the same renderer also runs in a browser as the web version. It talks only to
[prep-deck-backend](https://github.com/dlvsn/prep-deck-backend).

## Stack

- Electron 45, electron-vite, frameless window with its own title bar
- React 18, TypeScript (strict), React Router, TanStack Query, Zustand
- i18next (English and Ukrainian), CSS Modules on theme tokens (light and dark, eight accents)
- react-markdown with Shiki highlighting, dnd-kit
- nginx in Docker for the web version

## What it does

- **Topics**: a tree nested without limit; create, rename, drag to reorder and nest, delete with
  confirmation, search with `Ctrl K`.
- **Cards**: a grid with filters; a card view and an editor with Markdown preview; up to five
  pictures (pick, drop or paste with `Ctrl V`, reorder, full-screen viewer); tags.
- **Sharing**: the Share dialog picks a whole topic or single subtopics, invites by email or
  username, lists people with access and waiting invitations, and runs the public link. Shared
  with me shows other people's topics grouped by owner, with Copy to my topics and Leave.
  `prepdeck://topic/<token>` links open the app.
- **Practice**: a "coming soon" screen until practice is built.
- **Accounts**: log in, sign-up with an email code, sessions kept in the OS keychain (DPAPI) with a
  silent refresh; theme, accent and language synced with the server.
- **Layout**: from a 360 px portrait window (bottom tab bar, full-screen dialogs) to a wide screen.

## Running it

### The desktop app, step by step

The desktop app runs on Windows straight from the code; there is no installer yet. You need:

- Windows 10 or 11
- [Node.js 22 LTS](https://nodejs.org) (npm comes with it)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/), to run the backend
- Git

**1. Get both parts.** The client needs the backend, so clone them side by side:

```
git clone https://github.com/dlvsn/prep-deck-backend.git
git clone https://github.com/dlvsn/prep-deck-frontend.git prep-deck-client
```

**2. Start the backend** (with its database and mail catcher) in Docker. Open Docker Desktop
first, then:

```
cd prep-deck-backend
docker compose up -d --build
```

The first build takes a few minutes. The backend is ready when
http://localhost:8080/api/auth/username-available?username=test answers with `"success":true`.

**3. Install the client.** In a second terminal:

```
cd prep-deck-client
npm install
```

This also downloads Electron itself (about 100 MB), once.

**4. Point it at the backend.** Copy the example settings:

```
cp .env.example .env
```

(`cp` works in PowerShell too.) The default `VITE_API_URL=http://localhost:8080/api` is the
backend from step 2; change it only if the backend runs elsewhere.

**5. Start it.**

```
npm run dev
```

The Prep Deck window opens. Keep the terminal open: closing it, or `Ctrl C`, closes the app. Code
changes show up in the window at once.

**6. Sign in.** Create an account; the confirmation code arrives in Mailpit at
http://localhost:8025 (no real email is sent). Then create a topic and your first cards.

**Next time** only steps 2 and 5 are needed: `docker compose up -d` in `prep-deck-backend` (if the
containers are stopped) and `npm run dev` here.

**Share links** (`prepdeck://topic/…`): the app registers that link type with Windows each time it
starts, so after the first `npm run dev` such a link opens the app. A link can also be pasted into
Shared with me.

**If something goes wrong**

- *The window says "No connection"*: the backend is not running (`docker compose ps` in
  `prep-deck-backend`), or `VITE_API_URL` in `.env` points elsewhere. Restart `npm run dev` after
  changing `.env`.
- *`npm install` fails while downloading Electron*: run it again; behind a proxy, set
  `ELECTRON_MIRROR` or the proxy for npm.
- *No confirmation letter*: open http://localhost:8025; Mailpit catches every letter.

A built app (`npm run build`, then `npm run preview`) loads its page from disk, and the backend
does not accept calls from such a page yet. Use `npm run dev` until the Windows installer and that
permission are added.

### Settings

| Variable | What it sets |
| --- | --- |
| `VITE_API_URL` | The backend, e.g. `http://localhost:8080/api` |
| `VITE_FORCE_ROLE` | Development only: My topics arrive with this role (`viewer`, `editor`) to check read-only screens |

### The web version

```
npm run dev:web
```

serves the same app at http://localhost:5173. Or run it in a container (`Dockerfile`,
`docker-compose.yaml`): it is built with Vite and served by nginx at http://localhost:8081:

```
docker compose up -d --build
```

`VITE_API_URL` is baked into the build; it comes from `.env` or defaults to
`http://localhost:8080/api`. The backend's compose file already allows the `localhost:8081`
origin. The desktop app itself is a Windows program and does not run in a container.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Desktop app in development |
| `npm run dev:web` | Web version in development |
| `npm run build` | Type check, then build the desktop app into `out/` |
| `npm run build:web` | Build the web version into `out/web` |
| `npm run typecheck` | TypeScript check of main, preload and renderer |
| `npm run i18n:check` | Fails when `en.json` and `uk.json` have different keys |

## Code layout

```
src/main        Electron main: window, saved size and position, safeStorage, prepdeck:// links
src/preload     the window.prepDeck bridge (typed in src/shared/bridge.ts)
src/renderer    a plain web app; reaches the host only through app/platform.ts
  app/          routing, shell, session, settings sync, deep links
  api/          HTTP client, types, one repository per area
  features/     auth, topics, cards, share, practice, settings
  ui/           shared components and icons
  theme/        tokens; i18n/ en and uk
```

Conventions (no hard-coded text, no literal colours, one place for permissions, dialog layers) are
in [CLAUDE.md](CLAUDE.md).
