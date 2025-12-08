/**
 * Blob Storage Helper
 * Handles profile picture uploads to Vercel Blob
 */

import { put, del } from "@vercel/blob";

/**
 * Upload profile picture to Vercel Blob
 * @param imageUrl - Source URL of the image (from WhatsApp)
 * @param instanceId - Instance UUID for unique naming
 * @returns Blob URL of the uploaded image
 */
export async function uploadProfilePicture(
  imageUrl: string,
  instanceId: string
): Promise<string> {
  // Fetch image from WhatsApp
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const blob = await response.blob();

  // Upload to Vercel Blob with unique path
  const { url } = await put(`avatars/${instanceId}.jpg`, blob, {
    access: "public",
  });

  return url;
}

/**
 * Delete profile picture from Vercel Blob
 */
export async function deleteProfilePicture(instanceId: string): Promise<void> {
  try {
    await del(`avatars/${instanceId}.jpg`);
  } catch {
    // Ignore if file doesn't exist
  }
}
