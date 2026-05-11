import AppColumnView from "@appComponents/appColumnView";
import AppIcon from "@appComponents/appIcon";
import AppPressable from "@appComponents/appPressable";
import AppRowView from "@appComponents/appRowView";
import AppText from "@appComponents/appText";
import { Images } from "@assets";
import AvatarBlock from "@components/avatarBlock";
import IoniconsIcons from "@icons/IoniconsIcons";
import OcticonsIcons from "@icons/octiconsIcons";
import { Colors } from "@theme/colors";
import { Fonts } from "@theme/fonts";
import { useRouter } from "expo-router";
import React from "react";

interface IAppTabHeader {
  title: string;
  subTitle: string;
  onPressDownload?: () => void;
  onFilterPress?: () => void;
  avatarUri: string | null;
  onNotificationPress?: () => void;
  subTitleIcon?: React.ReactNode;
}

const AppTabHeader = (props: IAppTabHeader) => {
  const {
    avatarUri,
    onPressDownload,
    onFilterPress,
    onNotificationPress,
    title,
    subTitle,
    subTitleIcon,
  } = props;
  const router = useRouter();

  return (
    <AppRowView
      justifyContent="space-between"
      alignItems="flex-start"
      marginBottom={12}
    >
      <AppColumnView flex={1} paddingRight={12}>
        <AppText size={16} fontFamily={Fonts.BOLD} color={Colors.BLACK}>
          {title}
        </AppText>
        <AppRowView alignItems="center" gap={6}>
          {subTitleIcon}
          <AppText size={12} fontFamily={Fonts.MEDIUM} color={Colors.GRAY_6}>
            {subTitle}
          </AppText>
        </AppRowView>
      </AppColumnView>

      <AppRowView alignItems="center" gap={12}>
        {onNotificationPress ? (
          <AppPressable onPress={onNotificationPress} hitSlop={10}>
            <AppColumnView>
              <AppIcon path={Images.notification} size={22} />
              <AppColumnView
                position="absolute"
                top={0}
                right={0}
                width={12}
                height={12}
                borderRadius={6}
                backgroundColor={Colors.NOTIFICATION}
              />
            </AppColumnView>
          </AppPressable>
        ) : onFilterPress ? (
          <AppPressable onPress={onFilterPress} hitSlop={10}>
            <AppColumnView
              height={40}
              width={40}
              borderRadius={10}
              backgroundColor={Colors.GRAY_1}
              alignItems="center"
              justifyContent="center"
            >
              <IoniconsIcons
                icon="options-outline"
                color={Colors.GRAY_5}
                size={22}
              />
            </AppColumnView>
          </AppPressable>
        ) : onPressDownload ? (
          <AppPressable
            onPress={onPressDownload}
            hitSlop={10}
            height={44}
            width={44}
            borderRadius={22}
            backgroundColor={Colors.GRAY_1}
            alignItems="center"
            justifyContent="center"
          >
            <OcticonsIcons icon="download" color={Colors.GRAY_5} size={22} />
          </AppPressable>
        ) : null}
        <AvatarBlock
          avatarUri={avatarUri}
          onPressProfile={() => router.push("/(coach)/basic-info")}
        />
      </AppRowView>
    </AppRowView>
  );
};

export default AppTabHeader;
