import AppText from "@appComponents/appText";
import AppWrapper from "@appComponents/appWrapper";
import { Colors } from "@theme/colors";

export default function Home() {
  return (
    <AppWrapper>
      <AppText size={20} color={Colors.BLACK}>
        Hello from @codingpixel/create-expo-app 👋
      </AppText>
    </AppWrapper>
  );
}
