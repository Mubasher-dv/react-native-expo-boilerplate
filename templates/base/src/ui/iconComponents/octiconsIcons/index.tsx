import { Octicons } from "@expo/vector-icons";
import { RF } from "@theme/responsive";
import React from "react";

type GlyphName = keyof typeof Octicons.glyphMap;

const OcticonsIcons = ({
  icon,
  color,
  size = 20,
}: {
  icon: string;
  color?: string;
  size?: number;
}) => {
  const name: GlyphName = (
    icon in Octicons.glyphMap ? icon : "question"
  ) as GlyphName;

  return <Octicons name={name} size={RF(size)} color={color} />;
};

export default OcticonsIcons;
