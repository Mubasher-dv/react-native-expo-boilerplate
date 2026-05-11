import { StyleSheet } from "react-native";
import { Colors } from "./colors";
import { RF } from "./responsive";

export const AllStyles = StyleSheet.create({
  backdropAbsoluteBlur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1,
  },
  shadowBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1,
  },
  modalBorderStyle: {
    borderTopLeftRadius: RF(20),
    borderTopRightRadius: RF(20),
    backgroundColor: Colors.GRAY_1,
  },
  messageListContainer: { gap: RF(16), padding: RF(16) },
  modalBackgroundColor: {
    backgroundColor: Colors.GRAY_1,
  },
  fullWidthButton: {
    width: "100%",
  },
  shadowOffset: { width: 0, height: 2 },
});
