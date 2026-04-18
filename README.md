<div align="center">

# Jeopardy Studio

**A dual-window quiz show scoreboard for hosting live events.**

One window for the host. One window for the audience. Always in sync.

[![Latest Release](https://img.shields.io/github/v/release/xMinhx/jeopardy-studio?color=gold&label=latest%20version)](https://github.com/xMinhx/jeopardy-studio/releases)
[![CI](https://github.com/xMinhx/jeopardy-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/xMinhx/jeopardy-studio/actions/workflows/ci.yml)
[![Electron](https://img.shields.io/badge/Electron-31-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-gold)](LICENSE)

</div>

<br/>

<div align="center">
  <img src="docs/screenshots/display-window.png" width="100%" alt="Audience Display View" />
  <br/><br/>
  <img src="docs/screenshots/control-window.png" width="100%" alt="Host Control View" />
</div>

---

## ⚖️ Legal Disclaimer

This project is not affiliated with, endorsed by, or sponsored by the "Jeopardy!" game show or Sony Pictures Television. This tool is for private, educational, and non-commercial use only.

---

## What is Jeopardy Studio?

Jeopardy Studio is a desktop application for hosting quiz nights. It opens two windows:
- **Host Control**: For the host to manage teams, scores, and the game board.
- **Audience Display**: For the crowd/projector to see the live game.

The windows communicate via Electron IPC, so no internet connection is required during the game.

---

## Screenshots

<div align="center">

| Audience Display | Host Control |
| :---: | :---: |
| <img src="docs/screenshots/display-window.png" alt="Live scoreboard" /> | <img src="docs/screenshots/control-window.png" alt="Host control" /> |
| **Board Management** | **Edit Mode** |
| <img src="docs/screenshots/board-control.png" alt="Board management" /> | <img src="docs/screenshots/edit-mode.png" alt="Edit mode" /> |

</div>

---

## Features

- **Team Management**: Add/remove teams and edit scores with keyboard or mouse.
- **Game Board**: Customizable 5x5 grid (expandable) with category and point value editing.
- **Timer**: Built-in countdown with presets and audio cues.
- **Rounds**: Supports Daily Double (with wagers) and Final Jeopardy.
- **Offline First**: Runs entirely locally via Electron.
- **Import/Export**: Save and load game configurations as JSON files.

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v22+
- Windows 10/11 (for packaging; dev mode works on Linux/macOS)

### Install and Run
```bash
git clone https://github.com/xMinhx/jeopardy-studio.git
cd jeopardy-studio
npm install
npm run dev
```

---

## Keyboard Shortcuts (Host Window)

| Key | Action |
|---|---|
| `Space` | Start/Pause timer |
| `R` | Reset timer |
| `1`-`6` | Timer presets (10s - 60s) |
| `F11` | Toggle Fullscreen |

---

## Project Structure

```text
jeopardy-studio/
├── electron/
│   ├── main/         # Window lifecycle and IPC handlers
│   └── preload/      # Secure API bridge
├── src/
│   ├── windows/      # Host (Control.tsx) and Audience (Display.tsx) windows
│   ├── features/     # Component-based features (board, teams, etc.)
│   ├── store/        # Zustand state management
│   ├── hooks/        # Shared logic (timer, audio, animations)
│   ├── services/     # External data loaders
│   ├── types/        # TypeScript definitions
│   ├── utils/        # Persistence and logic helpers
│   └── styles.css    # Global styling
├── public/
│   └── assets/       # Sound effects and icons
├── tests/            # Vitest suite
└── docs/             # Documentation and screenshots
```

---

## Architecture

- **State Sync**: Uses a one-way IPC bridge. The Host Control owns the state; the Display window is a reactive mirror.
- **Persistence**: Game state is saved to local storage so sessions survive crashes.
- **Validation**: Zod is used to validate JSON board imports.

---

## Support the Project

If you find this project useful, consider supporting its development:

<div align="center">

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-xMinhx-EA4AAA?style=for-the-badge&logo=github-sponsors)](https://github.com/sponsors/xMinhx)
<br/><br/>
<a href="https://www.buymeacoffee.com/xminhx" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-orange.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" >
</a>

</div>

---

## 🗺️ Roadmap

- [ ] **Custom Themes**: Allow users to change colors and fonts for the audience display.
- [ ] **Soundboard**: A dedicated UI for the host to trigger custom sound effects.
- [ ] **Remote Control**: A web-based remote for the host to control the game from a tablet/phone.
- [ ] **Internationalization**: Support for multiple languages.
- [ ] **Advanced Animations**: Smoother transitions for category reveals and point values.

---

## 🛠️ Built With

- **Electron** — Desktop framework
- **React** — UI library
- **Zustand** — State management
- **TypeScript** — Type safety
- **Tailwind CSS** — Styling
- **Vitest** — Unit and component testing
- **Zod** — Schema validation

---

## License
MIT (c) [Minh Truong](https://github.com/xMinhx)
