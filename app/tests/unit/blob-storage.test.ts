import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from "bun:test";
import * as vercelBlob from "@vercel/blob";

// We'll import these after they exist - for now tests will fail (RED)
import { uploadProfilePicture, deleteProfilePicture } from "~/server/lib/blob-storage";

describe("blob-storage", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("uploadProfilePicture", () => {
    it("should fetch image and upload to Vercel Blob", async () => {
      // Mock fetch to return image blob
      const mockImageBlob = new Blob(["fake-image-data"], { type: "image/jpeg" });
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(mockImageBlob),
        } as Response)
      ) as unknown as typeof fetch;

      // Mock vercel/blob put
      const mockPut = spyOn(vercelBlob, "put").mockResolvedValue({
        url: "https://blob.vercel-storage.com/avatars/instance-123.jpg",
        pathname: "avatars/instance-123.jpg",
        contentType: "image/jpeg",
        contentDisposition: "inline",
        downloadUrl: "https://blob.vercel-storage.com/avatars/instance-123.jpg?download=1",
      });

      const result = await uploadProfilePicture(
        "https://pps.whatsapp.net/v/t61.24694-24/abc123.jpg",
        "instance-123"
      );

      expect(result).toBe("https://blob.vercel-storage.com/avatars/instance-123.jpg");
      expect(mockPut).toHaveBeenCalledWith(
        "avatars/instance-123.jpg",
        mockImageBlob,
        { access: "public" }
      );

      mockPut.mockRestore();
    });

    it("should throw error when image fetch fails", async () => {
      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 404,
        } as Response)
      ) as unknown as typeof fetch;

      expect(
        uploadProfilePicture("https://invalid-url.com/image.jpg", "instance-123")
      ).rejects.toThrow("Failed to fetch image: 404");
    });

    it("should use instanceId for unique file naming", async () => {
      const mockImageBlob = new Blob(["fake-image-data"], { type: "image/jpeg" });
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(mockImageBlob),
        } as Response)
      ) as unknown as typeof fetch;

      const mockPut = spyOn(vercelBlob, "put").mockResolvedValue({
        url: "https://blob.vercel-storage.com/avatars/my-unique-id.jpg",
        pathname: "avatars/my-unique-id.jpg",
        contentType: "image/jpeg",
        contentDisposition: "inline",
        downloadUrl: "https://blob.vercel-storage.com/avatars/my-unique-id.jpg?download=1",
      });

      await uploadProfilePicture("https://example.com/avatar.jpg", "my-unique-id");

      expect(mockPut).toHaveBeenCalledWith(
        "avatars/my-unique-id.jpg",
        expect.any(Blob),
        { access: "public" }
      );

      mockPut.mockRestore();
    });
  });

  describe("deleteProfilePicture", () => {
    it("should call del with correct path", async () => {
      const mockDel = spyOn(vercelBlob, "del").mockResolvedValue(undefined);

      await deleteProfilePicture("instance-123");

      expect(mockDel).toHaveBeenCalledWith("avatars/instance-123.jpg");

      mockDel.mockRestore();
    });

    it("should not throw when file does not exist", async () => {
      const mockDel = spyOn(vercelBlob, "del").mockRejectedValue(
        new Error("File not found")
      );

      // Should not throw
      await expect(deleteProfilePicture("non-existent")).resolves.toBeUndefined();

      mockDel.mockRestore();
    });
  });
});
