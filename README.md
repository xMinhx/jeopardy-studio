# Jeopardy Scoreboard

A polished, dual-window Jeopardy-style scoreboard desktop app built for quiz show hosts. One window for you, one window for the audience — fully in sync.

![Electron](https://img.shields.io/badge/Electron-31-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

---

## What It Does

**Jeopardy Scoreboard** gives you a complete host toolkit:

- **Control window** — manage teams, scores, the timer, and the board all from one place
- **Display window** — a clean audience-facing view that updates live as you play
- **5×5 quiz board** — customizable categories and point values, with per-cell state tracking (open, claimed, locked, disabled)
- **Live score panel** — add/remove teams, pick colors, adjust scores instantly with +/− buttons
- **Countdown timer** — presets from 15 s to 90 s, keyboard shortcuts (Space / R / 1–6), and audio cues
- **Question & answer reveal** — show questions to contestants with a single click, then reveal answers when ready
- **Edit mode** — change any cell's question, answer, or value mid-game without losing state
- **Import / export** — save and load full game configurations as JSON files

---

## Screenshots

> _Coming soon — run the app locally and take your own!_

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 22.7 or later
- npm (bundled with Node.js)

### Install & Run

```bash
git clone https://github.com/xMinhx/jeopardy-scoreboard.git
cd jeopardy-scoreboard
npm install
npm run dev
```

Two windows will open: the **Control** window (for the host) and the **Display** window (for the audience/projector).

### Build a Distributable

```bash
npm run build
```

Packaged installers are output to the `release/` directory.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Start / pause the timer |
| `R` | Reset the timer |
| `1` – `6` | Set timer preset (15 s → 90 s) |

---

## Project Structure

```
├── electron/
│   ├── main/         # Electron main process & window management
│   └── preload/      # Secure IPC bridge (contextBridge)
├── src/
│   ├── windows/      # Control.tsx (host UI) · Display.tsx (audience UI)
│   ├── store/        # Zustand state (board, teams, timer)
│   ├── hooks/        # useTimer · useTimerAudio · useAnimatedNumber
│   ├── services/     # Default board presets
│   ├── types/        # TypeScript interfaces & Zod schemas
│   └── utils/        # JSON persist helpers
├── public/
│   ├── assets/       # Audio files (timer track, ending chime)
│   └── board-default.json
└── tests/            # Vitest + React Testing Library
```

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Desktop shell | Electron 31 |
| Frontend | React 18 + TypeScript 5.6 |
| Styling | Tailwind CSS 3.4 |
| State | Zustand 4.5 |
| Validation | Zod 3.23 |
| Build | Vite 5.4 + Electron Builder |
| Tests | Vitest 2.1 + React Testing Library |

---

## Configuration

Load a custom board by going to **File → Import** in the Control window and selecting a JSON file. The format is documented in [`SPEC.md`](SPEC.md).

A default board (`public/board-default.json`) is bundled with the app and loads automatically on first launch.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes
4. Open a pull request

Please read [`AGENTS.md`](AGENTS.md) for coding conventions and contribution guidelines before submitting.

---

## Roadmap

- [ ] Buzzer system integration
- [ ] Daily Double support
- [ ] Final Jeopardy round
- [ ] Multiplayer / network sync mode
- [ ] Theming (dark / light / custom)

---

## License

MIT © [Minh Truong](https://github.com/xMinhx)
