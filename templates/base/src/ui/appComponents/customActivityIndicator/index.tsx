import {RF} from '@theme/responsive';
import React from 'react';
import {ActivityIndicator, ActivityIndicatorProps} from 'react-native';

interface CustomActivityIndicatorProps extends ActivityIndicatorProps {
  size?: 'small' | 'large' | number;
  color?: string;
  width?: number;
  height?: number;
}

const CustomActivityIndicator: React.FC<CustomActivityIndicatorProps> = ({
  size = 'small',
  color = '#000',
  width,
  height,
  ...rest
}) => {
  const indicatorStyle = {
    width: width ? RF(width) : undefined,
    height: height ? RF(height) : undefined,
  };

  return (
    <ActivityIndicator
      size={size}
      color={color}
      style={indicatorStyle}
      {...rest}
    />
  );
};

export default CustomActivityIndicator;
