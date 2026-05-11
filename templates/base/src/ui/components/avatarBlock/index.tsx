import AppColumnView from "@appComponents/appColumnView";
import AppIcon from "@appComponents/appIcon";
import AppPressable from "@appComponents/appPressable";
import IoniconsIcons from "@icons/IoniconsIcons";
import { Colors } from "@theme/colors";
import React from "react";

type AvatarBlockProps = {
  avatarUri: string | null;
  onPressProfile?: () => void;
};

const AvatarBlock = ({ avatarUri, onPressProfile }: AvatarBlockProps) => {
  if (avatarUri) {
    return (
      <AppIcon
        uri={avatarUri}
        width={44}
        height={44}
        borderRadius={22}
        resizeMode="cover"
        onPress={onPressProfile}
      />
    );
  }
  return (
    <AppPressable onPress={onPressProfile}>
      <AppColumnView
        height={44}
        width={44}
        borderRadius={22}
        backgroundColor={Colors.PRIMARY_7}
        alignItems="center"
        justifyContent="center"
      >
        <IoniconsIcons icon="person" color={Colors.PRIMARY} size={22} />
      </AppColumnView>
    </AppPressable>
  );
};

export default AvatarBlock;
