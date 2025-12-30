import { describe, it, expect, afterEach } from "bun:test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { InstanceCard } from "~/components/instances/instance-card";

afterEach(() => {
  cleanup();
});

const mockInstance = {
  id: "1",
  name: "Vendas",
  phoneNumber: "5511948182061",
  whatsappName: "Equipe Vendas",
  pictureUrl: null,
  status: "online" as const,
  connectedSince: new Date().toISOString(),
  messagesUsed: 1234,
};

describe("InstanceCard", () => {
  const defaultProps = {
    instance: mockInstance,
    onRename: () => {},
    onDisconnect: () => {},
    onDelete: () => {},
    onClick: () => {},
  };

  it("renders instance name", () => {
    render(<InstanceCard {...defaultProps} />);

    expect(screen.getByText("Vendas")).toBeDefined();
  });

  it("renders status badge", () => {
    render(<InstanceCard {...defaultProps} />);

    // StatusBadge shows "Online" text
    expect(screen.getByText("Online")).toBeDefined();
  });

  it("renders phone number formatted", () => {
    render(<InstanceCard {...defaultProps} />);

    expect(screen.getByText(/\+55 11/)).toBeDefined();
  });

  it("renders status summary with messages", () => {
    render(<InstanceCard {...defaultProps} />);

    expect(screen.getByText(/1234 msgs/)).toBeDefined();
  });

  it("renders disconnect button when online", () => {
    render(<InstanceCard {...defaultProps} />);

    const disconnectBtn = screen.getByRole("button", { name: /desconectar/i });
    expect(disconnectBtn).toBeDefined();
  });

  it("does not render disconnect button when offline", () => {
    render(
      <InstanceCard
        {...defaultProps}
        instance={{ ...mockInstance, status: "offline" }}
      />
    );

    const disconnectBtns = screen.queryAllByRole("button", {
      name: /desconectar/i,
    });
    expect(disconnectBtns.length).toBe(0);
  });

  it("renders delete button", () => {
    render(<InstanceCard {...defaultProps} />);

    const deleteBtn = screen.getByRole("button", { name: /excluir/i });
    expect(deleteBtn).toBeDefined();
  });

  it("calls onDisconnect when disconnect clicked", () => {
    let disconnectCalled = false;
    render(
      <InstanceCard
        {...defaultProps}
        onDisconnect={() => {
          disconnectCalled = true;
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /desconectar/i }));
    expect(disconnectCalled).toBe(true);
  });

  it("calls onDelete when delete clicked", () => {
    let deleteCalled = false;
    render(
      <InstanceCard
        {...defaultProps}
        onDelete={() => {
          deleteCalled = true;
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /excluir/i }));
    expect(deleteCalled).toBe(true);
  });

  it("shows 'Não conectado' when no phone number", () => {
    render(
      <InstanceCard
        {...defaultProps}
        instance={{ ...mockInstance, phoneNumber: undefined }}
      />
    );

    // Text is concatenated with status: "Não conectado · Online · X msgs"
    expect(screen.getByText(/Não conectado/)).toBeDefined();
  });

  it("shows 'Conectando' status when connecting", () => {
    render(
      <InstanceCard
        {...defaultProps}
        instance={{ ...mockInstance, status: "connecting" }}
      />
    );

    expect(screen.getByText("Conectando")).toBeDefined();
  });

  it("shows 'Offline' status when offline", () => {
    render(
      <InstanceCard
        {...defaultProps}
        instance={{ ...mockInstance, status: "offline" }}
      />
    );

    expect(screen.getByText("Offline")).toBeDefined();
  });
});
