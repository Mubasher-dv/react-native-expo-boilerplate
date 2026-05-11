import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Dimensions } from "react-native";

const { height } = Dimensions.get("window");

const GRADIENT_STYLE = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  height: height * 0.3,
};

const BackgroundGradient = () => {
  return (
    <LinearGradient
      colors={["#2D85B71A", "#2D85B700"]}
      style={GRADIENT_STYLE}
    />
  );
};

export default BackgroundGradient;
