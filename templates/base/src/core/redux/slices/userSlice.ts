// Deviation #5 (docs/MIRROR_NOTES.md): minimal user shape per SPEC §6 ("dummy
// user shape"). Apps replace with their actual auth model.
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type User = {
  id: string | null;
  name: string | null;
};

const initialState: User = { id: null, name: null };

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.id = action.payload.id;
      state.name = action.payload.name;
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      Object.assign(state, action.payload);
    },
    clearUser: (state) => {
      state.id = null;
      state.name = null;
    },
  },
});

export const { setUser, updateUser, clearUser } = userSlice.actions;
export default userSlice.reducer;
