import { MaterialIcons } from "@expo/vector-icons";
import { RF } from "@theme/responsive";
import React from "react";

type GlyphName = keyof typeof MaterialIcons.glyphMap;

const MaterialIconss = ({
  icon,
  color,
  size = 20,
}: {
  icon: string;
  color?: string;
  size?: number;
}) => {
  const name: GlyphName = (
    icon in MaterialIcons.glyphMap ? icon : "question"
  ) as GlyphName;

  return <MaterialIcons name={name} size={RF(size)} color={color} />;
};

export default MaterialIconss;
