import { Feather } from "@expo/vector-icons";
import React from "react";

const FeatherIcons = ({
  name,
  size,
  color,
}: {
  name: string;
  size: number;
  color: string;
}) => {
  return (
    <Feather
      name={name as keyof typeof Feather.glyphMap}
      size={size}
      color={color}
    />
  );
};

export default FeatherIcons;
