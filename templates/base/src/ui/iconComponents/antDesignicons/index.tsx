import { AntDesign } from "@expo/vector-icons";
import React from "react";

const AndDesignIcons = ({
  name,
  size,
  color,
}: {
  name: string;
  size: number;
  color: string;
}) => {
  return (
    <AntDesign
      name={name as keyof typeof AntDesign.glyphMap}
      size={size}
      color={color}
    />
  );
};

export default AndDesignIcons;
