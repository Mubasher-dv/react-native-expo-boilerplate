import {
  SCROLLABLE_TYPE,
  createBottomSheetScrollableComponent,
  type BottomSheetScrollViewMethods,
} from '@gorhom/bottom-sheet';
import type { BottomSheetScrollViewProps } from '@gorhom/bottom-sheet/src/components/bottomSheetScrollable/types';
import React, { memo } from 'react';
import { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewProps,
} from 'react-native-keyboard-controller';
import Reanimated from 'react-native-reanimated';

const toDim = (v?: number | DimensionValue) =>
  v === undefined
    ? undefined
    : typeof v === 'number'
    ? (v as DimensionValue)
    : v;

type ExtraStyleProps = {
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
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
  paddingHorizontal?: number;
  paddingVertical?: number;
  gap?: number;
  flex?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | DimensionValue;
  flexWrap?: 'wrap' | 'nowrap';
  width?: number | DimensionValue;
  height?: number | DimensionValue;
  minHeight?: number | DimensionValue;
  maxHeight?: number | DimensionValue;
  minWidth?: number | DimensionValue;
  maxWidth?: number | DimensionValue;
};

type CombinedProps = BottomSheetScrollViewProps &
  KeyboardAwareScrollViewProps &
  ExtraStyleProps;

const AnimatedScrollView =
  Reanimated.createAnimatedComponent<KeyboardAwareScrollViewProps>(
    KeyboardAwareScrollView,
  );

const BottomSheetScrollViewComponent = createBottomSheetScrollableComponent<
  BottomSheetScrollViewMethods,
  BottomSheetScrollViewProps
>(SCROLLABLE_TYPE.SCROLLVIEW, AnimatedScrollView);

const BottomSheetKeyboardAwareScrollView = memo(
  ({ style, contentContainerStyle, ...rest }: CombinedProps) => {
    const resolvedStyle: ViewStyle = {
      margin: rest.margin,
      marginTop: rest.marginTop,
      marginBottom: rest.marginBottom,
      marginLeft: rest.marginLeft,
      marginRight: rest.marginRight,
      marginHorizontal: rest.marginHorizontal,
      marginVertical: rest.marginVertical,
      padding: rest.padding,
      paddingTop: rest.paddingTop,
      paddingBottom: rest.paddingBottom,
      paddingLeft: rest.paddingLeft,
      paddingRight: rest.paddingRight,
      paddingHorizontal: rest.paddingHorizontal,
      paddingVertical: rest.paddingVertical,
      gap: rest.gap,
      flex: rest.flex,
      flexGrow: rest.flexGrow,
      flexShrink: rest.flexShrink,
      flexBasis: toDim(rest.flexBasis),
      flexWrap: rest.flexWrap,
      width: toDim(rest.width),
      height: toDim(rest.height),
      minHeight: toDim(rest.minHeight),
      maxHeight: toDim(rest.maxHeight),
      minWidth: toDim(rest.minWidth),
      maxWidth: toDim(rest.maxWidth),
    };

    return (
      <BottomSheetScrollViewComponent
        {...rest}
        style={style}
        contentContainerStyle={[resolvedStyle, contentContainerStyle]}
      />
    );
  },
);

BottomSheetKeyboardAwareScrollView.displayName =
  'BottomSheetKeyboardAwareScrollView';

export default BottomSheetKeyboardAwareScrollView;
