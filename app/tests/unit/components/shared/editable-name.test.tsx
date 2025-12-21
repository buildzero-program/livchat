import { describe, it, expect, afterEach } from "bun:test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { EditableName } from "~/components/shared/editable-name";

afterEach(() => {
  cleanup();
});

describe("EditableName", () => {
  it("renders the name in view mode by default", () => {
    render(<EditableName name="Vendas" onSave={() => {}} />);

    expect(screen.getByText("Vendas")).toBeDefined();
  });

  it("switches to edit mode on click", () => {
    render(<EditableName name="Vendas" onSave={() => {}} />);

    fireEvent.click(screen.getByText("Vendas"));

    // Should now have an input
    const input = screen.getByRole("textbox");
    expect(input).toBeDefined();
    expect((input as HTMLInputElement).value).toBe("Vendas");
  });

  it("saves on Enter key", () => {
    let savedName = "";
    render(
      <EditableName
        name="Vendas"
        onSave={(name) => {
          savedName = name;
        }}
      />
    );

    // Click to edit
    fireEvent.click(screen.getByText("Vendas"));

    // Change value
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Suporte" } });

    // Press Enter
    fireEvent.keyDown(input, { key: "Enter" });

    expect(savedName).toBe("Suporte");
  });

  it("cancels on Escape key", () => {
    let savedName = "";
    render(
      <EditableName
        name="Vendas"
        onSave={(name) => {
          savedName = name;
        }}
      />
    );

    // Click to edit
    fireEvent.click(screen.getByText("Vendas"));

    // Change value
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Suporte" } });

    // Press Escape
    fireEvent.keyDown(input, { key: "Escape" });

    // Should NOT have saved
    expect(savedName).toBe("");

    // Should show original name
    expect(screen.getByText("Vendas")).toBeDefined();
  });

  it("saves on blur", () => {
    let savedName = "";
    render(
      <EditableName
        name="Vendas"
        onSave={(name) => {
          savedName = name;
        }}
      />
    );

    // Click to edit
    fireEvent.click(screen.getByText("Vendas"));

    // Change value
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Marketing" } });

    // Blur
    fireEvent.blur(input);

    expect(savedName).toBe("Marketing");
  });

  it("does not save if name unchanged", () => {
    let saveCount = 0;
    render(
      <EditableName
        name="Vendas"
        onSave={() => {
          saveCount++;
        }}
      />
    );

    // Click to edit
    fireEvent.click(screen.getByText("Vendas"));

    // Press Enter without changing
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Enter" });

    expect(saveCount).toBe(0);
  });

  it("does not save empty name", () => {
    let saveCount = 0;
    render(
      <EditableName
        name="Vendas"
        onSave={() => {
          saveCount++;
        }}
      />
    );

    // Click to edit
    fireEvent.click(screen.getByText("Vendas"));

    // Clear value
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "" } });

    // Press Enter
    fireEvent.keyDown(input, { key: "Enter" });

    expect(saveCount).toBe(0);
  });

  it("trims whitespace from name", () => {
    let savedName = "";
    render(
      <EditableName
        name="Vendas"
        onSave={(name) => {
          savedName = name;
        }}
      />
    );

    // Click to edit
    fireEvent.click(screen.getByText("Vendas"));

    // Add whitespace
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "  Suporte  " } });

    // Press Enter
    fireEvent.keyDown(input, { key: "Enter" });

    expect(savedName).toBe("Suporte");
  });
});
