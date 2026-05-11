import { RF } from "@theme/responsive";
import React from "react";
import {
  DimensionValue,
  FlatList,
  FlatListProps,
  StyleSheet,
  ViewStyle,
} from "react-native";

const toDim = (v?: number | DimensionValue) =>
  v === undefined
    ? undefined
    : typeof v === "number"
      ? (RF(v) as DimensionValue)
      : v;

interface AppFlatListProps<ItemT> extends FlatListProps<ItemT> {
  margin?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  marginHorizontal?: number;
  marginVertical?: number;
  padding?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;

  gap?: number;

  flex?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | DimensionValue;
  flexWrap?: ViewStyle["flexWrap"];
  alignItems?: ViewStyle["alignItems"];
  alignSelf?: ViewStyle["alignSelf"];
  justifyContent?: ViewStyle["justifyContent"];
  alignContent?: ViewStyle["alignContent"];
  flexDirection?: ViewStyle["flexDirection"];

  width?: number | DimensionValue;
  height?: number | DimensionValue;
  minWidth?: number | DimensionValue;
  maxWidth?: number | DimensionValue;
  minHeight?: number | DimensionValue;
  maxHeight?: number | DimensionValue;

  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;

  position?: ViewStyle["position"];
  top?: number | DimensionValue;
  bottom?: number | DimensionValue;
  left?: number | DimensionValue;
  right?: number | DimensionValue;
}

function AppFlatList<ItemT = any>(props: AppFlatListProps<ItemT>) {
  const {
    style,
    contentContainerStyle,
    horizontal,
    margin,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    marginHorizontal,
    marginVertical,
    padding,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
    paddingHorizontal,
    paddingVertical,
    gap,
    flex,
    flexGrow,
    flexShrink,
    flexBasis,
    flexWrap,
    alignItems,
    alignSelf,
    justifyContent,
    alignContent,
    flexDirection,
    width,
    height,
    minWidth,
    maxWidth,
    minHeight,
    maxHeight,
    borderRadius,
    borderWidth,
    borderColor,
    position,
    top,
    bottom,
    left,
    right,
    ...rest
  } = props;

  const resolvedContentStyle: ViewStyle = {
    margin: margin ? RF(margin) : undefined,
    marginTop: marginTop ? RF(marginTop) : undefined,
    marginBottom: marginBottom ? RF(marginBottom) : undefined,
    marginLeft: marginLeft ? RF(marginLeft) : undefined,
    marginRight: marginRight ? RF(marginRight) : undefined,
    marginHorizontal: marginHorizontal ? RF(marginHorizontal) : undefined,
    marginVertical: marginVertical ? RF(marginVertical) : undefined,

    padding: padding ? RF(padding) : undefined,
    paddingTop: paddingTop ? RF(paddingTop) : undefined,
    paddingBottom: paddingBottom ? RF(paddingBottom) : undefined,
    paddingLeft: paddingLeft ? RF(paddingLeft) : undefined,
    paddingRight: paddingRight ? RF(paddingRight) : undefined,
    paddingHorizontal: paddingHorizontal ? RF(paddingHorizontal) : undefined,
    paddingVertical: paddingVertical ? RF(paddingVertical) : undefined,
    gap: gap ? RF(gap) : undefined,

    flex,
    flexGrow,
    flexShrink,
    flexBasis: toDim(flexBasis),
    flexWrap,
    alignItems,
    alignSelf,
    justifyContent,
    alignContent,
    flexDirection: flexDirection || (horizontal ? "row" : "column"),

    width: toDim(width),
    height: toDim(height),
    minWidth: toDim(minWidth),
    maxWidth: toDim(maxWidth),
    minHeight: toDim(minHeight),
    maxHeight: toDim(maxHeight),

    borderRadius: borderRadius ? RF(borderRadius) : undefined,
    borderWidth: borderWidth ? RF(borderWidth) : undefined,
    borderColor,

    position,
    top: toDim(top),
    bottom: toDim(bottom),
    left: toDim(left),
    right: toDim(right),
  };

  return (
    <FlatList
      {...rest}
      horizontal={horizontal}
      style={style}
      contentContainerStyle={StyleSheet.flatten([
        resolvedContentStyle,
        contentContainerStyle,
      ])}
    />
  );
}

export default AppFlatList;
