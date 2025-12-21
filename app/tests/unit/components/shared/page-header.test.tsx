import { describe, it, expect, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import { PageHeader } from "~/components/shared/page-header";

afterEach(() => {
  cleanup();
});

describe("PageHeader", () => {
  it("renders title", () => {
    render(<PageHeader title="Instâncias" />);

    expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
    expect(screen.getByText("Instâncias")).toBeDefined();
  });

  it("renders description when provided", () => {
    render(
      <PageHeader
        title="Instâncias"
        description="Gerencie suas conexões WhatsApp"
      />
    );

    expect(screen.getByText("Gerencie suas conexões WhatsApp")).toBeDefined();
  });

  it("does not render description when not provided", () => {
    const { container } = render(<PageHeader title="Instâncias" />);

    const paragraph = container.querySelector("p");
    expect(paragraph).toBeNull();
  });

  it("renders actions when provided", () => {
    render(
      <PageHeader title="Instâncias" actions={<button>Nova Instância</button>} />
    );

    expect(screen.getByRole("button", { name: "Nova Instância" })).toBeDefined();
  });

  it("has correct semantic structure", () => {
    render(
      <PageHeader
        title="Webhooks"
        description="Configure endpoints"
        actions={<button>Criar</button>}
      />
    );

    // Title should be h1
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("Webhooks");
  });
});
