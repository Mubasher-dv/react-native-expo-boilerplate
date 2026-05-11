import { combineReducers } from "@reduxjs/toolkit";
import { persistReducer } from "redux-persist";

import { reduxStorage } from "./mmkvStorage";
import userReducer from "./slices/userSlice";

export const rootReducer = combineReducers({
  user: userReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

const persistConfig = {
  key: "root",
  version: 1,
  storage: reduxStorage,
  whitelist: ["user"],
};

export const persistedReducer = persistReducer(persistConfig, rootReducer);
