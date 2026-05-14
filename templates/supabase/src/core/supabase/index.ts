import { createClient } from "@supabase/supabase-js";
import { createMMKV } from "react-native-mmkv";

const storage = createMMKV({ id: "supabase-auth" });

const mmkvStorageAdapter = {
  setItem: (key: string, value: string) => storage.set(key, value),
  getItem: (key: string) => storage.getString(key) ?? null,
  removeItem: (key: string) => { storage.remove(key); },
};

const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: mmkvStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
