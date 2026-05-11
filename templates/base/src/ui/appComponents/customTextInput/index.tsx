import { Colors } from "@theme/colors";
import { Fonts } from "@theme/fonts";
import { RF, RFT } from "@theme/responsive";
import React, { forwardRef } from "react";
import {
  DimensionValue,
  TextInput,
  TextInputProps,
  TextStyle,
} from "react-native";

interface CustomTextInputProps extends Omit<TextInputProps, "textAlign"> {
  flex?: number;
  width?: DimensionValue | number;
  height?: number;
  maxHeight?: number;
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
  borderRadius?: number;
  borderWidth?: number;
  borderBottomWidth?: number;
  borderTopWidth?: number;
  borderLeftWidth?: number;
  borderRightWidth?: number;
  borderBottomColor?: string;
  borderTopColor?: string;
  borderLeftColor?: string;
  borderRightColor?: string;
  borderColor?: string;
  borderStyle?: "solid" | "dotted" | "dashed";
  backgroundColor?: string;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: TextStyle["textAlign"]; // ✅ Fix type conflict
  textAlignVertical?: TextStyle["textAlignVertical"];
}

const CustomTextInput = forwardRef<TextInput, CustomTextInputProps>(
  (
    {
      flex,
      width,
      height,
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
      borderRadius,
      borderWidth,
      borderBottomWidth,
      borderTopWidth,
      borderLeftWidth,
      borderRightWidth,
      borderBottomColor,
      borderTopColor,
      borderLeftColor,
      borderRightColor,
      borderColor,
      borderStyle,
      backgroundColor,
      color = Colors.PRIMARY,
      fontSize = RFT(14),
      fontFamily = Fonts.MEDIUM,
      textAlign,
      style,
      ...rest
    },
    ref,
  ) => {
    const toDim = (v?: number | DimensionValue) =>
      v === undefined
        ? undefined
        : typeof v === "number"
          ? (RF(v) as unknown as DimensionValue)
          : v;

    const inputStyle: TextStyle = {
      flex,
      width: toDim(width),
      height: height ? RF(height) : undefined,
      maxHeight: maxHeight ? RF(maxHeight) : undefined,
      padding: padding ? RF(padding) : undefined,
      paddingHorizontal: paddingHorizontal ? RF(paddingHorizontal) : undefined,
      paddingVertical: paddingVertical ? RF(paddingVertical) : undefined,
      paddingTop: paddingTop ? RF(paddingTop) : undefined,
      paddingBottom: paddingBottom ? RF(paddingBottom) : undefined,
      paddingLeft: paddingLeft ? RF(paddingLeft) : undefined,
      paddingRight: paddingRight ? RF(paddingRight) : undefined,
      margin: margin ? RF(margin) : undefined,
      marginHorizontal: marginHorizontal ? RF(marginHorizontal) : undefined,
      marginVertical: marginVertical ? RF(marginVertical) : undefined,
      marginTop: marginTop ? RF(marginTop) : undefined,
      marginBottom: marginBottom ? RF(marginBottom) : undefined,
      marginLeft: marginLeft ? RF(marginLeft) : undefined,
      marginRight: marginRight ? RF(marginRight) : undefined,
      borderRadius: borderRadius ? RF(borderRadius) : undefined,
      borderWidth,
      borderBottomWidth,
      borderTopWidth,
      borderLeftWidth,
      borderRightWidth,
      borderBottomColor,
      borderTopColor,
      borderLeftColor,
      borderRightColor,
      borderColor,
      borderStyle,
      backgroundColor,
      color,
      fontSize,
      fontFamily,
      textAlign,
    };

    return <TextInput ref={ref} style={[inputStyle, style]} {...rest} />;
  },
);

export default CustomTextInput;
