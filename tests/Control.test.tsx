/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import Control from "../src/windows/Control";
import { describe, it, expect } from "vitest";

describe("Control Window", () => {
  it("should render headers and sections", () => {
    render(<Control />);
    // h1 in the header
    expect(screen.getByRole("heading", { name: /Host Control/i })).toBeInTheDocument();
    // Section headings
    expect(screen.getByRole("heading", { name: /Timer/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Teams/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Board/i })).toBeInTheDocument();
  });

  it("should show header and start button", () => {
    render(<Control />);
    expect(screen.getByText(/Jeopardy Studio/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start/i })).toBeInTheDocument();
  });
});
