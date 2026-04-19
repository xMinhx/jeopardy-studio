## 🎬 Jeopardy Studio v0.1.0 (Pre-release)

This is the initial public pre-release of **Jeopardy Studio**, moving the project from a private tool to an open-source framework. 
This version focuses on the core engine and stability for live hosting.

### 🛠 Core Functionality
* **Electron-based Dual-Monitor Sync**: Uses IPC to maintain state between the Host Control and Audience Display windows.
* **Score Management**: Real-time team tracking and manual score overrides.
* **Local-First**: Runs entirely offline to ensure stability during events.
* **Game Logic**: Integrated support for Daily Doubles, Final Jeopardy, and wagers.
* **Integrated Assets**: Includes standard timer logic and SFX triggers.

### 📋 Current Roadmap
Our immediate focus is on stability and UI flexibility:
* **Display Scaling**: Better support for varying projector resolutions and aspect ratios.
* **Theming Engine**: Configurable CSS for branding and typography.
* **Internationalization**: Support for multiple languages.
* **Transition Refinement**: Enhancing UI performance and animation smoothing.

### 🧪 Feedback & Testing
We are looking for feedback on real-world usage, specifically:
* Host window ergonomics during a live game.
* Display scaling or "letterboxing" issues on external monitors.
* Any bugs encountered in the scoring logic.