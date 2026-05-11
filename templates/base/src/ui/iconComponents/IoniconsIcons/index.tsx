import { RF } from "@theme/responsive";
import { Ionicons } from "@expo/vector-icons";
import React from "react";

type GlyphName = keyof typeof Ionicons.glyphMap;

const ICON_ALIASES: Record<string, GlyphName> = {
  home: "home",
  teams: "people",
  schedule: "calendar",
  messages: "chatbubbles",
  payments: "card",
};

const IoniconsIcons = ({
  icon,
  color,
  size = 20,
}: {
  icon: string;
  color?: string;
  size?: number;
}) => {
  const name: GlyphName =
    ICON_ALIASES[icon] ??
    (icon in Ionicons.glyphMap ? (icon as GlyphName) : "help-circle");

  return (
    <Ionicons name={name} size={RF(size)} color={color} />
  );
};

export default IoniconsIcons;
