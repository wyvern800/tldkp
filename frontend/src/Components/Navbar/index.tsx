import {
  useColorMode,
  Flex,
  Icon,
  Spacer,
  Box,
  Heading,
  ButtonGroup,
  Button,
  Divider,
  useDisclosure,
} from "@chakra-ui/react";

import { MoonIcon, SunIcon } from "@chakra-ui/icons";
import { FaHeart } from "react-icons/fa";
import Modal from "../Modal";

function Navbar() {
  const { colorMode, toggleColorMode } = useColorMode();
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <>
      <Flex minWidth="100%" alignItems="center" gap="2" p="5" flexDir="column">
        <Flex minWidth="100%" alignItems="center">
          <Box>
            <Heading size="lg">TLDKP</Heading>
            <Spacer />
          </Box>
          <Spacer />
          <ButtonGroup gap="2">
            <Icon
              style={{ cursor: "pointer" }}
              as={colorMode === "light" ? MoonIcon : SunIcon}
              w={8}
              h={8}
              color="white"
              onClick={toggleColorMode}
            />
            <Button colorScheme="teal" onClick={() => onOpen()}>
              Guide
            </Button>
            <Button
              colorScheme="teal"
              onClick={() => {
                window.open(
                  "https://discord.com/oauth2/authorize?client_id=1294518658944598067",
                  "_blank"
                );
              }}
            >
              Add to my server
            </Button>
            <Button leftIcon={<FaHeart />} colorScheme="gray">
              Sponsor
            </Button>
          </ButtonGroup>
        </Flex>
        <Divider p="2" />

        <Modal
          title="Usage"
          state={{ isOpen, onClose }}
          isCentered={true}
          closeOnOverlayClick={true}
        >
          j
        </Modal>
      </Flex>
    </>
  );
}

export default Navbar;
