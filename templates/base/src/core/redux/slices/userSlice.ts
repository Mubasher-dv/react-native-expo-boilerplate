// Minimal user shape per SPEC §6 ("dummy user shape").
// `accessToken` is required by the axios interceptor in `core/utils/config.ts`
// — every request reads `store.getState().user?.accessToken` and attaches as
// `Bearer <token>` if present. Apps replace shape but must keep the field.
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type User = {
  id: string | null;
  name: string | null;
  accessToken: string | null;
};

const initialState: User = { id: null, name: null, accessToken: null };

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.id = action.payload.id;
      state.name = action.payload.name;
      state.accessToken = action.payload.accessToken;
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      Object.assign(state, action.payload);
    },
    setAccessToken: (state, action: PayloadAction<string | null>) => {
      state.accessToken = action.payload;
    },
    clearUser: (state) => {
      state.id = null;
      state.name = null;
      state.accessToken = null;
    },
  },
});

export const { setUser, updateUser, setAccessToken, clearUser } = userSlice.actions;
export default userSlice.reducer;
