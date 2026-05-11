import { Colors } from "@theme/colors";
import { Fonts } from "@theme/fonts";
import { RF } from "@theme/responsive";

import { ANDROID } from "@utils/constants";
import React, { forwardRef, useState } from "react";
import { Platform, StyleSheet, TextInputProps, ViewStyle } from "react-native";
import AppColumnView from "../appColumnView";
import AppPressable from "../appPressable";
import AppRowView from "../appRowView";
import AppText from "../appText";
import CustomTextInput from "../customTextInput";

interface InputProp extends TextInputProps {
  title: any;
  visible?: any;
  titleColor: string;
  containerStyle: ViewStyle;
  HeadingTitle: string;
  titleSize: number;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  inputProps: TextInputProps;
  error: any;
  errorStyle: any;
  showPassword: boolean;
  toggleShowPassword: () => void;
  key: any;
  iconColor: string;
  required: boolean;
  onRightPress: () => void;
  setKeyPress: (key: string) => void;
  disableContainerPress: boolean;
  mainContainerStyle: any;
  inputStyle: any;
  tintColor: any;
  charLimit: number;
  value: any;
  displayError: boolean;
  placeHolderColor?: string;
  inputType?: string;
  keyboardNumberic?: boolean;
  isFocused?: boolean;
  setValue?: any;
  cancelIcon?: any;
  scrollEnabled?: boolean;
  titleConStyle?: ViewStyle | any;
  titleFontFamily?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  inputColor?: string;
  borderRadius?: number;
  disabled?: boolean;
}

const AppInput = forwardRef((props: Partial<InputProp>, ref: any) => {
  const {
    titleSize = 15,
    title,
    titleColor = Colors.BLACK,
    leftIcon,
    rightIcon,
    error,
    containerStyle,
    errorStyle,
    showPassword,
    value,
    toggleShowPassword,
    iconColor,
    key,
    required,
    onRightPress,
    inputType,
    multiline,
    setKeyPress,
    editable = true,
    disableContainerPress,
    mainContainerStyle,
    inputStyle,
    tintColor,
    visible = true,
    charLimit,
    displayError = true,
    placeHolderColor = Colors.GRAY_4,
    keyboardNumberic = false,
    setValue = () => {},
    cancelIcon,
    scrollEnabled = false,
    titleConStyle,
    titleFontFamily = Fonts.MEDIUM,
    backgroundColor,
    borderColor,
    borderWidth,
    inputColor,
    borderRadius,
    disabled,
    ...restProps
  } = props;
  const labelSize = 15;
  const [isFocus, setIsFocus] = useState(false);

  return (
    visible && (
      <AppColumnView marginBottom={12} style={mainContainerStyle}>
        <AppRowView justifyContent="space-between" style={titleConStyle}>
          {!!title && (
            <AppText
              fontFamily={titleFontFamily}
              size={titleSize}
              color={!editable ? Colors.GRAY_5 : titleColor}
              marginBottom={8}
            >
              {title}
              <AppText
                size={titleSize}
                color={required && !editable ? Colors.ERROR : Colors.ERROR}
                fontFamily={titleFontFamily}
              >
                {required ? " *" : ""}
              </AppText>
            </AppText>
          )}
          {!!charLimit && (
            <AppText size={labelSize}>
              {value?.length > 0 && value.length}
              <AppText size={labelSize} color={Colors.GRAY_3} marginBottom={8}>
                {value?.length > 0 && "/"}
                {charLimit}
              </AppText>
            </AppText>
          )}
        </AppRowView>
        <AppPressable
          flexDirection="row"
          alignItems="center"
          paddingHorizontal={ANDROID ? 16 : 18}
          padding={ANDROID ? 6 : 12}
          backgroundColor={
            disabled ? Colors.GRAY_1 : (backgroundColor ?? Colors.WHITE)
          }
          borderRadius={borderRadius ?? 8}
          borderWidth={borderWidth ?? 1}
          borderColor={
            borderColor ? borderColor : isFocus ? Colors.PRIMARY : Colors.GRAY_2
          }
          style={[containerStyle, multiline && styles.flexStart]}
          disabled={disableContainerPress}
          onPress={onRightPress}
        >
          {leftIcon && (
            <AppColumnView marginRight={12}>{leftIcon}</AppColumnView>
          )}
          <CustomTextInput
            ref={ref}
            value={value}
            maxLength={charLimit || props.maxLength}
            pointerEvents={editable ? "auto" : "none"}
            textContentType="oneTimeCode"
            keyboardType={keyboardNumberic ? "number-pad" : "default"}
            flex={1}
            paddingRight={14}
            fontFamily={Fonts.MEDIUM}
            color={inputColor ?? Colors.GRAY_10}
            fontSize={14}
            paddingVertical={ANDROID ? 0 : 4}
            style={[
              multiline && styles.multiline,
              multiline && {
                textAlignVertical: "top",
                paddingTop: Platform.OS === "ios" ? 0 : 0,
              },
              inputStyle,
            ]}
            placeholderTextColor={placeHolderColor}
            onKeyPress={(e) => setKeyPress && setKeyPress(e.nativeEvent.key)}
            autoCorrect={false}
            scrollEnabled={!multiline || scrollEnabled}
            onFocus={() => setIsFocus(true)}
            onBlur={() => setIsFocus(false)}
            multiline={multiline}
            {...restProps}
          />

          {!!rightIcon && (
            <AppColumnView marginLeft={12}>{rightIcon}</AppColumnView>
          )}
        </AppPressable>
        {!!error && displayError && (
          <AppText
            italic
            color={Colors.ERROR}
            size={12}
            marginTop={8}
            fontFamily={Fonts.MEDIUM}
            style={errorStyle}
          >
            {error}
          </AppText>
        )}
      </AppColumnView>
    )
  );
});

const styles = StyleSheet.create({
  multiline: {
    textAlignVertical: "top",
    height: RF(80),
    lineHeight: RF(19),
    ...(Platform.OS === "ios" && {
      paddingTop: 0,
      paddingBottom: 0,
    }),
  },
  flexStart: {
    alignItems: "flex-start",
    borderRadius: RF(12),
    ...(Platform.OS === "ios" && {
      paddingTop: 12,
      paddingBottom: 12,
    }),
  },
});

export default AppInput;
