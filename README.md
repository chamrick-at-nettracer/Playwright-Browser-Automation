# Playwright-Browser-Automation

Automates a browser to process items from a CSV file: for each row, it looks up the item by Load Record and Item Number, makes a trivial change, and saves.

---

## Documentation

| Document | Description |
| -------- | ----------- |
| [**Getting Started**](docs/GETTING_STARTED.md) | Setup, credentials, selectors, and how to run the automation |
| [**PRD**](docs/PRD.md) | Product Requirements Document – requirements and technical specifications |
| [**Planned Changes**](docs/PLANNED_CHANGES.md) | Checklist of agreed-upon changes to implement |
| [**Completed Changes**](docs/COMPLETED_CHANGES.md) | Record of implemented changes |

---

## Quick Start

1. `npm install` and `npm run install:browsers`
2. Copy `credentials.example.json` to `credentials.json` and add your app URL and email
3. `npm run test:sample` to test with 5 rows
4. `npm start` to run the full automation

See [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) for details.
