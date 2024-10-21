import {
  Modal as ModalChakra,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
} from "@chakra-ui/react";
import { ReactNode, useRef } from "react";

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
  title: string;
  actions?: React.ReactNode[];
  state: StatePropType;
  isCentered?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
};

function Modal({
  title,
  children,
  state,
  isCentered,
  closeOnOverlayClick,
  closeOnEsc = false
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
        size="3xl"
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
