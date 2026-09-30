# BugTrack Node package

Report Node.js / Express exceptions to BugTrack — same ingest model as the Laravel package (`ciplnew/bugtracking`).

## Install

```bash
npm install @ciplnew/bugtracking
```

## Setup

1. Get a project key from https://bugtracking.colanapps.in
2. Add env vars (or pass options to `init`):

```env
BUGTRACK_ENABLED=true
BUGTRACK_URL=https://bugtracking.colanapps.in/api/ingest/
BUGTRACK_KEY=your-project-key
# legacy alias still accepted:
# BUG_TRCAK_KEY=your-project-key
BUGTRACK_ENVIRONMENT=production
```

3. Wire the SDK in your app:

```js
const express = require('express');
const bugtrack = require('@ciplnew/bugtracking');

bugtrack.init({
  enabled: true,
  url: process.env.BUGTRACK_URL,
  key: process.env.BUGTRACK_KEY || process.env.BUG_TRCAK_KEY,
  environment: process.env.NODE_ENV || 'production',
});

// optional: uncaughtException / unhandledRejection
bugtrack.captureProcessErrors();

const app = express();

app.use(bugtrack.requestHandler());

app.get('/debug-bugtrack', () => {
  throw new Error('My first BugTrack error!');
});

// Must be after routes — reports then forwards to your own error handler
app.use(bugtrack.errorHandler());

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ message: err.message });
});
```

## Manual report

```js
try {
  // ...
} catch (err) {
  await bugtrack.report(err, { req, user: req.user });
  throw err;
}
```

## Options

| Option | Env | Default |
|--------|-----|---------|
| `enabled` | `BUGTRACK_ENABLED` | `false` |
| `url` | `BUGTRACK_URL` | — |
| `key` | `BUGTRACK_KEY` / `BUG_TRCAK_KEY` | — |
| `environment` | `BUGTRACK_ENVIRONMENT` | `NODE_ENV` / `production` |
| `ignore` | — | `[]` (class or error name) |
| `connectTimeoutMs` | `BUGTRACK_CONNECT_TIMEOUT_MS` | `2000` |
| `timeoutMs` | `BUGTRACK_TIMEOUT_MS` | `3000` |

Client errors (`status` / `statusCode` below 500) are skipped automatically, matching the Laravel reporter.
