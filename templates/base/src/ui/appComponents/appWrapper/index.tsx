import AppStatusBar from "@appComponents/appStatusBar";
import BackgroundGradient from "@components/backgroundGradient";
import { Colors } from "@theme/colors";
import React from "react";
import AppColumnView from "../appColumnView";
import { useSafeArea } from "../appSafeAreaInsets";

interface Props {
  children: any;
  noPaddingTop: any;
  noPaddingBottom: any;
  bgColor?: string;
  barStyle: "dark-content" | "default" | "light-content";
  tabBarHeight?: number;
  statusBarColor?: string;
}

const AppWrapper = ({
  barStyle = "dark-content",
  children,
  noPaddingTop,
  noPaddingBottom,
  bgColor = Colors.WHITE,
  tabBarHeight,
  statusBarColor = "white",
}: Partial<Props>) => {
  const insets: any = useSafeArea();

  const paddingTop = noPaddingTop ? 0 : insets.top;
  const paddingBottom = tabBarHeight
    ? tabBarHeight
    : noPaddingBottom
      ? 0
      : insets.bottom;

  return (
    <>
      <AppStatusBar
        barStyle={barStyle}
        translucent={true} // safer default on Android
        backgroundColor={statusBarColor}
      />
      <AppColumnView
        flex={1}
        paddingBottom={paddingBottom}
        paddingTop={paddingTop}
        backgroundColor={bgColor}
      >
        <BackgroundGradient />
        {children}
      </AppColumnView>
    </>
  );
};

export default AppWrapper;
