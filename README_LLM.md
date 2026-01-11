# LLM Contributor Notes

This file is a quick, concise guide for large language models (LLMs) working on
this project. Keep changes small, targeted, and consistent with existing code.

## Project Overview
- Full-stack app with a React client and Express server.
- Notes live in `notes.json` and are managed via `/api/notes`.
- The Notes tab uses a markdown editor/preview toggle.

## Repo Layout
- `client/`: Vite + React UI.
- `server/`: Express API and server logic.
- `shared/`: Shared types/schema.
- `notes.json`: Persistent storage for notes.

## Common Commands
Run from repo root.
- Dev server: `npm run dev`
- Build: `npm run build`
- Start prod: `npm run start`
- Typecheck: `npm run check`

## Notes Panel Behavior
File: `client/src/components/notes-panel.tsx`
- Default mode is edit (textarea).
- Preview mode renders full markdown, not per-line.
- Preview uses `react-markdown` with `remark-gfm` and `rehype-highlight`.
- Toggle button is an icon-only eye in the header.

## Markdown Styling
File: `client/src/index.css`
- `markdown-content` styles headings, lists, code, blockquotes.
- Tables and task lists are styled for GFM.
- Highlight.js classes are styled for code blocks.

## Data Flow
- Notes are fetched via React Query with key `["/api/notes"]`.
- Mutations update the API and invalidate the query.
- Auto-save runs on a debounce timer (400ms).

## Expected Conventions
- Keep UI strings short and consistent with existing labels.
- Avoid heavy refactors unless requested.
- Use ASCII in new files unless a file already contains non-ASCII content.
