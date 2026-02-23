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

See each app's `CLAUDE.md` for app-specific dev/build commands.
