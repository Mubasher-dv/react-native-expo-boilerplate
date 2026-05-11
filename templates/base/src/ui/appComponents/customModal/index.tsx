import React from 'react';
import {Modal, ModalProps} from 'react-native';

export enum ModalAnimationType {
  NONE = 'none',
  SLIDE = 'slide',
  FADE = 'fade',
}

interface CustomModalProps extends Omit<ModalProps, 'animationType'> {
  animationType?: ModalAnimationType;
}

const CustomModal: React.FC<CustomModalProps> = ({
  children,
  animationType = ModalAnimationType.FADE,
  ...rest
}) => {
  return (
    <Modal animationType={animationType} {...rest}>
      {children}
    </Modal>
  );
};

export default CustomModal;
