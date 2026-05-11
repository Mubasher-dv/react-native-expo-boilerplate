import AppColumnView from "@appComponents/appColumnView";
import {
  FlashListProps,
  FlashListRef,
  FlashList as ShopifyFlashList,
} from "@shopify/flash-list";
import { RF } from "@theme/responsive";
import React from "react";
import { DimensionValue, StyleProp, ViewStyle } from "react-native";

type NumericOrDim = number | DimensionValue;

export interface AppFlashListProps<T> extends Omit<
  FlashListProps<T>,
  "style" | "contentContainerStyle"
> {
  ref?: React.RefObject<FlashListRef<T>>;
  flex?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: NumericOrDim;

  flexWrap?: ViewStyle["flexWrap"];
  flexDirection?: ViewStyle["flexDirection"];
  alignItems?: ViewStyle["alignItems"];
  justifyContent?: ViewStyle["justifyContent"];
  alignSelf?: ViewStyle["alignSelf"];

  width?: NumericOrDim;
  height?: NumericOrDim;
  minWidth?: NumericOrDim;
  maxWidth?: NumericOrDim;
  minHeight?: NumericOrDim;
  maxHeight?: NumericOrDim;

  padding?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  gap?: number;

  margin?: number;
  marginHorizontal?: number;
  marginVertical?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;

  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  backgroundColor?: string;

  position?: ViewStyle["position"];
  top?: NumericOrDim;
  right?: NumericOrDim;
  bottom?: NumericOrDim;
  left?: NumericOrDim;

  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

const toDim = (v?: number | DimensionValue) =>
  v === undefined
    ? undefined
    : typeof v === "number"
      ? (RF(v) as unknown as DimensionValue)
      : v;

function buildContainerStyle<T>(props: AppFlashListProps<T>): ViewStyle {
  const {
    flex,
    flexGrow,
    flexShrink,
    flexBasis,
    flexWrap,
    flexDirection,
    alignItems,
    justifyContent,
    alignSelf,
    width,
    height,
    minWidth,
    maxWidth,
    minHeight,
    maxHeight,
    padding,
    paddingHorizontal,
    paddingVertical,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
    gap,
    margin,
    marginHorizontal,
    marginVertical,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    borderRadius,
    borderWidth,
    borderColor,
    backgroundColor,
    position,
    top,
    right,
    bottom,
    left,
  } = props;

  return {
    flex,
    flexGrow,
    flexShrink,
    flexBasis: toDim(flexBasis),
    flexWrap,
    flexDirection,
    alignItems,
    justifyContent,
    alignSelf,

    width: toDim(width),
    height: toDim(height),
    minWidth: toDim(minWidth),
    maxWidth: toDim(maxWidth),
    minHeight: toDim(minHeight),
    maxHeight: toDim(maxHeight),

    padding: padding !== undefined ? RF(padding) : undefined,
    paddingHorizontal:
      paddingHorizontal !== undefined ? RF(paddingHorizontal) : undefined,
    paddingVertical:
      paddingVertical !== undefined ? RF(paddingVertical) : undefined,
    paddingTop: paddingTop !== undefined ? RF(paddingTop) : undefined,
    paddingBottom: paddingBottom !== undefined ? RF(paddingBottom) : undefined,
    paddingLeft: paddingLeft !== undefined ? RF(paddingLeft) : undefined,
    paddingRight: paddingRight !== undefined ? RF(paddingRight) : undefined,

    gap: gap !== undefined ? RF(gap) : undefined,

    margin: margin !== undefined ? RF(margin) : undefined,
    marginHorizontal:
      marginHorizontal !== undefined ? RF(marginHorizontal) : undefined,
    marginVertical:
      marginVertical !== undefined ? RF(marginVertical) : undefined,
    marginTop: marginTop !== undefined ? RF(marginTop) : undefined,
    marginBottom: marginBottom !== undefined ? RF(marginBottom) : undefined,
    marginLeft: marginLeft !== undefined ? RF(marginLeft) : undefined,
    marginRight: marginRight !== undefined ? RF(marginRight) : undefined,

    borderRadius: borderRadius !== undefined ? RF(borderRadius) : undefined,
    borderWidth: borderWidth !== undefined ? RF(borderWidth) : undefined,
    borderColor,
    backgroundColor,

    position,
    top: toDim(top),
    right: toDim(right),
    bottom: toDim(bottom),
    left: toDim(left),
  };
}

export default function AppFlashList<T>(props: AppFlashListProps<T>) {
  const { ref, style, contentContainerStyle, gap, children, ...rest } = props;

  const containerStyle = buildContainerStyle(props);

  const separator =
    gap !== undefined
      ? () => <AppColumnView height={gap} />
      : undefined;

  return (
    <ShopifyFlashList
      ref={ref}
      {...(rest as FlashListProps<T>)}
      ItemSeparatorComponent={rest.ItemSeparatorComponent ?? separator}
      contentContainerStyle={[containerStyle, contentContainerStyle]}
    >
      {children}
    </ShopifyFlashList>
  );
}
