import { BottomSheetModal, BottomSheetModalProps } from "@gorhom/bottom-sheet";
import React, { forwardRef } from "react";

const CustomBottomSheetModal = forwardRef<
  BottomSheetModal,
  BottomSheetModalProps
>(({ children, ...rest }, ref) => {
  return (
    <BottomSheetModal ref={ref} {...rest}>
      {children}
    </BottomSheetModal>
  );
});

CustomBottomSheetModal.displayName = "CustomBottomSheetModal";

export default CustomBottomSheetModal;
