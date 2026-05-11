import { Colors } from '@theme/colors';
import { Fonts } from '@theme/fonts';
import { RF, RFT } from '@theme/responsive';
import React from 'react';
import { DimensionValue, Text, TextProps, TextStyle } from 'react-native';

interface AppTextProps extends TextProps {
  size?: number;
  color?: string;
  fontFamily?: string;
  capital?: boolean;
  center?: boolean;
  italic?: boolean;

  flex?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | DimensionValue;
  alignSelf?: TextStyle['alignSelf'];
  textAlign?: TextStyle['textAlign'];
  width?: number | DimensionValue;
  height?: number | DimensionValue;
  minWidth?: number | DimensionValue;
  maxWidth?: number | DimensionValue;
  minHeight?: number | DimensionValue;
  maxHeight?: number | DimensionValue;

  position?: TextStyle['position'];
  top?: number | DimensionValue;
  bottom?: number | DimensionValue;
  left?: number | DimensionValue;
  right?: number | DimensionValue;
  zIndex?: number;

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
  paddingStart?: number;
  paddingEnd?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;

  backgroundColor?: string;
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
  borderStyle?: TextStyle['borderStyle'];

  textShadowColor?: string;
  textShadowOffset?: { width: number; height: number };
  textShadowRadius?: number;

  lineHeight?: number;
  letterSpacing?: number;
  opacity?: number;
  textDecorationLine?: TextStyle['textDecorationLine'];
  textTransform?: TextStyle['textTransform'];
  includeFontPadding?: boolean;
}

const AppText: React.FC<AppTextProps> = props => {
  const {
    children,
    size = 12,
    color = Colors.PRIMARY,
    fontFamily = Fonts.REGULAR,
    capital = false,
    center = false,
    italic,
    style,
    flex,
    flexGrow,
    flexShrink,
    flexBasis,
    alignSelf,
    width,
    height,
    minWidth,
    maxWidth,
    minHeight,
    maxHeight,
    textAlign,
    position,
    top,
    bottom,
    left,
    right,
    zIndex,
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
    paddingStart,
    paddingEnd,
    paddingLeft,
    paddingRight,
    paddingHorizontal,
    paddingVertical,
    backgroundColor,
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
    textShadowColor,
    textShadowOffset,
    textShadowRadius,
    lineHeight,
    letterSpacing,
    opacity,
    textDecorationLine,
    textTransform,
    includeFontPadding,
    lineBreakMode,
    ...rest
  } = props;

  const toDim = (v?: number | DimensionValue) =>
    v === undefined ? undefined : typeof v === 'number' ? RF(v) : v;

  const textStyle: TextStyle = {
    fontSize: RFT(size),
    fontFamily,
    color,
    fontStyle: italic ? 'italic' : 'normal',
    textTransform: capital ? 'uppercase' : textTransform || 'none',
    textAlign: center ? 'center' : textAlign,
    lineHeight: lineHeight ? RFT(lineHeight) : undefined,
    letterSpacing: letterSpacing ? RFT(letterSpacing) : undefined,
    opacity,

    flex,
    flexGrow,
    flexShrink,
    flexBasis: flexBasis as any,
    alignSelf,
    width: toDim(width),
    height: toDim(height),
    minWidth: toDim(minWidth),
    maxWidth: toDim(maxWidth),
    minHeight: toDim(minHeight),
    maxHeight: toDim(maxHeight),

    position,
    top: toDim(top),
    bottom: toDim(bottom),
    left: toDim(left),
    right: toDim(right),
    zIndex,

    margin: margin !== undefined ? RF(margin) : undefined,
    marginTop: marginTop !== undefined ? RF(marginTop) : undefined,
    marginBottom: marginBottom !== undefined ? RF(marginBottom) : undefined,
    marginLeft: marginLeft !== undefined ? RF(marginLeft) : undefined,
    marginRight: marginRight !== undefined ? RF(marginRight) : undefined,
    marginHorizontal:
      marginHorizontal !== undefined ? RF(marginHorizontal) : undefined,
    marginVertical:
      marginVertical !== undefined ? RF(marginVertical) : undefined,

    padding: padding !== undefined ? RF(padding) : undefined,
    paddingTop: paddingTop !== undefined ? RF(paddingTop) : undefined,
    paddingBottom: paddingBottom !== undefined ? RF(paddingBottom) : undefined,
    paddingLeft: paddingStart !== undefined ? RF(paddingStart) : undefined,
    paddingStart: paddingLeft !== undefined ? RF(paddingLeft) : undefined,
    paddingEnd: paddingEnd !== undefined ? RF(paddingEnd) : undefined,
    paddingRight: paddingRight !== undefined ? RF(paddingRight) : undefined,
    paddingHorizontal:
      paddingHorizontal !== undefined ? RF(paddingHorizontal) : undefined,
    paddingVertical:
      paddingVertical !== undefined ? RF(paddingVertical) : undefined,

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

    textShadowColor,
    textShadowOffset,
    textShadowRadius,

    includeFontPadding,
  };

  return (
    <Text allowFontScaling={false} style={[textStyle, style]} {...rest}>
      {children}
    </Text>
  );
};

export default AppText;
