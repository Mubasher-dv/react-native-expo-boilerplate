import { RF } from '@theme/responsive';
import React from 'react';
import {
  DimensionValue,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';

type CustomPressableProps = PressableProps & {
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

  flex?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | DimensionValue;
  flexWrap?: ViewStyle['flexWrap'];
  alignItems?: ViewStyle['alignItems'];
  justifyContent?: ViewStyle['justifyContent'];
  alignSelf?: ViewStyle['alignSelf'];
  alignContent?: ViewStyle['alignContent'];
  flexDirection?: ViewStyle['flexDirection'];

  gap?: number;
  rowGap?: number;
  columnGap?: number;

  width?: number | DimensionValue;
  height?: number | DimensionValue;
  minWidth?: number | DimensionValue;
  maxWidth?: number | DimensionValue;
  minHeight?: number | DimensionValue;
  maxHeight?: number | DimensionValue;
  aspectRatio?: number;

  position?: ViewStyle['position'];
  top?: number | DimensionValue;
  left?: number | DimensionValue;
  right?: number | DimensionValue;
  bottom?: number | DimensionValue;
  zIndex?: number;

  backgroundColor?: string;
  opacity?: number;
  overflow?: ViewStyle['overflow'];
  display?: ViewStyle['display'];
  borderRadius?: number;
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  borderBottomLeftRadius?: number;
  borderBottomRightRadius?: number;

  borderWidth?: number;
  borderTopWidth?: number;
  borderBottomWidth?: number;
  borderLeftWidth?: number;
  borderRightWidth?: number;
  borderColor?: string;
  borderTopColor?: string;
  borderBottomColor?: string;
  borderLeftColor?: string;
  borderRightColor?: string;
  borderStyle?: ViewStyle['borderStyle'];

  shadowColor?: string;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number;
  shadowRadius?: number;
  elevation?: number;

  transform?: ViewStyle['transform'];
  backfaceVisibility?: ViewStyle['backfaceVisibility'];
};

const AppPressable: React.FC<CustomPressableProps> = ({
  children,
  style,
  position,
  top,
  left,
  right,
  bottom,
  zIndex,
  gap,
  rowGap,
  columnGap,
  alignItems,
  justifyContent,
  alignSelf,
  alignContent,
  flexDirection,
  flex,
  flexGrow,
  flexShrink,
  flexBasis,
  flexWrap,
  width,
  height,
  minWidth,
  maxWidth,
  minHeight,
  maxHeight,
  aspectRatio,
  backgroundColor,
  opacity,
  overflow,
  display,
  borderRadius,
  borderTopLeftRadius,
  borderTopRightRadius,
  borderBottomLeftRadius,
  borderBottomRightRadius,
  borderWidth,
  borderTopWidth,
  borderBottomWidth,
  borderLeftWidth,
  borderRightWidth,
  borderColor,
  borderTopColor,
  borderBottomColor,
  borderLeftColor,
  borderRightColor,
  borderStyle,
  ...rest
}) => {
  const toDim = (v?: number | DimensionValue) =>
    v === undefined
      ? undefined
      : typeof v === 'number'
      ? (RF(v) as unknown as DimensionValue)
      : v;

  const customStyle: ViewStyle = {
    position,
    top: toDim(top),
    left: toDim(left),
    right: toDim(right),
    bottom: toDim(bottom),
    zIndex,

    gap: gap !== undefined ? RF(gap) : undefined,
    rowGap: rowGap !== undefined ? RF(rowGap) : undefined,
    columnGap: columnGap !== undefined ? RF(columnGap) : undefined,

    alignItems,
    justifyContent,
    alignSelf,
    alignContent,
    flexDirection,
    flex,
    flexGrow,
    flexShrink,
    flexBasis,
    flexWrap,
    width: toDim(width),
    height: toDim(height),
    minWidth: toDim(minWidth),
    maxWidth: toDim(maxWidth),
    minHeight: toDim(minHeight),
    maxHeight: toDim(maxHeight),
    aspectRatio,
    backgroundColor,
    opacity,
    overflow,
    display,
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
    borderColor,
    borderTopColor,
    borderBottomColor,
    borderLeftColor,
    borderRightColor,
    borderStyle,
  };

  return (
    <Pressable style={[customStyle, style as StyleProp<ViewStyle>]} {...rest}>
      {children}
    </Pressable>
  );
};

export default AppPressable;
