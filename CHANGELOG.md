# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- GitHub Actions CI workflow for lint, test, and build validation.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, and issue/PR templates.
- Modern ESLint 9 configuration with React and TypeScript support.

### Fixed
- ESLint configuration errors and linting issues in components and hooks.
- Resource leak and synchronization bugs in `useTimer` and `useTimerAudio`.

## [0.1.0] - 2026-04-17

### Added
- Initial release of Jeopardy Scoreboard.
- Dual-window architecture for Control and Display.
- Live scoreboard with team management and timer.
- Dynamic 5x5 board with category and cell management.
