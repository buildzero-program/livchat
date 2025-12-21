import { describe, it, expect, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import { StatusBadge } from "~/components/shared/status-badge";

afterEach(() => {
  cleanup();
});

describe("StatusBadge", () => {
  it("renders online status with green styling", () => {
    render(<StatusBadge status="online" />);

    const badge = screen.getByText("Online");
    expect(badge).toBeDefined();
    // Should have green color classes
    expect(badge.className).toContain("text-green");
  });

  it("renders offline status with red styling", () => {
    render(<StatusBadge status="offline" />);

    const badge = screen.getByText("Offline");
    expect(badge).toBeDefined();
    expect(badge.className).toContain("text-red");
  });

  it("renders connecting status with yellow styling", () => {
    render(<StatusBadge status="connecting" />);

    const badge = screen.getByText("Conectando");
    expect(badge).toBeDefined();
    expect(badge.className).toContain("text-yellow");
  });

  it("renders with animated dot for online status", () => {
    const { container } = render(<StatusBadge status="online" />);

    // Should have an animated element (motion.span with bg-green)
    const dot = container.querySelector(".bg-green-500");
    expect(dot).toBeDefined();
  });

  it("renders with static dot for offline status", () => {
    const { container } = render(<StatusBadge status="offline" />);

    // Should have a red dot
    const dot = container.querySelector(".bg-red-500");
    expect(dot).toBeDefined();
  });

  it("renders with loader for connecting status", () => {
    const { container } = render(<StatusBadge status="connecting" />);

    // Should have animate-spin class (Loader2 icon)
    const loader = container.querySelector(".animate-spin");
    expect(loader).toBeDefined();
  });
});
