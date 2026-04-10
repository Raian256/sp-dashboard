# Study Dashboard — Super Productivity Plugin

A personal study-time tracking dashboard built as a plugin for [Super Productivity](https://super-productivity.com). It gives a weekly overview of time spent studying, with configurable daily and weekly goals, progress tracking, and per-project breakdowns — all in a single self-contained HTML file with no external dependencies.

---

## Features

- **Weekly time tracking** with configurable week start day
- **Daily and weekly goals** with prorated progress bars and ahead/behind indicators
- **Period comparisons** showing hour diffs vs. previous week / yesterday
- **Time Tracked chart** — bar chart with Last 7 Days / 30 Days / 8 Weeks / 12 Months views
- **Project Breakdown** — pie chart showing time distribution across projects
- **Per-project hour cards** with weekly goal percentages and lifetime totals
- Native charts rendered with vanilla JS and CSS (no charting libraries)
- Light/dark theme support matching Super Productivity
- Live updates when task data changes in the host app
- Fallback mock data for standalone development

---

## Project Structure

```
sp-dashboard/
├── index.html              # Main UI (CSS + JS embedded)
├── manifest.json.template  # Template used at build time
├── plugin.js               # Super Productivity integration script
└── icon.svg                # Plugin icon

tests/
└── index.test.js           # Vitest/JSDOM unit tests

scripts/
├── minify.sh               # HTML minifier
├── screenshot.js           # Puppeteer screenshot generator
└── check-js.js             # Syntax checker

Makefile                    # Build & release helpers
package.json                # Node tooling and dependencies
```

> All plugin logic resides in a single HTML file to conform with the host app's plugin sandbox.

---

## Installation

1. Download the latest [Release](https://github.com/dougcooper/sp-dashboard/releases)
2. Open Super Productivity → Settings → Plugins
3. Click "Load Plugin from Folder"
4. Select the `sp-dashboard` zip file

---

## Development

### Prerequisites

- Node.js (18+) and npm
- `make` available (macOS/Linux)

### Install dependencies

```bash
npm install
```

### Running tests

```bash
npm test
make test
```

### Building for release

```bash
make build       # minifies and zips into build/sp-dashboard
make release     # build + tag + GitHub release (requires gh CLI)
```

### Updating screenshots

```bash
npm run screenshot   # outputs to assets/
```

---

## How It Works

- `plugin.js` runs in the host app and listens for Redux `ACTION` hooks, posting `SP_STATE_CHANGED` messages to the iframe
- `index.html` receives these messages and pulls task/project data via `PluginAPI`
- All date calculations use local timezone; the week range is determined by the user-selected start day
- Goals and UI preferences are persisted in `localStorage`
- When opened standalone (no `PluginAPI`), mock data is loaded for development

---

## License

MIT
