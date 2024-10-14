import { useState, useEffect } from "react";
import {
  useColorMode,
  Flex,
  Icon,
  Spacer,
  Box,
  Heading,
  UnorderedList,
  Button,
  Divider,
  useDisclosure,
  Tooltip,
  Image,
  HStack,
  Stack,
  ListItem,
  Tag,
  Skeleton,
  TagLeftIcon,
  TagLabel,
} from "@chakra-ui/react";
import { CiAt } from "react-icons/ci";
import { VscSymbolParameter } from "react-icons/vsc";
import { MoonIcon, SunIcon } from "@chakra-ui/icons";
import { FaHeart } from "react-icons/fa";
import Modal from "../Modal";
import icon from "../../assets/tl.webp";
import api from "../../services/axiosInstance";
import { CommandType, CommandOptions } from "../../types/CommandType";
import { TiSortNumerically } from "react-icons/ti";

function Navbar() {
  const { colorMode, toggleColorMode } = useColorMode();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [commands, setCommands] = useState<CommandType[] | null>(null);

  // Get the commands
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get<CommandType[]>("/commands");
        setCommands(response.data);
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error("Error fetching data:", error.message);
        } else {
          console.error("Unknown error", error);
        }
      }
    };
    fetchData();
  }, []);

  /**
   * Gets the icon for the command parameter
   *
   * @param commandOption Command option
   * @returns Icon based on the command option
   */
  function getParameterIcon(commandOption: CommandOptions) {
    return commandOption.type === 6
      ? CiAt
      : commandOption.type === 4
      ? TiSortNumerically
      : VscSymbolParameter;
  }

  return (
    <>
      <Flex
        minWidth="100%"
        alignItems="center"
        gap="2"
        p="5"
        direction={["row", "column"]}
      >
        <Flex minWidth="100%" alignItems="center" direction={["column", "row"]}>
          <Box>
            <HStack spacing="5px">
              <Image
                boxSize="30px"
                objectFit="cover"
                src={icon}
                alt="Throne & Liberty Logo"
              />
              <Tooltip
                hasArrow
                label="Throne & Liberty Dragon Kill Points"
                colorScheme="gray.600"
                placement="auto-start"
              >
                <Heading size="lg">TLDKP</Heading>
              </Tooltip>
            </HStack>
            <Spacer />
          </Box>
          <Spacer />
          <Stack direction={["column", "row"]} alignItems="center" gap="5">
            <Button colorScheme="teal" onClick={() => onOpen()}>
              Commands
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
            <Button leftIcon={<FaHeart />} colorScheme="gray" variant="outline">
              Sponsor
            </Button>
            <Icon
              _hover={{ cursor: "pointer", opacity: 0.7 }}
              as={colorMode === "light" ? MoonIcon : SunIcon}
              w={5}
              h={5}
              color="white"
              onClick={toggleColorMode}
            />
          </Stack>
        </Flex>
        <Divider p="2" />

        <Modal
          title="Usage and commands"
          state={{ isOpen, onClose }}
          isCentered={true}
          closeOnOverlayClick={true}
        >
          {commands ? (
            <UnorderedList spacing={3}>
              {commands?.map((command: CommandType) => {
                const commandOptions = command.options;
                return (
                  <ListItem>
                    <Tag marginRight="2">/{command.name}</Tag>
                    {commandOptions &&
                      commandOptions.map(
                        (commandOption: CommandOptions, index: number) => {
                          return (
                            <Tooltip
                              label={commandOption.description}
                              hasArrow
                              arrowSize={15}
                            >
                              <Tag
                                key={index}
                                marginRight="2"
                                variant="subtle"
                                colorScheme="gray.400"
                                _hover={{ cursor: "help" }}
                              >
                                <TagLeftIcon
                                  boxSize={
                                    commandOption.type === 6 ? "15px" : "20px"
                                  }
                                  as={getParameterIcon(commandOption)}
                                />
                                <TagLabel>{commandOption.name}</TagLabel>
                              </Tag>
                            </Tooltip>
                          );
                        }
                      )}
                    {command.description}
                  </ListItem>
                );
              })}
            </UnorderedList>
          ) : (
            <>
              <Stack>
                <Skeleton height="15px" />
                <Skeleton height="15px" />
                <Skeleton height="15px" />
                <Skeleton height="15px" />
              </Stack>
            </>
          )}
        </Modal>
      </Flex>
    </>
  );
}

export default Navbar;
