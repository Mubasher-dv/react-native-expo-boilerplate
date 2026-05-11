import { Platform } from "react-native";

export const ANDROID = Platform.OS === "android";
export const IOS = Platform.OS === "ios";

export const ImageSource = {
  CAMERA: "camera" as const,
  GALLERY: "gallery" as const,
};

// @@MEDIA_CONSTANTS@@
