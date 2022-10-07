import React, { useEffect } from 'react';

import { useSafeLayoutEffect } from '../../../../shared/hooks';
import { useAppearance } from '../../context/appearance';
import { usePopover, useScrollLock } from '../../hooks';
import { BasicPortal } from '../../portal';
import { ModalBackdrop } from './backdrop';
import { ModalContent } from './modal-content';

type ModalProps = React.PropsWithChildren<{
  handleOpen?: () => void;
  handleClose?: () => void;
}>;

export const Modal = (props: ModalProps) => {
  const { handleClose, handleOpen } = props;
  const { floating, isOpen } = usePopover({
    defaultOpen: true,
    autoUpdate: false,
  });

  const { disableScroll, enableScroll } = useScrollLock(document.body);

  const appearance = useAppearance();

  React.useEffect(() => {
    if (!isOpen) {
      handleClose?.();
    } else {
      handleOpen?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useSafeLayoutEffect(() => {
    disableScroll();
    return () => enableScroll();
  });

  if (!isOpen) {
    return null;
  }

  return (
    <BasicPortal>
      <ModalBackdrop
        aria-hidden
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <ModalContent ref={floating} modalStyles={appearance.modalStyle}>
          {props.children}
        </ModalContent>
      </ModalBackdrop>
    </BasicPortal>
  );
};
