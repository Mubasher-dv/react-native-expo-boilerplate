import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";

interface IconMaterialCommunityProps {
  name: string;
  size: number;
  color: string;
}

const IconMaterialCommunity = ({
  name,
  size,
  color,
}: IconMaterialCommunityProps) => {
  return (
    <MaterialCommunityIcons
      name={name as keyof typeof MaterialCommunityIcons.glyphMap}
      size={size}
      color={color}
    />
  );
};

export default IconMaterialCommunity;
