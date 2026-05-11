import { RF } from "@theme/responsive";
import { BottomSheetView } from "@gorhom/bottom-sheet";
import React from "react";
import { DimensionValue, ViewProps, ViewStyle } from "react-native";

interface AppBottomSheetViewProps extends ViewProps {
  children?: React.ReactNode;
  focusHook?: () => void;

  flex?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | DimensionValue;
  flexDirection?: ViewStyle["flexDirection"];
  alignItems?: ViewStyle["alignItems"];
  justifyContent?: ViewStyle["justifyContent"];
  alignSelf?: ViewStyle["alignSelf"];

  gap?: number;

  width?: number | DimensionValue;
  height?: number | DimensionValue;
  minWidth?: number | DimensionValue;
  maxWidth?: number | DimensionValue;
  minHeight?: number | DimensionValue;
  maxHeight?: number | DimensionValue;

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

  backgroundColor?: string;
  borderRadius?: number;
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  borderBottomLeftRadius?: number;
  borderBottomRightRadius?: number;
  opacity?: number;
  overflow?: ViewStyle["overflow"];
}

const AppBottomSheetView: React.FC<AppBottomSheetViewProps> = ({
  children,
  focusHook,
  style,
  flex,
  flexGrow,
  flexShrink,
  flexBasis,
  flexDirection,
  alignItems,
  justifyContent,
  alignSelf,
  gap,
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
  margin,
  marginHorizontal,
  marginVertical,
  marginTop,
  marginBottom,
  marginLeft,
  marginRight,
  backgroundColor,
  borderRadius,
  borderTopLeftRadius,
  borderTopRightRadius,
  borderBottomLeftRadius,
  borderBottomRightRadius,
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

  const customStyle: ViewStyle = {
    flex,
    flexGrow,
    flexShrink,
    flexBasis,
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

    gap: gap !== undefined ? RF(gap) : undefined,

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

    backgroundColor,
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

    opacity,
    overflow,
  };

  return (
    <BottomSheetView
      focusHook={focusHook}
      style={[customStyle, style]}
      {...rest}
    >
      {children}
    </BottomSheetView>
  );
};

export default AppBottomSheetView;
