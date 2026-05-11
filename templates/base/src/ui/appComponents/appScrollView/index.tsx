import { RF } from '@theme/responsive';
import React, { ComponentProps, forwardRef } from 'react';
import { DimensionValue, ScrollView, ViewStyle } from 'react-native';

type RNScrollViewProps = ComponentProps<typeof ScrollView>;

interface ExtraStyleProps {
  horizontal?: boolean;
  showsHorizontalScrollIndicator?: boolean;
  showsVerticalScrollIndicator?: boolean;
  padding?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;

  margin?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  marginHorizontal?: number;
  marginVertical?: number;

  borderRadius?: number;

  flex?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | DimensionValue;
  flexWrap?: ViewStyle['flexWrap'];
  flexDirection?: ViewStyle['flexDirection'];
  alignItems?: ViewStyle['alignItems'];
  justifyContent?: ViewStyle['justifyContent'];
  alignSelf?: ViewStyle['alignSelf'];
  gap?: number;

  backgroundColor?: string;

  height?: DimensionValue;
  maxHeight?: DimensionValue;
  minHeight?: DimensionValue;
  maxWidth?: DimensionValue;
  minWidth?: DimensionValue;
  width?: DimensionValue;
  aspectRatio?: number;
}

export type AppScrollViewProps = RNScrollViewProps & ExtraStyleProps;

const AppScrollView = forwardRef<
  React.ComponentRef<typeof ScrollView>,
  AppScrollViewProps
>(
  (
    {
      children,
      style,
      contentContainerStyle,
      padding,
      paddingTop,
      paddingBottom,
      paddingLeft,
      paddingRight,
      paddingHorizontal,
      paddingVertical,
      margin,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      marginHorizontal,
      marginVertical,
      flex,
      flexGrow,
      flexShrink,
      flexBasis,
      flexWrap,
      flexDirection,
      alignItems,
      justifyContent,
      alignSelf,
      gap,
      backgroundColor,
      borderRadius,
      height,
      maxHeight,
      minHeight,
      maxWidth,
      minWidth,
      width,
      aspectRatio,
      ...rest
    },
    ref,
  ) => {
    const toDim = (v?: number | DimensionValue) =>
      v === undefined
        ? undefined
        : typeof v === 'number'
        ? (RF(v) as unknown as DimensionValue)
        : v;

    const spacingStyle: ViewStyle = {
      padding: padding !== undefined ? RF(padding) : undefined,
      paddingTop: paddingTop !== undefined ? RF(paddingTop) : undefined,
      paddingBottom:
        paddingBottom !== undefined ? RF(paddingBottom) : undefined,
      paddingLeft: paddingLeft !== undefined ? RF(paddingLeft) : undefined,
      paddingRight: paddingRight !== undefined ? RF(paddingRight) : undefined,
      paddingHorizontal:
        paddingHorizontal !== undefined ? RF(paddingHorizontal) : undefined,
      paddingVertical:
        paddingVertical !== undefined ? RF(paddingVertical) : undefined,

      margin: margin !== undefined ? RF(margin) : undefined,
      marginTop: marginTop !== undefined ? RF(marginTop) : undefined,
      marginBottom: marginBottom !== undefined ? RF(marginBottom) : undefined,
      marginLeft: marginLeft !== undefined ? RF(marginLeft) : undefined,
      marginRight: marginRight !== undefined ? RF(marginRight) : undefined,
      marginHorizontal:
        marginHorizontal !== undefined ? RF(marginHorizontal) : undefined,
      marginVertical:
        marginVertical !== undefined ? RF(marginVertical) : undefined,

      borderRadius: borderRadius !== undefined ? RF(borderRadius) : undefined,

      flex,
      flexGrow,
      flexShrink,
      flexBasis: toDim(flexBasis),
      flexDirection,
      flexWrap,
      alignItems,
      justifyContent,
      alignSelf,
      gap: gap !== undefined ? RF(gap) : undefined,

      backgroundColor,
      height: toDim(height),
      maxHeight: toDim(maxHeight),
      minHeight: toDim(minHeight),
      maxWidth: toDim(maxWidth),
      minWidth: toDim(minWidth),
      width: toDim(width),
      aspectRatio: aspectRatio !== undefined ? RF(aspectRatio) : undefined,
    };

    return (
      <ScrollView
        ref={ref}
        style={style}
        contentContainerStyle={[spacingStyle, contentContainerStyle]}
        {...rest}
      >
        {children}
      </ScrollView>
    );
  },
);

AppScrollView.displayName = 'AppScrollView';

export default AppScrollView;
