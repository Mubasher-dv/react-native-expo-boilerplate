// Asset registry shim. Apps add real exports as they bundle .png / .ttf etc.
// Example:
//   import notification from "./images/notification.png";
//   export const Images = { notification };
//
// `@assets` resolves here via tsconfig path mapping.
export const Images = {} as Record<string, number>;
export {};
