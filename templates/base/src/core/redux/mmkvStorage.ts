// react-native-mmkv 3.x+ exports `MMKV` as a class (was `createMMKV()` factory
// in older versions). MyRoster's source predates the API change.
import { MMKV } from "react-native-mmkv";

const storage = new MMKV();

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
    storage.delete(key);
    return Promise.resolve();
  },
};
