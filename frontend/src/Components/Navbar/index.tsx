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
import Modal from "../Modal";
import icon from "../../assets/tl.webp";
import api from "../../services/axiosInstance";
import { CommandType, CommandOptions } from "../../types/CommandType";
import { TiSortNumerically } from "react-icons/ti";
import { MdDashboard } from "react-icons/md";
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { FaDiscord } from "react-icons/fa";
import { RiSlashCommands } from "react-icons/ri";
import { IoAddOutline } from "react-icons/io5";

function Navbar() {
  const { colorMode, toggleColorMode } = useColorMode();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [commands, setCommands] = useState<CommandType[] | null>(null);

  // Get the commands
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get("/commands");
        setCommands(response?.data?.data);
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
        <Flex
          minWidth="100%"
          alignItems="center"
          justifyContent="center"
          direction={["column", "row"]}
        >
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
                <Link to="/">
                  <Heading size="lg" textShadow={"2px 2px #0000008a"}>TLDKP</Heading>
                </Link>
              </Tooltip>
            </HStack>
            <Spacer />
          </Box>
          <Spacer />
          <Stack direction={["column", "row"]} alignItems="center" gap="5">
            <SignedOut>
              <Link to="/sign-in">
                <Button leftIcon={<FaDiscord />} colorScheme="teal">
                  Login with Discord
                </Button>
              </Link>
            </SignedOut>
            <Button
              leftIcon={<RiSlashCommands />}
              colorScheme="teal"
              onClick={() => onOpen()}
            >
              Commands
            </Button>

            <Button
              leftIcon={<IoAddOutline />}
              colorScheme="teal"
              onClick={() => {
                window.open(
                  import.meta.env.VITE_BOT_INSTALL,
                  "_blank"
                );
              }}
            >
              Add to my server
            </Button>

            {/*<Icon
              _hover={{ cursor: "pointer", opacity: 0.7 }}
              as={colorMode === "light" ? MoonIcon : SunIcon}
              w={5}
              h={5}
              color="white"
              onClick={toggleColorMode}
            />*/}
            <SignedIn>
              <UserButton>
                <UserButton.MenuItems>
                  <UserButton.Link
                    label="Dashboard"
                    labelIcon={<MdDashboard />}
                    href="/dashboard"
                  />
                </UserButton.MenuItems>
              </UserButton>
            </SignedIn>
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
              {commands?.map((command: CommandType, index) => {
                const commandOptions = command.options;
                return (
                  <ListItem key={`${command.name}${index}`}>
                    <Tag marginRight="2">/{command.name}</Tag>
                    {commandOptions &&
                      commandOptions.map(
                        (commandOption: CommandOptions, index: number) => {
                          return (
                            <Tooltip
                              key={`${commandOption.name}${index}`}
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
