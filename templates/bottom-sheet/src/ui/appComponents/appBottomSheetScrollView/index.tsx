import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { RF } from "@theme/responsive";
import React, { ComponentProps, forwardRef } from "react";
import { ViewStyle } from "react-native";

type BottomSheetScrollViewProps = ComponentProps<typeof BottomSheetScrollView>;

interface ExtraStyleProps {
  padding?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;

  gap?: number;

  margin?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  marginHorizontal?: number;
  marginVertical?: number;
}

export type AppBottomSheetScrollViewProps = BottomSheetScrollViewProps &
  ExtraStyleProps;

const AppBottomSheetScrollView = forwardRef<
  React.ComponentRef<typeof BottomSheetScrollView>,
  AppBottomSheetScrollViewProps
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
      gap,
      margin,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      marginHorizontal,
      marginVertical,
      ...rest
    },
    ref,
  ) => {
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

      gap: gap !== undefined ? RF(gap) : undefined,

      margin: margin !== undefined ? RF(margin) : undefined,
      marginTop: marginTop !== undefined ? RF(marginTop) : undefined,
      marginBottom: marginBottom !== undefined ? RF(marginBottom) : undefined,
      marginLeft: marginLeft !== undefined ? RF(marginLeft) : undefined,
      marginRight: marginRight !== undefined ? RF(marginRight) : undefined,
      marginHorizontal:
        marginHorizontal !== undefined ? RF(marginHorizontal) : undefined,
      marginVertical:
        marginVertical !== undefined ? RF(marginVertical) : undefined,
    };

    return (
      <BottomSheetScrollView
        ref={ref}
        style={style}
        contentContainerStyle={[spacingStyle, contentContainerStyle]}
        {...rest}
      >
        {children}
      </BottomSheetScrollView>
    );
  },
);

AppBottomSheetScrollView.displayName = "AppBottomSheetScrollView";

export default AppBottomSheetScrollView;
