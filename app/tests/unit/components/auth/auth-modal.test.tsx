import { describe, it, expect } from "bun:test";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuthModal } from "~/components/auth/auth-modal";

describe("AuthModal", () => {
  it("renders nothing when closed", () => {
    render(<AuthModal open={false} onOpenChange={() => {}} />);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders dialog when open", () => {
    render(<AuthModal open={true} onOpenChange={() => {}} />);

    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("renders logo and title", () => {
    render(<AuthModal open={true} onOpenChange={() => {}} />);

    expect(document.body.textContent).toContain("LivChat");
    expect(document.body.textContent).toContain("Entre na sua conta para continuar");
  });

  it("renders Google and GitHub buttons", () => {
    render(<AuthModal open={true} onOpenChange={() => {}} />);

    const googleButtons = screen.getAllByRole("button", { name: /google/i });
    const githubButtons = screen.getAllByRole("button", { name: /github/i });

    expect(googleButtons.length).toBeGreaterThan(0);
    expect(githubButtons.length).toBeGreaterThan(0);
  });

  it("calls onGoogleClick when Google button is clicked", () => {
    let clicked = false;
    render(
      <AuthModal
        open={true}
        onOpenChange={() => {}}
        onGoogleClick={() => { clicked = true; }}
      />
    );

    const buttons = screen.getAllByRole("button", { name: /google/i });
    fireEvent.click(buttons[0]!);
    expect(clicked).toBe(true);
  });

  it("calls onGitHubClick when GitHub button is clicked", () => {
    let clicked = false;
    render(
      <AuthModal
        open={true}
        onOpenChange={() => {}}
        onGitHubClick={() => { clicked = true; }}
      />
    );

    const buttons = screen.getAllByRole("button", { name: /github/i });
    fireEvent.click(buttons[0]!);
    expect(clicked).toBe(true);
  });

  it("renders terms text", () => {
    render(<AuthModal open={true} onOpenChange={() => {}} />);

    expect(document.body.textContent).toContain("Termos de Uso");
    expect(document.body.textContent).toContain("Política de Privacidade");
  });

  it("renders secure login badge", () => {
    render(<AuthModal open={true} onOpenChange={() => {}} />);

    expect(document.body.textContent).toContain("login seguro");
  });

  it("calls onOpenChange when closing", () => {
    let wasCalled = false;
    render(
      <AuthModal
        open={true}
        onOpenChange={(open) => { wasCalled = !open; }}
      />
    );

    const closeButtons = screen.getAllByRole("button", { name: /close/i });
    fireEvent.click(closeButtons[0]!);

    expect(wasCalled).toBe(true);
  });

  it("shows error message when error prop is provided", () => {
    render(
      <AuthModal
        open={true}
        onOpenChange={() => {}}
        error="Erro de autenticação"
      />
    );

    expect(document.body.textContent).toContain("Erro de autenticação");
  });

  it("disables buttons when loading", () => {
    render(
      <AuthModal
        open={true}
        onOpenChange={() => {}}
        loadingGoogle={true}
      />
    );

    const googleButton = screen.getAllByRole("button", { name: /google/i })[0]!;
    const githubButton = screen.getAllByRole("button", { name: /github/i })[0]!;

    expect(googleButton.hasAttribute("disabled")).toBe(true);
    expect(githubButton.hasAttribute("disabled")).toBe(true);
  });
});
