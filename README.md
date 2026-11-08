# My Teacher Books

A free, local-first classroom library kiosk and book inventory for elementary teachers (grades K–5). Students check books out and in with a barcode scan, teachers manage the catalog, and everything works offline in the browser. No accounts, no backend.

- **Teachers:** see the [user manual](INSTRUCTIONS.md).
- **Optional:** sign in with Google to sync your book catalog across devices through your own Google Sheet (manual "Sync Now" only).

## Development

Requires Node 22 or newer.

```bash
npm install
cp .env.example .env   # optional: use your own Google OAuth client ID for sync
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Run the unit tests (Vitest) |
| `npm run lint` | Lint with ESLint |
| `npm run build` | Typecheck and build to `dist/` |

Built with React, Vite, TypeScript, Dexie (IndexedDB) and a PWA service worker.

## License

[MIT](LICENSE)
