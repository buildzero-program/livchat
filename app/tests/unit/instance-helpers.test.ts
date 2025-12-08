import { describe, it, expect } from "bun:test";
import { deriveInstanceStatus } from "~/server/lib/instance-helpers";

describe("deriveInstanceStatus", () => {
  it("should return 'online' when connected and loggedIn", () => {
    expect(deriveInstanceStatus(true, true)).toBe("online");
  });

  it("should return 'connecting' when connected but not loggedIn", () => {
    expect(deriveInstanceStatus(true, false)).toBe("connecting");
  });

  it("should return 'offline' when not connected", () => {
    expect(deriveInstanceStatus(false, false)).toBe("offline");
    expect(deriveInstanceStatus(false, true)).toBe("offline");
  });
});
