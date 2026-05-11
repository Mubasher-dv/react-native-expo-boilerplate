import AppText from "@appComponents/appText";
import { Colors } from "@theme/colors";
import { Fonts } from "@theme/fonts";
import { RF } from "@theme/responsive";
import { InsetsProps } from "@utils/types";
import React from "react";
import AppColumnView from "../appColumnView";
import AppPressable from "../appPressable";
import AppRowView from "../appRowView";
import { useSafeArea } from "../appSafeAreaInsets";
import CustomActivityIndicator from "../customActivityIndicator";

interface AppButtonProps extends Partial<
  React.ComponentProps<typeof AppPressable>
> {
  title: string;
  titleColor?: string;
  titleSize?: number;
  titleFontFamily?: string;
  bgColor?: string;
  customStyle?: any;
  customContainerStyle?: any;
  disabled?: boolean;
  sticky?: boolean;
  leftIcon?: React.ReactNode;
  leftIconHeight?: number;
  leftIconWidth?: number;
  fill?: boolean;
  iconColor?: string;
  leftIconStyle?: any;
  borderColor?: string;
  isloading?: boolean;
  titleStyle?: any;
  noPaddingBottom?: boolean;
  textCenter?: boolean;
  secondary?: boolean;
  emptyBtn?: boolean;
  emptyBtnBorderColor?: string;
  noRightIcon?: boolean;
  rightIcon?: React.ReactNode;
}

const AppButton: React.FC<AppButtonProps> = ({
  title,
  onPress,
  titleColor = Colors.WHITE,
  titleFontFamily = Fonts.SEMI_BOLD,
  titleSize = 16,
  bgColor,
  customStyle,
  customContainerStyle,
  disabled = false,
  sticky,
  fill,
  leftIcon,
  iconColor,
  leftIconHeight = 20,
  leftIconWidth = 20,
  borderColor = Colors.BORDER,
  isloading = false,
  titleStyle,
  noPaddingBottom,
  textCenter,
  noRightIcon = false,
  rightIcon,
  ...pressableProps
}) => {
  const insets = useSafeArea() as InsetsProps;

  const buttonBgColor = bgColor ?? (disabled ? Colors.GRAY_1 : undefined);
  const buttonBorderColor = borderColor || Colors.BORDER;

  return (
    <AppColumnView
      flex={fill ? 1 : undefined}
      style={customContainerStyle}
      {...(sticky && {
        position: "absolute",
        bottom: noPaddingBottom ? 0 : insets.bottom,
        left: 0,
        right: 0,
      })}
    >
      <AppPressable
        onPress={onPress}
        disabled={disabled || isloading}
        alignItems="center"
        justifyContent="center"
        borderRadius={8}
        backgroundColor={buttonBgColor}
        borderWidth={borderColor ? RF(1) : 0}
        borderColor={buttonBorderColor}
        paddingVertical={16}
        paddingHorizontal={24}
        flexDirection="row"
        style={customStyle}
        {...pressableProps}
      >
        <AppRowView gap={8} paddingVertical={4} alignItems="center">
          {leftIcon && <>{leftIcon}</>}

          <AppText
            fontFamily={titleFontFamily}
            color={disabled ? Colors.GRAY_3 : titleColor}
            size={titleSize}
            center={textCenter}
            style={titleStyle}
          >
            {title}
          </AppText>
          {isloading && (
            <AppColumnView marginLeft={RF(8)}>
              <CustomActivityIndicator size="small" color={Colors.WHITE} />
            </AppColumnView>
          )}
        </AppRowView>
      </AppPressable>
    </AppColumnView>
  );
};

export default AppButton;
