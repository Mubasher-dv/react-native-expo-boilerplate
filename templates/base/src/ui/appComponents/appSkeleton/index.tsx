import { Colors } from "@theme/colors";
import Skeleton, { ISkeletonProps } from "react-native-reanimated-skeleton";

const AppSkeleton = ({
  boneColor = Colors.GRAY_2,
  highlightColor = Colors.WHITE,
  animationType = "shiver",
  duration = 1000,
  ...props
}: ISkeletonProps) => {
  return (
    <Skeleton
      boneColor={boneColor}
      highlightColor={highlightColor}
      animationType={animationType}
      duration={duration}
      {...props}
    />
  );
};

export default AppSkeleton;
