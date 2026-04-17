# ADR 2: Dual-Window IPC Synchronization

## Status

Accepted

## Context

The application requires two windows: a "Control" window for the host and a "Display" window for the audience. Both windows must stay perfectly in sync regarding the board state and the countdown timer.

## Decision

We use Electron's Inter-Process Communication (IPC) to synchronize state:

1.  **Source of Truth**: The `Control` window maintains the master state in its Zustand store.
2.  **Broadcast**: Any update to the `Control` store is sent to the Main process via `ipcRenderer.send('state:update')`.
3.  **Relay**: The Main process relays this state to all open windows (including the `Display` window) using `webContents.send('state:changed')`.
4.  **Timer Tick**: High-frequency timer updates are sent directly from the `Control` window's RAF loop to the `Display` window via a dedicated `timer:tick` IPC channel to minimize latency.

## Consequences

- State is eventually consistent across windows.
- The `Display` window can be reloaded without losing state (as it fetches the latest snapshot from Main on mount).
- Minimal overhead by only broadcasting changes.
