import { RF } from "@theme/responsive";
import React from "react";
import {
  DimensionValue,
  StyleProp,
  View,
  ViewProps,
  ViewStyle,
} from "react-native";

type RowProps = ViewProps & {
  children?: React.ReactNode;

  padding?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingStart?: number;
  paddingEnd?: number;

  margin?: number;
  marginHorizontal?: number;
  marginVertical?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  marginStart?: number;
  marginEnd?: number;

  flex?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | DimensionValue;
  flexWrap?: ViewStyle["flexWrap"];
  alignItems?: ViewStyle["alignItems"];
  justifyContent?: ViewStyle["justifyContent"];
  alignSelf?: ViewStyle["alignSelf"];
  alignContent?: ViewStyle["alignContent"];

  columnGap?: number;
  gap?: number;

  width?: number | DimensionValue;
  height?: number | DimensionValue;
  minWidth?: number | DimensionValue;
  maxWidth?: number | DimensionValue;
  minHeight?: number | DimensionValue;
  maxHeight?: number | DimensionValue;
  aspectRatio?: number;

  position?: ViewStyle["position"];
  top?: number | DimensionValue;
  bottom?: number | DimensionValue;
  left?: number | DimensionValue;
  right?: number | DimensionValue;
  start?: number | DimensionValue;
  end?: number | DimensionValue;
  zIndex?: number;

  backgroundColor?: string;
  opacity?: number;
  overflow?: ViewStyle["overflow"];
  display?: ViewStyle["display"];
  direction?: ViewStyle["direction"];

  borderRadius?: number;
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  borderBottomLeftRadius?: number;
  borderBottomRightRadius?: number;
  borderStartRadius?: number;
  borderEndRadius?: number;

  borderWidth?: number;
  borderTopWidth?: number;
  borderBottomWidth?: number;
  borderLeftWidth?: number;
  borderRightWidth?: number;
  borderStartWidth?: number;
  borderEndWidth?: number;

  borderColor?: string;
  borderTopColor?: string;
  borderBottomColor?: string;
  borderLeftColor?: string;
  borderRightColor?: string;
  borderStartColor?: string;
  borderEndColor?: string;
  borderStyle?: ViewStyle["borderStyle"];

  shadowColor?: string;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number;
  shadowRadius?: number;
  elevation?: number;

  transform?: ViewStyle["transform"];
  backfaceVisibility?: ViewStyle["backfaceVisibility"];
};

const AppRowView: React.FC<RowProps> = ({
  children,
  style,
  padding,
  paddingHorizontal,
  paddingVertical,
  paddingTop,
  paddingBottom,
  paddingLeft,
  paddingRight,
  paddingStart,
  paddingEnd,
  margin,
  marginHorizontal,
  marginVertical,
  marginTop,
  marginBottom,
  marginLeft,
  marginRight,
  marginStart,
  marginEnd,
  flex,
  flexGrow,
  flexShrink,
  flexBasis,
  flexWrap,
  alignItems,
  justifyContent,
  alignSelf,
  alignContent,
  columnGap,
  gap,

  width,
  height,
  minWidth,
  maxWidth,
  minHeight,
  maxHeight,
  aspectRatio,
  position,
  top,
  bottom,
  left,
  right,
  start,
  end,
  zIndex,
  backgroundColor,
  opacity,
  overflow,
  display,
  direction,
  borderRadius,
  borderTopLeftRadius,
  borderTopRightRadius,
  borderBottomLeftRadius,
  borderBottomRightRadius,
  borderStartRadius,
  borderEndRadius,
  borderWidth,
  borderTopWidth,
  borderBottomWidth,
  borderLeftWidth,
  borderRightWidth,
  borderStartWidth,
  borderEndWidth,
  borderColor,
  borderTopColor,
  borderBottomColor,
  borderLeftColor,
  borderRightColor,
  borderStartColor,
  borderEndColor,
  borderStyle,
  shadowColor,
  shadowOffset,
  shadowOpacity,
  shadowRadius,
  elevation,
  transform,
  backfaceVisibility,
  ...rest
}) => {
  const toDim = (v?: number | DimensionValue) =>
    v === undefined
      ? undefined
      : typeof v === "number"
        ? (RF(v) as unknown as DimensionValue)
        : v;

  const customStyle: ViewStyle = {
    flexDirection: "row",

    padding: padding !== undefined ? RF(padding) : undefined,
    paddingHorizontal:
      paddingHorizontal !== undefined ? RF(paddingHorizontal) : undefined,
    paddingVertical:
      paddingVertical !== undefined ? RF(paddingVertical) : undefined,
    paddingTop: paddingTop !== undefined ? RF(paddingTop) : undefined,
    paddingBottom: paddingBottom !== undefined ? RF(paddingBottom) : undefined,
    paddingLeft: paddingLeft !== undefined ? RF(paddingLeft) : undefined,
    paddingRight: paddingRight !== undefined ? RF(paddingRight) : undefined,
    paddingStart: paddingStart !== undefined ? RF(paddingStart) : undefined,
    paddingEnd: paddingEnd !== undefined ? RF(paddingEnd) : undefined,

    margin: margin !== undefined ? RF(margin) : undefined,
    marginHorizontal:
      marginHorizontal !== undefined ? RF(marginHorizontal) : undefined,
    marginVertical:
      marginVertical !== undefined ? RF(marginVertical) : undefined,
    marginTop: marginTop !== undefined ? RF(marginTop) : undefined,
    marginBottom: marginBottom !== undefined ? RF(marginBottom) : undefined,
    marginLeft: marginLeft !== undefined ? RF(marginLeft) : undefined,
    marginRight: marginRight !== undefined ? RF(marginRight) : undefined,
    marginStart: marginStart !== undefined ? RF(marginStart) : undefined,
    marginEnd: marginEnd !== undefined ? RF(marginEnd) : undefined,

    flex,
    flexGrow,
    flexShrink,
    flexBasis: flexBasis as any,
    flexWrap,
    alignItems,
    justifyContent,
    alignSelf,
    alignContent,

    columnGap: columnGap !== undefined ? RF(columnGap) : undefined,
    gap: gap !== undefined ? RF(gap) : undefined,

    width: toDim(width),
    height: toDim(height),
    minWidth: toDim(minWidth),
    maxWidth: toDim(maxWidth),
    minHeight: toDim(minHeight),
    maxHeight: toDim(maxHeight),
    aspectRatio,

    position,
    top: toDim(top),
    bottom: toDim(bottom),
    left: toDim(left),
    right: toDim(right),
    start: toDim(start),
    end: toDim(end),
    zIndex,

    backgroundColor,
    opacity,
    overflow,
    display,
    direction,

    borderRadius: borderRadius !== undefined ? RF(borderRadius) : undefined,
    borderTopLeftRadius:
      borderTopLeftRadius !== undefined ? RF(borderTopLeftRadius) : undefined,
    borderTopRightRadius:
      borderTopRightRadius !== undefined ? RF(borderTopRightRadius) : undefined,
    borderBottomLeftRadius:
      borderBottomLeftRadius !== undefined
        ? RF(borderBottomLeftRadius)
        : undefined,
    borderBottomRightRadius:
      borderBottomRightRadius !== undefined
        ? RF(borderBottomRightRadius)
        : undefined,

    borderWidth: borderWidth !== undefined ? RF(borderWidth) : undefined,
    borderTopWidth:
      borderTopWidth !== undefined ? RF(borderTopWidth) : undefined,
    borderBottomWidth:
      borderBottomWidth !== undefined ? RF(borderBottomWidth) : undefined,
    borderLeftWidth:
      borderLeftWidth !== undefined ? RF(borderLeftWidth) : undefined,
    borderRightWidth:
      borderRightWidth !== undefined ? RF(borderRightWidth) : undefined,
    borderStartWidth:
      borderStartWidth !== undefined ? RF(borderStartWidth) : undefined,
    borderEndWidth:
      borderEndWidth !== undefined ? RF(borderEndWidth) : undefined,

    borderColor,
    borderTopColor,
    borderBottomColor,
    borderLeftColor,
    borderRightColor,
    borderStartColor,
    borderEndColor,
    borderStyle,

    shadowColor,
    shadowOffset,
    shadowOpacity,
    shadowRadius,
    elevation,

    transform,
    backfaceVisibility,
  };

  return (
    <View
      style={[
        { flexDirection: "row" },
        customStyle,
        style as StyleProp<ViewStyle>,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
};

export default AppRowView;
