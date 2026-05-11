import { RF } from "@theme/responsive";
import { Image, ImageContentFit, ImageLoadEventData } from "expo-image";
import React, { useState } from "react";
import {
  ActivityIndicator,
  DimensionValue,
  ImageStyle,
  StyleProp,
  ViewStyle,
} from "react-native";
import AppColumnView from "../appColumnView";
import AppPressable from "../appPressable";

const IMAGE_FILL_STYLE = { width: "100%" as const, height: "100%" as const };

interface AppIconProps extends Omit<
  Partial<React.ComponentProps<typeof AppPressable>>,
  "path"
> {
  path?: string | number;
  uri?: string;
  resizeMode?: ImageContentFit;
  customStyle?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  tintColor?: string;
  loader?: React.ReactNode;
  activityIndicatorColor?: string;
  width?: number | DimensionValue;
  height?: number | DimensionValue;
  size?: number;
  borderRadius?: number;
  onLoad?: (e: ImageLoadEventData) => void;
}

const AppIcon: React.FC<AppIconProps> = ({
  path,
  uri,
  resizeMode = "cover",
  customStyle,
  containerStyle,
  tintColor,
  loader,
  activityIndicatorColor = "#999",
  width = 24,
  height = 24,
  size,
  borderRadius,
  onPress,
  onLoad,
  ...pressableProps
}) => {
  const toDim = (v?: number | DimensionValue) =>
    v === undefined
      ? undefined
      : typeof v === "number"
        ? (RF(v) as unknown as DimensionValue)
        : v;
  const [loading, setLoading] = useState<boolean>(false);
  const source = uri ? { uri } : path;

  return (
    <AppPressable
      disabled={!onPress}
      onPress={onPress}
      width={size ? RF(size) : toDim(width)}
      height={size ? RF(size) : toDim(height)}
      borderRadius={
        size ? RF(size / 2) : borderRadius ? RF(borderRadius) : undefined
      }
      style={containerStyle}
      overflow="hidden"
      {...pressableProps}
    >
      <Image
        source={source}
        contentFit={resizeMode}
        style={[IMAGE_FILL_STYLE, customStyle]}
        tintColor={tintColor}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onLoad={onLoad}
      />

      {loading && (
        <AppColumnView
          position="absolute"
          top={0}
          left={0}
          width="100%"
          height="100%"
          justifyContent="center"
          alignItems="center"
        >
          {loader ? (
            loader
          ) : (
            <ActivityIndicator size="small" color={activityIndicatorColor} />
          )}
        </AppColumnView>
      )}
    </AppPressable>
  );
};

export default AppIcon;
