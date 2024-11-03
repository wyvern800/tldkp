/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  Flex,
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
  Badge,
} from "@chakra-ui/react";
import { CiAt } from "react-icons/ci";
import { VscSymbolParameter } from "react-icons/vsc";
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
import { BsFillMegaphoneFill } from "react-icons/bs";
import { changelog } from "../../constants/changelog";

function Navbar() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isNewModalOpen,
    onOpen: onNewModalOpen,
    onClose: onNewModalClose,
  } = useDisclosure();

  const [commands, setCommands] = useState<CommandType[] | null>(null);
  const [categories, setCategories] = useState<string[] | null>(null);

  // Get the commands
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get("/commands");
        const commandCategories = new Set<string>();
        response?.data?.data?.forEach((command: CommandType) => {
          commandCategories.add(command.commandCategory);
        });
        setCommands(response?.data?.data);
        setCategories(Array.from(commandCategories));
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

  const Commands = ({
    commandsData,
    category,
  }: {
    commandsData: CommandType[];
    category: string;
  }) => {
    return (
      <>
        <Heading>{category}</Heading>
        {commandsData
          ?.filter((command) => command.commandCategory === category)
          .map((command: CommandType, index) => {
            const commandOptions = command.options;
            return (
              <ListItem key={`${command.name}${index}`}>
                {command.new && (
                  <Tag colorScheme="green" marginRight="5px" variant="outline">
                    NEW!
                  </Tag>
                )}
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
      </>
    );
  };

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
                  <Heading size="lg" textShadow={"2px 2px #0000008a"}>
                    TLDKP
                  </Heading>
                </Link>
              </Tooltip>
            </HStack>
            <Spacer />
          </Box>
          <Spacer />
          <Stack direction={["column", "row"]} alignItems="center" gap="5">
            <Button
              leftIcon={<BsFillMegaphoneFill />}
              colorScheme="teal"
              onClick={() => onNewModalOpen()}
            >
              Whats new?
            </Button>
            <SignedOut>
              <Link to="/sign-in">
                <Button leftIcon={<FaDiscord />} colorScheme="teal">
                  Login with Discord
                  <Badge ml="3" colorScheme="black">
                    New
                  </Badge>
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
                window.open(import.meta.env.VITE_BOT_INSTALL, "_blank");
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
          {commands && categories ? (
            <UnorderedList spacing={3}>
              {categories.map((category: string) => (
                <Commands commandsData={commands} category={category} />
              ))}
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

        <Modal
          title="What's new?"
          state={{ isOpen: isNewModalOpen, onClose: onNewModalClose }}
          isCentered={true}
          closeOnOverlayClick={true}
        >
          <UnorderedList spacing={3}>  
            {changelog.map((changelog: any, index) => (
              <ListItem key={index}>
                <span style={{ textDecoration: 'underline'}}>{changelog.date}:</span>
                <UnorderedList>
                  {changelog?.changes?.map((change: any) => {
                    return (
                      <ListItem key={`${change}${index}`}>
                        {change}.
                        <br />
                      </ListItem>
                    );
                  })}
                </UnorderedList>
              </ListItem>
            ))}
          </UnorderedList>
        </Modal>
      </Flex>
    </>
  );
}

export default Navbar;
