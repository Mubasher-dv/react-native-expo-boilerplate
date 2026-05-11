import AppText from '@appComponents/appText';
import { Colors } from '@theme/colors';
import { Fonts } from '@theme/fonts';
import React from 'react';
import { TextProps, TextStyle } from 'react-native';
import AppPressable from '../appPressable';

interface Props extends TextProps {
  style: any;
  size: number;
  color?: string;
  capital: boolean;
  children: any;
  fontFamily: string;
  numberOfLines: number;
  linHeight: number;
  italic: boolean;
  onPress?: () => void;
  center: boolean;
  containerStyle?: any;
  disabled?: boolean;
  textAlign?: TextStyle['textAlign'];

  marginText?: number;
  marginTopText?: number;
  marginBottomText?: number;
  marginLeftText?: number;
  marginRightText?: number;
  marginHorizontalText?: number;
  marginVerticalText?: number;
}

const AppTextWrapper = (props: Partial<Props>) => {
  const {
    size = 12,
    color = Colors.PRIMARY,
    style,
    numberOfLines = 0,
    capital = false,
    onPress,
    center,
    italic = false,
    fontFamily = Fonts.REGULAR,
    containerStyle,
    disabled,
    linHeight,
    textAlign,
    marginText,
    marginTopText,
    marginBottomText,
    marginLeftText,
    marginRightText,
    marginHorizontalText,
    marginVerticalText,
  } = props;
  return (
    <AppPressable onPress={onPress} disabled={disabled} style={containerStyle}>
      <AppText
        numberOfLines={numberOfLines}
        allowFontScaling={false}
        fontFamily={fontFamily}
        size={size}
        color={color}
        capital={capital}
        center={center}
        italic={italic}
        lineHeight={linHeight}
        textAlign={textAlign}
        margin={marginText}
        marginTop={marginTopText}
        marginBottom={marginBottomText}
        marginLeft={marginLeftText}
        marginRight={marginRightText}
        marginHorizontal={marginHorizontalText}
        marginVertical={marginVerticalText}
        style={style}
      >
        {props.children}
      </AppText>
    </AppPressable>
  );
};

export default AppTextWrapper;
