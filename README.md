# BugTrack Node package

Report Node.js / Express exceptions to BugTrack (AppRadar) — same ingest model as the Laravel package (`ciplnew/bugtracking`).

Dashboard: https://appradar.colanapps.in/login

## Install

```bash
npm install @ciplnew/bugtracking
```

Or from GitHub:

```bash
npm install github:cipl-sheik/bugtracking-node
```

## Setup

1. Log in at https://appradar.colanapps.in/login
2. Create a project — copy the **project token** shown there
3. Add env vars in your Node app:

```env
BUGTRACK_ENABLED=true
BUGTRACK_URL=https://appradar.colanapps.in/api/v1/ingest
BUGTRACK_KEY=your-project-token
BUGTRACK_ENVIRONMENT=production
```

| Env | What it is |
|-----|------------|
| `BUGTRACK_URL` | Ingest API endpoint |
| `BUGTRACK_KEY` | Token created with the project (sent as `X-Bugtrack-Key`) |
| `BUG_TRCAK_KEY` | Legacy alias — still accepted if `BUGTRACK_KEY` is missing |

4. Wire the SDK:

```js
const express = require('express');
const bugtrack = require('@ciplnew/bugtracking');

bugtrack.init({
  enabled: true,
  url: process.env.BUGTRACK_URL,
  key: process.env.BUGTRACK_KEY,
  environment: process.env.NODE_ENV || 'production',
});

bugtrack.captureProcessErrors();

const app = express();
app.use(bugtrack.requestHandler());

// ... your routes ...

app.use(bugtrack.errorHandler()); // after routes, before your own error handler
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
| `ignore` | — | `[]` |
| `connectTimeoutMs` | `BUGTRACK_CONNECT_TIMEOUT_MS` | `2000` |
| `timeoutMs` | `BUGTRACK_TIMEOUT_MS` | `3000` |

Client errors (`status` / `statusCode` below 500) are skipped automatically.
