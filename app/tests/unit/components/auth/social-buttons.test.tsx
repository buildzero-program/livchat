import { describe, it, expect } from "bun:test";
import { render, screen, fireEvent } from "@testing-library/react";
import { SocialButtons } from "~/components/auth/social-buttons";

describe("SocialButtons", () => {
  it("renders Google button", () => {
    render(<SocialButtons onGoogleClick={() => {}} onGitHubClick={() => {}} />);

    expect(screen.getByRole("button", { name: /google/i })).toBeDefined();
  });

  it("renders GitHub button", () => {
    render(<SocialButtons onGoogleClick={() => {}} onGitHubClick={() => {}} />);

    expect(screen.getByRole("button", { name: /github/i })).toBeDefined();
  });

  it("renders separator text", () => {
    render(<SocialButtons onGoogleClick={() => {}} onGitHubClick={() => {}} />);

    expect(screen.getByText(/ou continue com/i)).toBeDefined();
  });

  it("calls onGoogleClick when Google button is clicked", () => {
    let clicked = false;
    render(
      <SocialButtons
        onGoogleClick={() => { clicked = true; }}
        onGitHubClick={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /google/i }));
    expect(clicked).toBe(true);
  });

  it("calls onGitHubClick when GitHub button is clicked", () => {
    let clicked = false;
    render(
      <SocialButtons
        onGoogleClick={() => {}}
        onGitHubClick={() => { clicked = true; }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /github/i }));
    expect(clicked).toBe(true);
  });

  it("shows loading state on Google button", () => {
    render(
      <SocialButtons
        onGoogleClick={() => {}}
        onGitHubClick={() => {}}
        loadingGoogle={true}
      />
    );

    const googleBtn = screen.getByRole("button", { name: /google/i });
    expect(googleBtn.hasAttribute("disabled")).toBe(true);
  });

  it("shows loading state on GitHub button", () => {
    render(
      <SocialButtons
        onGoogleClick={() => {}}
        onGitHubClick={() => {}}
        loadingGitHub={true}
      />
    );

    const githubBtn = screen.getByRole("button", { name: /github/i });
    expect(githubBtn.hasAttribute("disabled")).toBe(true);
  });

  it("disables both buttons when one is loading", () => {
    render(
      <SocialButtons
        onGoogleClick={() => {}}
        onGitHubClick={() => {}}
        loadingGoogle={true}
      />
    );

    const googleBtn = screen.getByRole("button", { name: /google/i });
    const githubBtn = screen.getByRole("button", { name: /github/i });

    expect(googleBtn.hasAttribute("disabled")).toBe(true);
    expect(githubBtn.hasAttribute("disabled")).toBe(true);
  });
});
