// Deviation #3 (docs/MIRROR_NOTES.md): Reactotron import stripped.
// MyRoster's appLogger imported `../../../../ReactotronConfig` from project root —
// app-specific dev tooling. Generated apps add Reactotron back per their own setup.
//
// Default transport is the built-in console transport from react-native-logs.
import { consoleTransport, logger } from "react-native-logs";

const config = {
  transport: consoleTransport,
  severity: __DEV__ ? "debug" : "error",
  transportOptions: {
    colors: {
      info: "blueBright" as const,
      warn: "yellowBright" as const,
      error: "redBright" as const,
    },
  },
};

const log = logger.createLogger(config);

export default log;
