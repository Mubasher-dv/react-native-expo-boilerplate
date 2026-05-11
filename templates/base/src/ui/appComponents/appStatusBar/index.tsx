import React from 'react';
import {StatusBar, StatusBarProps} from 'react-native';

const AppStatusBar: React.FC<StatusBarProps> = props => {
  return <StatusBar {...props} />;
};

export default AppStatusBar;
