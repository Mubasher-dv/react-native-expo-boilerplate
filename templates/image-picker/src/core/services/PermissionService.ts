import log from "@appComponents/appLogger";
import * as ImagePicker from "expo-image-picker";

const hasCameraPermission = async () => {
  try {
    const { status, canAskAgain } =
      await ImagePicker.getCameraPermissionsAsync();

    if (status === "granted") {
      return true;
    }

    // 🔥 FIX: request when undetermined OR denied
    if ((status === "undetermined" || status === "denied") && canAskAgain) {
      const result = await ImagePicker.requestCameraPermissionsAsync();
      return result.status === "granted";
    }

    return false;
  } catch (error) {
    log.error("Camera permission error:", error);
    return false;
  }
};

const hasLibraryPermission = async () => {
  try {
    const { status, canAskAgain } =
      await ImagePicker.getMediaLibraryPermissionsAsync();

    if (status === "granted") {
      return true;
    }

    // 🔥 FIX: request when undetermined OR denied
    if ((status === "undetermined" || status === "denied") && canAskAgain) {
      const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return result.status === "granted";
    }

    return false;
  } catch (error) {
    log.error("Media library permission error:", error);
    return false;
  }
};

export { hasCameraPermission, hasLibraryPermission };
