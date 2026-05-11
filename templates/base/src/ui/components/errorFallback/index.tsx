import AppColumnView from "@appComponents/appColumnView";
import AppPressable from "@appComponents/appPressable";
import AppText from "@appComponents/appText";
import AppWrapper from "@appComponents/appWrapper";
import { Colors } from "@theme/colors";
import { Fonts } from "@theme/fonts";
import { FallbackProps } from "react-error-boundary";

const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => (
  <AppWrapper bgColor={Colors.BG_COLOR}>
    <AppColumnView
      flex={1}
      alignItems="center"
      justifyContent="center"
      paddingHorizontal={24}
      gap={12}
    >
      <AppText size={18} fontFamily={Fonts.SEMI_BOLD} color={Colors.GRAY_5} center>
        Something went wrong
      </AppText>
      <AppText size={13} fontFamily={Fonts.REGULAR} color={Colors.GRAY_4} center>
        {error instanceof Error ? error.message : String(error)}
      </AppText>
      <AppPressable
        marginTop={8}
        paddingHorizontal={20}
        paddingVertical={12}
        borderRadius={12}
        backgroundColor={Colors.PRIMARY}
        onPress={resetErrorBoundary}
      >
        <AppText size={14} fontFamily={Fonts.SEMI_BOLD} color={Colors.WHITE}>
          Try Again
        </AppText>
      </AppPressable>
    </AppColumnView>
  </AppWrapper>
);

export default ErrorFallback;
