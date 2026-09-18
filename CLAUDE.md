# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

Package manager is **Bun** (`packageManager: bun@1.4.2`, `bun.lock`). Do not use npm/yarn/pnpm.

```bash
bun install            # install deps
bun dev                # dev server on http://localhost:3000
bun run build          # production build
bun start              # serve the production build
bunx tsc --noEmit      # typecheck (no lint or test scripts are configured)
bunx shadcn add <name> # add a shadcn component into src/components/ui
```

There is no test runner, ESLint, or Prettier config in this repo yet. `bun run build` is the only end-to-end check besides `tsc`.

## Stack and where things live

- **Next.js 16.3.5, App Router, `src/app/`.** This version differs from older Next.js; the docs shipped in `node_modules/next/dist/docs/` are the source of truth (see AGENTS.md). Note e.g. that `RootLayout` uses the Next-provided global `LayoutProps<"/">` type instead of a hand-written props type.
- **Path alias:** `@/*` maps to `./src/*`.
- **Tailwind CSS v4, CSS-first.** There is no `tailwind.config.*` (components.json has `"config": ""`). All theme configuration lives in `src/app/globals.css`:
  - `@theme inline` maps Tailwind tokens (`--color-*`, `--font-*`, `--radius-*`) to CSS variables.
  - Design tokens are defined in oklch on `:root` and overridden under `.dark`. Dark mode is class-based via `@custom-variant dark (&:is(.dark *))`, not media-query based.
  - Radius scale derives from a single `--radius`; use `rounded-sm/md/lg/xl/...` rather than arbitrary values.
- **shadcn v4** (`components.json`): style `base-sera`, base color `mist`, CSS variables on, RSC on. Components are built on **`@base-ui/react`**, not Radix, so don't reach for `@radix-ui/*` packages. Icon library is **Hugeicons** (`@hugeicons/react` + `@hugeicons/core-free-icons`), not lucide. Aliases: `@/components`, `@/components/ui`, `@/lib`, `@/hooks`.
- **`cn` helper:** `src/lib/utils.ts` re-exports `cn` from the `cn` npm package (shadcn's compiled clsx + tailwind-merge). Import it as `import { cn } from "@/lib/utils"`.
- **Fonts** are loaded in `src/app/layout.tsx` via `next/font/google` and exposed as CSS variables, which `@theme inline` maps to Tailwind utilities:
  - `font-sans` → IBM Plex Sans (`--font-sans`)
  - `font-heading` → Space Grotesk (`--font-heading`)
  - `font-mono` → Geist Mono (`--font-geist-mono`)
  - Geist Sans is also loaded (`--font-geist-sans`) but is not mapped to a Tailwind token.
- `src/app/page.tsx` is still the create-next-app placeholder.
