import { describe, it, expect, afterEach } from "bun:test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ViewToggle } from "~/components/shared/view-toggle";

afterEach(() => {
  cleanup();
});

describe("ViewToggle", () => {
  it("renders both view options", () => {
    render(<ViewToggle view="list" onViewChange={() => {}} />);

    // Should have two buttons for list and cards
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(2);
  });

  it("highlights list view when active", () => {
    const { container } = render(
      <ViewToggle view="list" onViewChange={() => {}} />
    );

    // First button (list) should have active styling
    const buttons = container.querySelectorAll("button");
    expect(buttons[0]?.className).toContain("bg-");
  });

  it("highlights cards view when active", () => {
    const { container } = render(
      <ViewToggle view="cards" onViewChange={() => {}} />
    );

    // Second button (cards) should have active styling
    const buttons = container.querySelectorAll("button");
    expect(buttons[1]?.className).toContain("bg-");
  });

  it("calls onViewChange with 'cards' when cards button clicked", () => {
    let newView = "";
    render(
      <ViewToggle
        view="list"
        onViewChange={(view) => {
          newView = view;
        }}
      />
    );

    // Click cards button (second button)
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]!);

    expect(newView).toBe("cards");
  });

  it("calls onViewChange with 'list' when list button clicked", () => {
    let newView = "";
    render(
      <ViewToggle
        view="cards"
        onViewChange={(view) => {
          newView = view;
        }}
      />
    );

    // Click list button (first button)
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]!);

    expect(newView).toBe("list");
  });

  it("does not call onViewChange when clicking already active view", () => {
    let callCount = 0;
    render(
      <ViewToggle
        view="list"
        onViewChange={() => {
          callCount++;
        }}
      />
    );

    // Click list button when already on list
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]!);

    expect(callCount).toBe(0);
  });
});
