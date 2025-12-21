import { describe, it, expect, afterEach } from "bun:test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DeleteConfirmDialog } from "~/components/shared/delete-confirm-dialog";

afterEach(() => {
  cleanup();
});

describe("DeleteConfirmDialog", () => {
  const defaultProps = {
    itemName: "Vendas",
    open: true,
    onOpenChange: () => {},
    onConfirm: () => {},
    isLoading: false,
  };

  it("renders dialog when open", () => {
    render(<DeleteConfirmDialog {...defaultProps} />);

    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("shows item name in confirmation message", () => {
    render(<DeleteConfirmDialog {...defaultProps} />);

    // "Vendas" appears in the strong tag for confirmation
    const strongElements = screen.getAllByText("Vendas");
    expect(strongElements.length).toBeGreaterThan(0);
  });

  it("disables confirm button when input does not match", () => {
    render(<DeleteConfirmDialog {...defaultProps} />);

    const confirmButton = screen.getByRole("button", { name: /deletar/i });
    expect(confirmButton.hasAttribute("disabled")).toBe(true);
  });

  it("enables confirm button when input matches item name", () => {
    render(<DeleteConfirmDialog {...defaultProps} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Vendas" } });

    // Get destructive button (has bg-destructive class)
    const buttons = screen.getAllByRole("button");
    const confirmButton = buttons.find((btn) =>
      btn.className.includes("bg-destructive")
    );
    expect(confirmButton).toBeDefined();
    expect(confirmButton!.hasAttribute("disabled")).toBe(false);
  });

  it("calls onConfirm when confirm button clicked", () => {
    let confirmed = false;
    render(
      <DeleteConfirmDialog
        {...defaultProps}
        onConfirm={() => {
          confirmed = true;
        }}
      />
    );

    // Type matching name - use getByRole for input
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Vendas" } });

    // Click confirm - get all buttons and find the one with bg-destructive
    const buttons = screen.getAllByRole("button");
    const confirmButton = buttons.find((btn) =>
      btn.className.includes("bg-destructive")
    );
    expect(confirmButton).toBeDefined();
    expect(confirmButton!.hasAttribute("disabled")).toBe(false);
    fireEvent.click(confirmButton!);

    expect(confirmed).toBe(true);
  });

  it("shows loading state", () => {
    const { container } = render(
      <DeleteConfirmDialog {...defaultProps} isLoading={true} />
    );

    // Should have loader icon (animate-spin)
    const loader = container.querySelector(".animate-spin");
    expect(loader).toBeDefined();

    // Cancel button should be disabled when loading
    const cancelButton = screen.getByRole("button", { name: /cancelar/i });
    expect(cancelButton.hasAttribute("disabled")).toBe(true);
  });

  it("has cancel button", () => {
    render(<DeleteConfirmDialog {...defaultProps} />);

    expect(screen.getByRole("button", { name: /cancelar/i })).toBeDefined();
  });

  it("calls onOpenChange when cancel clicked", () => {
    let closeCalled = false;
    render(
      <DeleteConfirmDialog
        {...defaultProps}
        onOpenChange={(open) => {
          if (!open) closeCalled = true;
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(closeCalled).toBe(true);
  });

  it("uses custom title when provided", () => {
    render(
      <DeleteConfirmDialog {...defaultProps} title="Excluir Webhook" />
    );

    expect(screen.getByText("Excluir Webhook")).toBeDefined();
  });

  it("uses custom description when provided", () => {
    render(
      <DeleteConfirmDialog
        {...defaultProps}
        description="Esta ação não pode ser desfeita."
      />
    );

    expect(screen.getByText("Esta ação não pode ser desfeita.")).toBeDefined();
  });
});
