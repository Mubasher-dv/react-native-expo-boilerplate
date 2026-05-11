// V5 plan dropped MyRoster's `SafeAreaInsetsProvider` (Android-padding tweak)
// from `_layout.tsx` — relying on stock `react-native-safe-area-context` is
// cleaner and avoids a context that was never wrapped around the tree.
//
// `useSafeArea` is preserved as a thin re-export so existing component code
// (AppWrapper, AppButton, etc.) keeps compiling without edits.
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const useSafeArea = useSafeAreaInsets;
