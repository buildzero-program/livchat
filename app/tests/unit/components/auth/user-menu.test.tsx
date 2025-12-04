import { describe, it, expect, mock, beforeEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";

// Mock Clerk hooks BEFORE importing the component
const mockSignOut = mock(() => Promise.resolve());
let mockUser: {
  fullName: string | null;
  primaryEmailAddress: { emailAddress: string } | null;
  imageUrl: string;
} | null = {
  fullName: "Pedro Nascimento",
  primaryEmailAddress: { emailAddress: "pedro@buildzero.ai" },
  imageUrl: "https://example.com/avatar.jpg",
};
let mockIsLoaded = true;

mock.module("@clerk/nextjs", () => ({
  useUser: () => ({ user: mockUser, isLoaded: mockIsLoaded }),
  useClerk: () => ({ signOut: mockSignOut }),
}));

// Now import the component
import { UserMenu } from "~/components/auth/user-menu";

describe("UserMenu", () => {
  beforeEach(() => {
    cleanup();
    mockUser = {
      fullName: "Pedro Nascimento",
      primaryEmailAddress: { emailAddress: "pedro@buildzero.ai" },
      imageUrl: "https://example.com/avatar.jpg",
    };
    mockIsLoaded = true;
    mockSignOut.mockClear();
  });

  it("renders avatar button", () => {
    render(<UserMenu />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("shows user initials as fallback", () => {
    render(<UserMenu />);
    // Avatar fallback shows initials "PN" for "Pedro Nascimento"
    expect(document.body.textContent).toContain("PN");
  });

  it("renders trigger button with correct attributes", () => {
    render(<UserMenu />);
    const buttons = screen.getAllByRole("button");
    const trigger = buttons[0]!;

    // Verify it's a dropdown trigger
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("data-slot")).toBe("dropdown-menu-trigger");
  });

  it("shows loading state when not loaded", () => {
    mockIsLoaded = false;
    render(<UserMenu />);

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]!.hasAttribute("disabled")).toBe(true);
  });

  it("shows loading state when no user", () => {
    mockUser = null;
    render(<UserMenu />);

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]!.hasAttribute("disabled")).toBe(true);
  });

  it("uses correct initials for single name", () => {
    mockUser = {
      fullName: "Pedro",
      primaryEmailAddress: { emailAddress: "pedro@test.com" },
      imageUrl: "",
    };
    render(<UserMenu />);

    expect(document.body.textContent).toContain("P");
  });

  it("uses correct initials for full name", () => {
    mockUser = {
      fullName: "Maria Silva Santos",
      primaryEmailAddress: { emailAddress: "maria@test.com" },
      imageUrl: "",
    };
    render(<UserMenu />);

    // First and last name initials
    expect(document.body.textContent).toContain("MS");
  });
});
