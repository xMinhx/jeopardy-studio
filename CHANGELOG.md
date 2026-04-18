# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Executive Studio** dark-theme design system with gold accent, Newsreader serif headings, and deep navy canvas.
- **Daily Double** workflow: wager selection screen, per-team wager confirmation, and question reveal.
- **Final Jeopardy** full round: category reveal, per-team wager collection, question reveal, and multi-team scored resolution.
- **Winner screen**: animated top-5 podium with gold glow and victory sound effect.
- **Fullscreen toggle**: F11 keyboard shortcut and dedicated buttons on both windows.
- **Animated score numbers**: smooth count-up/count-down transitions on score changes.
- Import / export board configurations as JSON files via native file dialogs.
- GitHub Actions CI pipeline with typecheck, lint, test, renderer build, and Windows installer packaging steps.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, and issue/PR templates.
- Architecture Decision Records in `docs/adr/`.

### Fixed
- Broken `winner_reveal_sfx.mp3` audio path (file was named `winner_reveal.mp3`).
- `$` sign overlapping number input in Daily Double and Final Jeopardy wager fields.
- Left-side card border clipping caused by `overflow-hidden` on scroll container.
- "Object has been destroyed" Electron IPC crashes when windows were closed mid-session.
- Team name input not accepting typed characters due to event propagation conflict with drag-and-drop.
- Native window title bar controls now use dark theme colors matching the app palette.

## [0.1.0] - 2026-04-17

### Added
- Initial release of Jeopardy Scoreboard.
- Dual-window architecture for Control and Display.
- Live scoreboard with team management and timer.
- Dynamic 5x5 board with category and cell management.
