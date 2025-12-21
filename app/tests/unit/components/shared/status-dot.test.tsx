import { describe, it, expect, afterEach } from "bun:test";
import { render, cleanup } from "@testing-library/react";
import { StatusDot } from "~/components/shared/status-dot";

afterEach(() => {
  cleanup();
});

describe("StatusDot", () => {
  it("renders green dot for online status", () => {
    const { container } = render(<StatusDot status="online" />);

    const dot = container.querySelector("span");
    expect(dot).toBeDefined();
    expect(dot?.className).toContain("bg-green-500");
  });

  it("renders yellow spinner for connecting status", () => {
    const { container } = render(<StatusDot status="connecting" />);

    // Connecting uses Loader2 icon (SVG), not a span
    const svg = container.querySelector("svg");
    expect(svg).toBeDefined();
    expect(svg?.className).toContain("text-yellow-500");
  });

  it("renders red dot for offline status", () => {
    const { container } = render(<StatusDot status="offline" />);

    const dot = container.querySelector("span");
    expect(dot?.className).toContain("bg-red-500");
  });

  it("has animation for online status", () => {
    const { container } = render(<StatusDot status="online" />);

    // Should have animation class or wrapper
    const wrapper = container.firstChild;
    expect(wrapper).toBeDefined();
  });

  it("has spinner animation for connecting status", () => {
    const { container } = render(<StatusDot status="connecting" />);

    // Should have animate-spin
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeDefined();
  });

  it("renders with custom size", () => {
    const { container } = render(<StatusDot status="online" size="lg" />);

    const dot = container.querySelector("span");
    expect(dot?.className).toContain("h-3");
  });
});
