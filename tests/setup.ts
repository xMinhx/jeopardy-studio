import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock Electron window.api
Object.defineProperty(window, "api", {
  value: {
    sendTimerTick: vi.fn(),
    updateState: vi.fn(),
    showTimer: vi.fn(),
    showScoreboard: vi.fn(),
    onUpdateState: vi.fn(() => () => {}),
    onTimerTick: vi.fn(() => () => {}),
  },
  writable: true,
});

// Mock Web Audio API
class AudioContextMock {
  state = "suspended";
  createGain = () => ({
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  });
  createBufferSource = () => ({
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  });
  decodeAudioData = vi.fn().mockResolvedValue({});
  resume = vi.fn().mockResolvedValue(undefined);
  destination = {};
  currentTime = 0;
}

vi.stubGlobal("AudioContext", AudioContextMock);

// Mock performance.now
vi.stubGlobal("performance", {
  now: vi.fn(() => Date.now()),
});

// Mock fetch
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
  arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  ok: true,
}));
