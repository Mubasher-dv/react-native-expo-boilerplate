import React from 'react';
import { ColorValue, RefreshControl } from 'react-native';

interface AppRefreshControlProps {
  refreshing: boolean;
  onRefresh: () => void;
  colors?: ColorValue[];
  progressBackgroundColor?: string;
  tintColor?: string;
  progressViewOffset?: number;
  size?: number;
  enabled?: boolean;
}

const AppRefreshControl = ({
  refreshing,
  onRefresh,
  colors,
  progressBackgroundColor,
  tintColor,
  progressViewOffset,
  size,
  enabled,
}: AppRefreshControlProps) => {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={colors}
      progressBackgroundColor={progressBackgroundColor}
      tintColor={tintColor}
      progressViewOffset={progressViewOffset}
      size={size}
      enabled={enabled}
    />
  );
};

export default AppRefreshControl;
