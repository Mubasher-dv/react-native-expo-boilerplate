import { BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import React from "react";

interface IAppButtonSheetBackdrop {
  props: any;
  disappearsOnIndex?: number;
  appearsOnIndex?: number;
  opacity?: number;
}

const AppButtonSheetBackdrop = ({
  props,
  disappearsOnIndex = -1,
  appearsOnIndex = 0,
  opacity = 0.8,
}: IAppButtonSheetBackdrop) => {
  return (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={disappearsOnIndex}
      appearsOnIndex={appearsOnIndex}
      opacity={opacity}
    />
  );
};

export default AppButtonSheetBackdrop;
