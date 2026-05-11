import { RF } from "@theme/responsive";
import React from "react";
import { DimensionValue, StyleProp, ViewStyle } from "react-native";
import {
  KeyboardAvoidingView,
  KeyboardAvoidingViewProps,
} from "react-native-keyboard-controller";

type CustomKeyboardAvoidingViewProps = KeyboardAvoidingViewProps & {
  children?: React.ReactNode;

  padding?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;

  margin?: number;
  marginHorizontal?: number;
  marginVertical?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;

  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;

  gap?: number;
  rowGap?: number;
  columnGap?: number;

  flex?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number;
  flexDirection?: ViewStyle["flexDirection"];
  alignItems?: ViewStyle["alignItems"];
  justifyContent?: ViewStyle["justifyContent"];
  alignSelf?: ViewStyle["alignSelf"];
  flexWrap?: ViewStyle["flexWrap"];

  width?: number | DimensionValue;
  height?: number | DimensionValue;
  minWidth?: number | DimensionValue;
  maxWidth?: number | DimensionValue;
  minHeight?: number | DimensionValue;
  maxHeight?: number | DimensionValue;

  backgroundColor?: string;
  borderRadius?: number;
  opacity?: number;
  overflow?: ViewStyle["overflow"];
};

const AppKeyboardAvoidingView: React.FC<CustomKeyboardAvoidingViewProps> = ({
  children,
  style,
  padding,
  paddingHorizontal,
  paddingVertical,
  paddingTop,
  paddingBottom,
  paddingLeft,
  paddingRight,
  margin,
  marginHorizontal,
  marginVertical,
  marginTop,
  marginBottom,
  marginLeft,
  marginRight,
  borderTopLeftRadius,
  borderTopRightRadius,
  gap,
  rowGap,
  columnGap,
  flex,
  flexGrow,
  flexShrink,
  flexBasis,
  flexDirection,
  alignItems,
  justifyContent,
  alignSelf,
  flexWrap,
  width,
  height,
  minWidth,
  maxWidth,
  minHeight,
  maxHeight,
  backgroundColor,
  borderRadius,
  opacity,
  overflow,
  ...rest
}) => {
  const toDim = (v?: number | DimensionValue) =>
    v === undefined
      ? undefined
      : typeof v === "number"
        ? (RF(v) as unknown as DimensionValue)
        : v;

  const customStyle: StyleProp<ViewStyle> = {
    padding: padding !== undefined ? RF(padding) : undefined,
    paddingHorizontal:
      paddingHorizontal !== undefined ? RF(paddingHorizontal) : undefined,
    paddingVertical:
      paddingVertical !== undefined ? RF(paddingVertical) : undefined,
    paddingTop: paddingTop !== undefined ? RF(paddingTop) : undefined,
    paddingBottom: paddingBottom !== undefined ? RF(paddingBottom) : undefined,
    paddingLeft: paddingLeft !== undefined ? RF(paddingLeft) : undefined,
    paddingRight: paddingRight !== undefined ? RF(paddingRight) : undefined,

    margin: margin !== undefined ? RF(margin) : undefined,
    marginHorizontal:
      marginHorizontal !== undefined ? RF(marginHorizontal) : undefined,
    marginVertical:
      marginVertical !== undefined ? RF(marginVertical) : undefined,
    marginTop: marginTop !== undefined ? RF(marginTop) : undefined,
    marginBottom: marginBottom !== undefined ? RF(marginBottom) : undefined,
    marginLeft: marginLeft !== undefined ? RF(marginLeft) : undefined,
    marginRight: marginRight !== undefined ? RF(marginRight) : undefined,

    gap: gap !== undefined ? RF(gap) : undefined,
    rowGap: rowGap !== undefined ? RF(rowGap) : undefined,
    columnGap: columnGap !== undefined ? RF(columnGap) : undefined,

    borderTopLeftRadius:
      borderTopLeftRadius !== undefined ? RF(borderTopLeftRadius) : undefined,
    borderTopRightRadius:
      borderTopRightRadius !== undefined ? RF(borderTopRightRadius) : undefined,

    flex,
    flexGrow,
    flexShrink,
    flexBasis,
    flexDirection,
    alignItems,
    justifyContent,
    alignSelf,
    flexWrap,

    width: toDim(width),
    height: toDim(height),
    minWidth: toDim(minWidth),
    maxWidth: toDim(maxWidth),
    minHeight: toDim(minHeight),
    maxHeight: toDim(maxHeight),

    backgroundColor,
    borderRadius: borderRadius !== undefined ? RF(borderRadius) : undefined,
    opacity,
    overflow,
  };

  return (
    <KeyboardAvoidingView style={[customStyle, style]} {...rest}>
      {children}
    </KeyboardAvoidingView>
  );
};

export default AppKeyboardAvoidingView;
