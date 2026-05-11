export const MEDIA_TYPES = {
  IMAGE: "image" as const,
  VIDEO: "video" as const,
};

export const IMAGE_PICKER_OPTIONS = {
  mediaTypes: ["images"] as const,
  allowsEditing: false,
  quality: 0.85,
  base64: false,
};

export const CAMERA_OPTIONS = {
  mediaTypes: ["images"] as const,
  allowsEditing: false,
  quality: 0.85,
  base64: false,
};
