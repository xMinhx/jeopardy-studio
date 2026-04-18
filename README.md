<div align="center">

# Jeopardy Studio

**A dual-window quiz show scoreboard for hosting live events.**

One window for the host. One window for the audience. Always in sync.

[![CI](https://github.com/xMinhx/jeopardy-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/xMinhx/jeopardy-studio/actions/workflows/ci.yml)
[![Electron](https://img.shields.io/badge/Electron-31-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-gold)](LICENSE)

<br/>

<div align="center">
  <img src="docs/screenshots/display-window.png" width="800" alt="Audience Display View" />
  <br/>
  <img src="docs/screenshots/control-window.png" width="800" alt="Host Control View" />
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

<table>
  <tr>
    <td align="center" width="50%">
      <img src="docs/screenshots/display-window.png" alt="Live scoreboard" />
      <sub><b>Audience Display: Scoreboard and game board</b></sub>
    </td>
    <td align="center" width="50%">
      <img src="docs/screenshots/control-window.png" alt="Host control" />
      <sub><b>Host Control: Timer and team management</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="docs/screenshots/board-control.png" alt="Board management" />
      <sub><b>Board Management: Edit questions and values</b></sub>
    </td>
    <td align="center" width="50%">
      <img src="docs/screenshots/edit-mode.png" alt="Edit mode" />
      <sub><b>Edit Mode: Live board adjustments</b></sub>
    </td>
  </tr>
</table>

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

### Build Installer
```bash
npm run build
```
The installer will be generated in the `release/` directory.

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

```
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
  <iframe src="https://github.com/sponsors/xMinhx/button" title="Sponsor xMinhx" height="32" width="114" style="border: 0; border-radius: 6px;"></iframe>
  <br/><br/>
  <a href="https://www.buymeacoffee.com/xminhx" target="_blank">
    <img src="https://cdn.buymeacoffee.com/buttons/v2/default-orange.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" >
  </a>
</div>

---

## License
MIT (c) [Minh Truong](https://github.com/xMinhx)
