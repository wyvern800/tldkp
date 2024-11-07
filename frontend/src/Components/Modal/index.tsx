import {
  Modal as ModalChakra,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
} from "@chakra-ui/react";
import React, { ReactNode, useRef } from "react";

type StatePropType = {
  isOpen: boolean;
  onClose: () => void;
};

type ModalPropTypes = {
  children?:
    | JSX.Element[]
    | JSX.Element
    | React.ReactElement
    | React.ReactElement[]
    | string;
  title: string | React.ReactNode;
  actions?: React.ReactNode[];
  state: StatePropType;
  isCentered?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  size?:
    | "xs"
    | "sm"
    | "md"
    | "lg"
    | "xl"
    | "full"
    | "3xl"
    | "4xl"
    | "5xl"
    | "6xl"
    | "7xl"
    | "8xl"
    | "9xl"
    | "10xl";
};

function Modal({
  title,
  children,
  state,
  isCentered,
  closeOnOverlayClick,
  closeOnEsc = false,
  size,
}: ModalPropTypes): ReactNode {
  const { isOpen, onClose } = state ?? {};

  const initialRef = useRef(null);
  const finalRef = useRef(null);

  return (
    <>
      <ModalChakra
        initialFocusRef={initialRef}
        finalFocusRef={finalRef}
        isOpen={isOpen}
        closeOnOverlayClick={closeOnOverlayClick}
        onClose={onClose}
        isCentered={isCentered}
        size={size}
        closeOnEsc={closeOnEsc}
      >
        <ModalOverlay
          bg="blackAlpha.300"
          backdropFilter="blur(10px) hue-rotate(90deg)"
        />
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{title}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>{children}</ModalBody>
          <ModalFooter></ModalFooter>
        </ModalContent>
      </ModalChakra>
    </>
  );
}

export default Modal;
