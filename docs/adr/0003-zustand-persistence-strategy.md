# ADR 3: Zustand Persistence Strategy

## Status

Accepted

## Context

Users may accidentally close the app or experience a crash during a game. We need to ensure that the current game state (teams, scores, board status) is persisted and restored automatically.

## Decision

We use the Zustand `persist` middleware to automatically sync the `boardStore` to browser `localStorage`.

1.  **Storage Engine**: `localStorage` (provided by Chromium).
2.  **Key**: `jeopardy-scoreboard-storage`.
3.  **Scope**: Both windows share the same origin, so they read from the same `localStorage` on start.

## Consequences

- Game state survives application restarts.
- No need for a database or complex file management for simple session recovery.
- The `Import/Export` feature provides an additional layer of manual persistence for archiving games.
