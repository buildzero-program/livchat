import { describe, it, expect, afterEach } from "bun:test";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { InstanceRow } from "~/components/instances/instance-row";

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

describe("InstanceRow", () => {
  const defaultProps = {
    instance: mockInstance,
    onRename: () => {},
    onDisconnect: () => {},
    onDelete: () => {},
    onClick: () => {},
  };

  it("renders instance name", () => {
    render(<InstanceRow {...defaultProps} />);

    expect(screen.getByText("Vendas")).toBeDefined();
  });

  it("renders status badge", () => {
    render(<InstanceRow {...defaultProps} />);

    // StatusBadge shows "Online" text
    expect(screen.getByText("Online")).toBeDefined();
  });

  it("renders phone number formatted", () => {
    render(<InstanceRow {...defaultProps} />);

    expect(screen.getByText(/\+55 11/)).toBeDefined();
  });

  it("renders status summary with messages", () => {
    render(<InstanceRow {...defaultProps} />);

    expect(screen.getByText(/1234 msgs/)).toBeDefined();
  });

  it("shows 'Não conectado' when no phone number", () => {
    render(
      <InstanceRow
        {...defaultProps}
        instance={{ ...mockInstance, phoneNumber: undefined }}
      />
    );

    expect(screen.getByText("Não conectado")).toBeDefined();
  });

  it("renders disconnect button when online", () => {
    render(<InstanceRow {...defaultProps} />);

    const disconnectBtn = screen.getByRole("button", { name: /desconectar/i });
    expect(disconnectBtn).toBeDefined();
  });

  it("renders delete button", () => {
    render(<InstanceRow {...defaultProps} />);

    const deleteBtn = screen.getByRole("button", { name: /excluir/i });
    expect(deleteBtn).toBeDefined();
  });

  it("calls onDisconnect when disconnect clicked", () => {
    let disconnectCalled = false;
    render(
      <InstanceRow
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
      <InstanceRow
        {...defaultProps}
        onDelete={() => {
          deleteCalled = true;
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /excluir/i }));
    expect(deleteCalled).toBe(true);
  });

  it("does not render disconnect button when offline", () => {
    render(
      <InstanceRow
        {...defaultProps}
        instance={{ ...mockInstance, status: "offline" }}
      />
    );

    const disconnectBtns = screen.queryAllByRole("button", {
      name: /desconectar/i,
    });
    expect(disconnectBtns.length).toBe(0);
  });

  it("shows 'Conectando' status when connecting", () => {
    render(
      <InstanceRow
        {...defaultProps}
        instance={{ ...mockInstance, status: "connecting" }}
      />
    );

    expect(screen.getByText("Conectando")).toBeDefined();
  });

  it("shows 'Offline' status when offline", () => {
    render(
      <InstanceRow
        {...defaultProps}
        instance={{ ...mockInstance, status: "offline" }}
      />
    );

    expect(screen.getByText("Offline")).toBeDefined();
  });
});
