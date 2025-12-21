import { describe, it, expect, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import { Smartphone } from "lucide-react";
import { ListSectionHeader } from "~/components/shared/list-section-header";

afterEach(() => {
  cleanup();
});

describe("ListSectionHeader", () => {
  it("renders title", () => {
    render(<ListSectionHeader title="Instâncias" icon={Smartphone} count={3} />);

    expect(screen.getByText("Instâncias")).toBeDefined();
  });

  it("renders count in parentheses", () => {
    render(<ListSectionHeader title="Instâncias" icon={Smartphone} count={5} />);

    expect(screen.getByText("(5)")).toBeDefined();
  });

  it("renders icon", () => {
    const { container } = render(
      <ListSectionHeader title="Webhooks" icon={Smartphone} count={2} />
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeDefined();
  });

  it("renders actions when provided", () => {
    render(
      <ListSectionHeader
        title="Instâncias"
        icon={Smartphone}
        count={3}
        actions={<button>Adicionar</button>}
      />
    );

    expect(screen.getByRole("button", { name: "Adicionar" })).toBeDefined();
  });

  it("does not render actions when count is 0 and hideActionsWhenEmpty", () => {
    render(
      <ListSectionHeader
        title="Instâncias"
        icon={Smartphone}
        count={0}
        hideActionsWhenEmpty
        actions={<button>Adicionar</button>}
      />
    );

    const buttons = screen.queryAllByRole("button");
    expect(buttons.length).toBe(0);
  });

  it("renders actions even when count is 0 if hideActionsWhenEmpty is false", () => {
    render(
      <ListSectionHeader
        title="Instâncias"
        icon={Smartphone}
        count={0}
        actions={<button>Adicionar</button>}
      />
    );

    expect(screen.getByRole("button", { name: "Adicionar" })).toBeDefined();
  });
});
