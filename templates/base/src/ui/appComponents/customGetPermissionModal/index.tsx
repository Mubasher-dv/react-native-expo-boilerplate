import AppButton from "@appComponents/appButton";
import AppColumnView from "@appComponents/appColumnView";
import AppText from "@appComponents/appText";
import CustomModal, { ModalAnimationType } from "@appComponents/customModal";
import { Colors } from "@theme/colors";
import { Fonts } from "@theme/fonts";
import React from "react";

const CustomGetPermissionModal = ({ visible, onClose, message }: any) => {
  return (
    <CustomModal
      visible={visible}
      transparent
      animationType={ModalAnimationType.FADE}
    >
      <AppColumnView
        flex={1}
        backgroundColor={"rgba(0,0,0,0.5)"}
        justifyContent="center"
        alignItems="center"
      >
        <AppColumnView
          backgroundColor={Colors.WHITE}
          borderRadius={16}
          padding={24}
          width={"80%"}
          shadowColor="#000"
          shadowOpacity={0.25}
          shadowOffset={{ width: 0, height: 2 }}
          elevation={5}
          gap={24}
        >
          <AppColumnView gap={16} alignItems="center">
            <AppText fontFamily={Fonts.BOLD} size={18} color={Colors.PRIMARY}>
              Permission Required
            </AppText>
            <AppText
              size={16}
              color={Colors.GRAY_4}
              textAlign="center"
              lineHeight={20}
            >
              {message}
            </AppText>
          </AppColumnView>

          <AppButton
            title="Cancel"
            onPress={onClose}
            bgColor={Colors.PRIMARY}
            titleColor={Colors.WHITE}
            padding={12}
            titleSize={12}
            noRightIcon={true}
          />
        </AppColumnView>
      </AppColumnView>
    </CustomModal>
  );
};

export default CustomGetPermissionModal;
