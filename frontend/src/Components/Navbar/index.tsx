/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Flex,
  Box,
  Heading,
  UnorderedList,
  useDisclosure,
  Tooltip,
  Image,
  HStack,
  VStack,
  Stack,
  ListItem,
  Tag,
  Skeleton,
  TagLeftIcon,
  TagLabel,
  Badge,
  Text,
  Icon,
  useColorModeValue,
  Container,
  IconButton,
  useBreakpointValue,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  Portal
} from "@chakra-ui/react";
import { 
  MagicCard, 
  MagicFloat, 
  MagicShimmer, 
  MagicReveal,
  MagicPulse,
  MagicStagger
} from "../../lib/magic-ui";
import { CiAt } from "react-icons/ci";
import { VscSymbolParameter } from "react-icons/vsc";
import Modal from "../Modal";
import icon from "../../assets/tl.webp";
import api from "../../services/axiosInstance";
import { CommandType, CommandOptions } from "../../types/CommandType";
import { TiSortNumerically } from "react-icons/ti";
import { MdDashboard, MdSubdirectoryArrowRight, MdDehaze } from "react-icons/md";
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { FaDiscord } from "react-icons/fa";
import { RiSlashCommands } from "react-icons/ri";
import { IoAddOutline } from "react-icons/io5";
import { BsFillMegaphoneFill } from "react-icons/bs";
import { changelog } from "../../constants/changelog";
import { SiMaterialdesignicons } from "react-icons/si";

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
        <UnorderedList spacing="3">
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
                {command?.permissions?.length && (
                  <>
                    <HStack alignItems={"center"} mt="2">
                      <Heading as='h6' size='xs' colorScheme="white" fontSize="xs">
                        <Icon as={MdSubdirectoryArrowRight} /> Required Permissions:
                      </Heading>
                      {command?.permissions?.map(
                        (permission: string, index: number) => (
                          <Text
                            key={`${permission}${index}`}
                            colorScheme="white"
                            fontSize="xs"
                          >
                            {permission}{index !== (command?.permissions?.length ?? 0) - 1 ? ', ' : ''}
                          </Text>
                        )
                      )}
                    </HStack>
                  </>
                )}
              </ListItem>
            );
          })}
        </UnorderedList>
      </>
    );
  };

  const navBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const isMobile = useBreakpointValue({ base: true, md: false });

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <Box
        bg={navBg}
        borderBottom="1px"
        borderColor={borderColor}
        shadow="sm"
        position="sticky"
        top={0}
        zIndex={99999}
        backdropFilter="blur(10px)"
        bgGradient={useColorModeValue(
          "linear(to-r, white, gray.50)",
          "linear(to-r, gray.800, gray.900)"
        )}
      >
        <Container maxW="container.xl" px={4}>
          <Flex
            minH="70px"
            alignItems="center"
            justifyContent="space-between"
            py={4}
          >
            {/* Magic Logo Section */}
            <MagicReveal direction="left" delay={0.2}>
              <Link to="/">
                <MagicFloat intensity={2} speed={5}>
                  <HStack spacing={3} cursor="pointer">
                    <MagicPulse intensity={0.3} speed={4} color="rgba(14, 165, 233, 0.3)">
                      <Box
                        border="2px solid"
                        borderColor="gray.200"
                        borderRadius="xl"
                      >
                        <Box
                          p={3}
                          borderRadius="lg"
                          bgGradient="linear(135deg, teal.50, green.50)"
                          boxShadow="lg"
                          position="relative"
                          overflow="hidden"
                        >
                          <MagicShimmer
                            color="linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)"
                          >
                            <Image
                              boxSize="36px"
                              objectFit="cover"
                              src={icon}
                              alt="Throne & Liberty Logo"
                            />
                          </MagicShimmer>
                        </Box>
                      </Box>
                    </MagicPulse>
                    
                    <VStack align="start" spacing={0}>
                      <Heading
                        size="lg"
                        bgGradient="linear(45deg, teal.400, green.400, blue.400)"
                        bgClip="text"
                        fontWeight="black"
                        textShadow="0 0 20px rgba(14, 165, 233, 0.3)"
                      >
                        TLDKP
                      </Heading>
                      <Text 
                        fontSize="xs" 
                        color="gray.500" 
                        fontWeight="bold"
                        textTransform="uppercase"
                        letterSpacing="wide"
                      >
                        Dragon Kill Points
                      </Text>
                    </VStack>
                  </HStack>
                </MagicFloat>
              </Link>
            </MagicReveal>

            {/* Magic Desktop Navigation */}
            {!isMobile && (
              <MagicStagger stagger={0.1} delay={0.4}>
                <HStack spacing={3}>
                  <Tooltip label="Share and get other player's HUDS" hasArrow>
                    <Link to="/huds">
                      <MagicCard
                        as="button"
                        p={3}
                        borderRadius="xl"
                        bg="transparent"
                        _hover={{
                          bg: "teal.50",
                          transform: "translateY(-3px)",
                          boxShadow: "xl"
                        }}
                        transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                        position="relative"
                        overflow="hidden"
                      >
                        <HStack spacing={2}>
                          <Icon as={SiMaterialdesignicons} color="teal.500" boxSize={4} />
                          <Text fontWeight="bold" color="teal.600">HUDS</Text>
                          <Badge colorScheme="green" variant="solid" fontSize="xs" borderRadius="full">
                            New
                          </Badge>
                        </HStack>
                      </MagicCard>
                    </Link>
                  </Tooltip>

                  <MagicCard
                    as="button"
                    p={3}
                    borderRadius="xl"
                    bg="transparent"
                    onClick={() => onNewModalOpen()}
                    _hover={{
                      bg: "teal.50",
                      transform: "translateY(-3px)",
                      boxShadow: "xl"
                    }}
                    transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                  >
                    <HStack spacing={2}>
                      <Icon as={BsFillMegaphoneFill} color="teal.500" boxSize={4} />
                      <Text fontWeight="bold" color="teal.600">What's New?</Text>
                    </HStack>
                  </MagicCard>

                  <MagicCard
                    as="button"
                    p={3}
                    borderRadius="xl"
                    bg="transparent"
                    onClick={() => onOpen()}
                    _hover={{
                      bg: "teal.50",
                      transform: "translateY(-3px)",
                      boxShadow: "xl"
                    }}
                    transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                  >
                    <HStack spacing={2}>
                      <Icon as={RiSlashCommands} color="teal.500" boxSize={4} />
                      <Text fontWeight="bold" color="teal.600">Commands</Text>
                      <Badge colorScheme="green" variant="solid" fontSize="xs" borderRadius="full">
                        New
                      </Badge>
                    </HStack>
                  </MagicCard>

                  <Box
                    border="2px solid"
                    borderColor="gray.200"
                    borderRadius="xl"
                  >
                    <MagicCard
                      as="button"
                      p={3}
                      borderRadius="xl"
                      bgGradient="linear(45deg, teal.500, green.500)"
                      color="white"
                      onClick={() => {
                        window.open(import.meta.env.VITE_BOT_INSTALL, "_blank");
                      }}
                      _hover={{
                        transform: "translateY(-3px)",
                        boxShadow: "2xl",
                        bgGradient: "linear(45deg, teal.600, green.600)"
                      }}
                      transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                      fontWeight="bold"
                    >
                      <HStack spacing={2}>
                        <Icon as={IoAddOutline} boxSize={4} />
                        <Text>Add to Server</Text>
                      </HStack>
                    </MagicCard>
                  </Box>

                  <SignedOut>
                    <Link to="/sign-in">
                      <Box
                        border="2px solid"
                        borderColor="purple.300"
                        borderRadius="xl"
                      >
                        <MagicCard
                          as="button"
                          p={3}
                          borderRadius="xl"
                          bgGradient="linear(45deg, purple.500, purple.600)"
                          color="white"
                          _hover={{
                            transform: "translateY(-3px)",
                            boxShadow: "2xl",
                            bgGradient: "linear(45deg, purple.600, purple.700)"
                          }}
                          transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                          fontWeight="bold"
                        >
                          <HStack spacing={2}>
                            <Icon as={FaDiscord} boxSize={4} />
                            <Text>Login</Text>
                          </HStack>
                        </MagicCard>
                      </Box>
                    </Link>
                  </SignedOut>

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
                </HStack>
              </MagicStagger>
            )}

            {/* Mobile Navigation */}
            {isMobile && (
              <HStack spacing={2}>
                <Menu>
                  <MenuButton
                    as={IconButton}
                    icon={<Icon as={MdDehaze} />}
                    variant="ghost"
                    size="sm"
                  />
                  <Portal>
                    <MenuList 
                      zIndex={99999}
                      position="relative"
                    >
                      <MenuItem icon={<SiMaterialdesignicons />} as={Link} to="/huds">
                        HUDS
                        <Badge ml={2} colorScheme="green" fontSize="xs">New</Badge>
                      </MenuItem>
                      <MenuItem icon={<BsFillMegaphoneFill />} onClick={() => onNewModalOpen()}>
                        What's New?
                      </MenuItem>
                      <MenuItem icon={<RiSlashCommands />} onClick={() => onOpen()}>
                        Commands
                        <Badge ml={2} colorScheme="green" fontSize="xs">New</Badge>
                      </MenuItem>
                      <MenuDivider />
                      <MenuItem 
                        icon={<IoAddOutline />} 
                        onClick={() => window.open(import.meta.env.VITE_BOT_INSTALL, "_blank")}
                      >
                        Add to Server
                      </MenuItem>
                      <SignedOut>
                        <MenuItem icon={<FaDiscord />} as={Link} to="/sign-in">
                          Login with Discord
                        </MenuItem>
                      </SignedOut>
                    </MenuList>
                  </Portal>
                </Menu>
                
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
              </HStack>
            )}
          </Flex>
        </Container>
      </Box>

      <Modal
        title="Usage and commands"
        state={{ isOpen, onClose }}
        isCentered={true}
        closeOnOverlayClick={true}
      >
        {commands && categories ? (
          <UnorderedList spacing={5}>
            {categories.map((category: string, index: number) => (
              <Commands
                key={`${category}${index}`}
                commandsData={commands}
                category={category}
              />
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
              <span style={{ textDecoration: "underline" }}>
                {changelog.date}:
              </span>
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
    </motion.div>
  );
}

export default Navbar;
