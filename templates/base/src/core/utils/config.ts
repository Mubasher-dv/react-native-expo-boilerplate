import { clearUser } from "@redux/slices/userSlice";
import { store } from "@redux/store";
import axios, { AxiosInstance } from "axios";
import { Keyboard } from "react-native";
import { BASE_URL } from "./endpoints";

const HTTP_CLIENT: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 12000,
});

const initialConfig = () => {
  setupAxios();
};

const setupAxios = () => {
  HTTP_CLIENT.interceptors.request.use(
    async (config: any) => {
      Keyboard.dismiss();

      const token = store.getState().user?.accessToken;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (err: any) => {
      console.log("error in api: ", err);

      Promise.reject(err);
    },
  );

  HTTP_CLIENT.interceptors.response.use(
    (response) => {
      return response;
    },
    (err) => {
      console.log("err in response", err, err?.message);

      if (err?.response?.status == 401 || err?.status == 401) {
        store.dispatch(clearUser());
      }

      return Promise.reject(err?.response?.data || err);
    },
  );
};

export { HTTP_CLIENT, initialConfig, setupAxios };
