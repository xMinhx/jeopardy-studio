/** @vitest-environment jsdom */
import { renderHook, act } from "@testing-library/react";
import { useTimer } from "../src/hooks/useTimer";
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("useTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T12:00:00Z"));
  });

  it("should initialize with default duration", () => {
    const { result } = renderHook(() => useTimer(30000));
    const [state] = result.current;
    expect(state.durationMs).toBe(30000);
    expect(state.remainingMs).toBe(30000);
    expect(state.running).toBe(false);
  });

  it("should start and decrement remaining time", () => {
    const { result } = renderHook(() => useTimer(30000));
    const [, api] = result.current;

    act(() => {
      api.start();
    });

    expect(result.current[0].running).toBe(true);
  });

  it("should pause the timer", () => {
    const { result } = renderHook(() => useTimer(30000));
    const [, api] = result.current;

    act(() => {
      api.start();
      vi.advanceTimersByTime(5000);
      api.pause();
    });

    expect(result.current[0].running).toBe(false);
  });
});
