import { FontAwesome6 } from "@expo/vector-icons";
import React from "react";

const IconFontAwesome6 = ({
  name,
  size,
  color,
}: {
  name: string;
  size: number;
  color: string;
}) => {
  return (
    <FontAwesome6
      name={name as keyof typeof FontAwesome6.glyphMap}
      size={size}
      color={color}
    />
  );
};

export default IconFontAwesome6;
