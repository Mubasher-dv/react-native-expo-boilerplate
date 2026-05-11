import { RF } from '@theme/responsive';
import { ANDROID } from '@utils/constants';
import React, { createContext, useContext } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SafeAreaInsetsContext = createContext({});

export const SafeAreaInsetsProvider = ({ children }: any) => {
  let insets = useSafeAreaInsets();
  let customInsets = { ...insets };
  if (ANDROID) {
    customInsets = { ...insets, bottom: insets?.bottom + RF(12) };
  }

  return (
    <SafeAreaInsetsContext.Provider value={customInsets}>
      {children}
    </SafeAreaInsetsContext.Provider>
  );
};

export const useSafeArea = () => {
  return useContext(SafeAreaInsetsContext);
};
