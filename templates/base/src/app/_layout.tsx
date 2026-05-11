// Provider tree per PLAN_V5.md Phase 4 step 2. Sentinels are filled by Phase 6
// `patchLayout` based on the user's `useFonts` / `bottomSheet` answers.
import { ErrorBoundary } from "react-error-boundary";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { TanStackQueryProvider } from "@core/tanstack";
import { persistor, store } from "@redux/store";
import ErrorFallback from "@components/errorFallback";
import Routes from "./routes";
// @@USE_FONTS_IMPORT@@
// @@BOTTOM_SHEET_PROVIDER_IMPORT@@

export default function RootLayout() {
  // @@USE_FONTS_HOOK@@
  // @@USE_FONTS_GUARD@@

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <TanStackQueryProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
              <KeyboardProvider>
                {/* @@BOTTOM_SHEET_PROVIDER_OPEN@@ */}
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  <Routes />
                </ErrorBoundary>
                {/* @@BOTTOM_SHEET_PROVIDER_CLOSE@@ */}
              </KeyboardProvider>
            </SafeAreaProvider>
          </GestureHandlerRootView>
        </TanStackQueryProvider>
      </PersistGate>
    </Provider>
  );
}
