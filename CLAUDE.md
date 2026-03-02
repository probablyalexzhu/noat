# Noat — Monorepo Engineering Standards

## Project overview

Noat is a minimalist note-taking app with local-first SQLite storage and realtime Supabase sync. This monorepo contains the mobile app (Expo/React Native), desktop app (Tauri/React/Vite), and a shared sync package.

## Monorepo structure

```
apps/mobile/      Expo (React Native) — iOS/Android client
apps/desktop/     Tauri (Rust + React + Vite) — macOS/Windows/Linux client
packages/sync/    Shared Supabase sync logic
```

Each app has its own `CLAUDE.md` with app-specific architecture, patterns, and commands. Refer to those for detailed guidance:

- `apps/mobile/CLAUDE.md` — mobile-specific standards
- `apps/desktop/CLAUDE.md` — desktop-specific standards

## Shared conventions

- TypeScript with `strict: true` across all packages
- Prettier: single quotes, trailing commas, 100 char line width, 2-space indent (see `.prettierrc`)
- ESLint with prettier plugin in each app
- Pre-commit hooks via husky + lint-staged (auto-formats and lints staged files)
- Path alias `@/*` maps to the app/package source root

## Architecture patterns

**Separation of concerns.** Each app's main screen/component is an orchestration layer: it owns core state and CRUD handlers, delegates side effects to hooks, and delegates UI to components.

- **Hooks** (`hooks/`) encapsulate stateful logic with side effects (timers, listeners, keyboard events). Each hook has a clear single responsibility.
- **Components** (`components/`) are presentational where possible — they receive props and render UI.
- **Lib** (`lib/`) contains pure utilities with no React dependencies (database, theme palettes, sync).

**Comment blocks for subtle interactions.** When code involves non-obvious coordination between multiple files or mechanisms, add a block comment explaining the "why", not the "what". Don't add comments for self-explanatory code.

## Bug fixing guidelines

When fixing UI bugs, try the simplest possible approach first. Do NOT layer complex workarounds. If a fix introduces a regression, immediately revert and propose a cleaner alternative.

## Commands

Monorepo-level:

- `npm run format` — Prettier auto-format across all packages
- `npm run lint` — ESLint check across all workspaces
- `npm run typecheck` — type-check across all workspaces

Per-workspace (run from root):

- `npm run lint --workspace=apps/desktop` — lint desktop
- `npm run lint --workspace=apps/mobile` — lint mobile
- `npm run format --workspace=apps/desktop` — format desktop
- `npm run typecheck --workspace=apps/desktop` — type-check desktop

- `npm test` — run sync integration tests (packages/sync)

See each app's `CLAUDE.md` for app-specific dev/build commands.

## Sync architecture notes

**Supabase realtime DELETE events are silently dropped** when the table uses default REPLICA IDENTITY. DELETE payloads only contain PK columns (`id`), not `user_id`, so the `user_id=eq.${userId}` filter never matches. Workaround: `pull()` reconciles on focus/foreground, and the realtime handler manually deletes from local SQLite on DELETE events it does receive.

**Circular hook dependency.** `useRealtimeSync` and `useAutosave` depend on each other (`useAutosave` needs `handleNoteDirty` from realtime; realtime's `onRemoteChange` callback needs `contentCache` from autosave). This forces a specific declaration order in App.tsx/index.tsx where callbacks are defined before the hooks that provide their dependencies. The callbacks access refs via closure (safe at runtime) but can't list them in `useCallback` dep arrays (TypeScript TDZ errors). The resulting exhaustive-deps lint warnings are expected and acceptable.

**`useRealtimeSync` owns all sync lifecycle**: subscribe, push debounce, pull on focus/foreground, and auto-resubscribe on channel error. The main component passes `onRemoteChange` and `onPullCompleted` callbacks to react to sync events without owning the listeners.

## Cross-platform consistency

When adding logic that applies to both desktop and mobile, keep the implementations parallel:

- Extract shared pure functions to `lib/` (e.g., `getValidThemeOrDefault` in `lib/theme`)
- Use the same cache helper pattern (`initNoteInCache`/`removeNoteFromCache`) in both apps
- Mobile uses synchronous SQLite (expo-sqlite); desktop uses async (tauri plugin-sql) — same logic, different await patterns
- Mobile `AppState` ≈ Desktop `getCurrentWindow().onFocusChanged()` for foreground detection
