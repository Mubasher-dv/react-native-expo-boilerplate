// react-native-mmkv 4.x exports `createMMKV()` factory + `MMKV` as a TYPE only.
// (Earlier 3.x exported `MMKV` as a class; the API was reverted in 4.x.)
import { createMMKV } from "react-native-mmkv";

const storage = createMMKV();

export const reduxStorage = {
  setItem: (key: string, value: string) => {
    storage.set(key, value);
    return Promise.resolve(true);
  },
  getItem: (key: string) => {
    const value = storage.getString(key);
    return Promise.resolve(value);
  },
  removeItem: (key: string) => {
    storage.remove(key);
    return Promise.resolve();
  },
};
