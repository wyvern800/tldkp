/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Tag,
  HStack,
  Text,
  IconButton,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Button,
} from "@chakra-ui/react";
import { Spinner } from "@chakra-ui/react";
import { DeleteIcon } from "@chakra-ui/icons";
import { FaUpload, FaCrown } from "react-icons/fa";
import styled from "styled-components";
import unknown from "../../assets/unknown.png";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/axiosInstance";

const Logo = styled.img`
  width: 20%;
`;

const Guilds = ({ data: initialData, loaded, isBackoffice = false }: any): React.ReactNode => {
const { isLoaded, user } = useUser();
const { getToken } = useAuth();
const navigate = useNavigate();
  const [myDiscordId, setMyDiscordId] = useState<string | undefined>("");
  const [data, setData] = useState(initialData);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [guildToDelete, setGuildToDelete] = useState<any>(null);
  const cancelRef = useRef<any>();
  const toast = useToast();

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const handleDelete = async (guild: any) => {
    setGuildToDelete(guild);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/guilds/${guildToDelete.guildData.id}`, {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
      });
      setData((prev: any[]) => prev.filter((g: any) => g.guildData.id !== guildToDelete.guildData.id));
      toast({
        title: "Guild deleted",
        description: "The guild has been deleted successfully.",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (error: any) {
      console.error('Error deleting guild:', error);
      toast({
        title: "Error",
        description: "Failed to delete the guild. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsDeleteOpen(false);
      setGuildToDelete(null);
    }
  };

  // Effect to get the logged user userId
  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!user) return;
    const discordAccount = user.externalAccounts?.find(
      (account) => account.provider === "discord"
    );

    console.log(discordAccount?.providerUserId);
    setMyDiscordId(discordAccount?.providerUserId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {!loaded ? (
        <center>
          <Spinner size="xl" />
        </center>
      ) : (
        <>
          <Accordion allowToggle w="full">
            {data?.map((guild: any, index: number) => {
              const { icon, name, alias } = guild?.guildData ?? {};
              const { memberDkps, subscription } = guild ?? {};
              const isGuildOwner = guild?.guildData?.ownerId === myDiscordId;
              const isGuildPremium = subscription?.isPremium || false;

              return (
                <AccordionItem
                  key={`${guild?.guildData?.id}${index}`}
                  defaultChecked={true}
                  w="full"
                >
                  <h2 style={{ width: "100%" }}>
                    <AccordionButton w="full">
                      <Box as="span" flex="1" textAlign="left" w="full">
                        <HStack justifyContent={"space-between"} w="full" style={{ width: "100%" }}>
                          <HStack>
                            <Logo
                              style={{ width: "25px", borderRadius: "50px" }}
                              src={icon && icon !== "" ? icon : unknown}
                            />
                            <HStack>
                              {alias && alias !== null && alias !== "" ? (
                                <>
                                  <Text>{alias}</Text>
                                  <Text fontSize="xs" color="lightgray">
                                    ({name})
                                  </Text>
                                </>
                              ) : (
                                <>{name}</>
                              )}
                              {isGuildOwner && !isGuildPremium && (
                                <Tag size="sm" colorScheme="gray" variant="outline">
                                  Free
                                </Tag>
                              )}
                            </HStack>
                          </HStack>
                          <HStack spacing={2}>
                            {isGuildOwner && !isBackoffice && (
                              <IconButton
                                aria-label={isGuildPremium ? "Manage Subscription" : "Upgrade to Premium"}
                                icon={<FaCrown />}
                                size="sm"
                                colorScheme={isGuildPremium ? "green" : "yellow"}
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/guild/${guild.guildData.id}/subscription`);
                                }}
                                title={isGuildPremium ? "Manage Subscription" : "Upgrade to Premium"}
                              />
                            )}
                            {guild?.guildData?.ownerId === myDiscordId && !isBackoffice && (
                              <IconButton
                                aria-label="Import data"
                                icon={<FaUpload />}
                                size="sm"
                                colorScheme="blue"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/guild/${guild.guildData.id}/import`);
                                }}
                                title="Import member data from CSV"
                              />
                            )}
                            {guild?.guildData?.ownerId === myDiscordId && (
                              <IconButton
                                aria-label="Delete guild"
                                icon={<DeleteIcon />}
                                size="sm"
                                colorScheme="red"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(guild);
                                }}
                              />
                            )}
                            {memberDkps?.length && (
                              <Tag colorScheme="teal">
                                {memberDkps?.length}
                              </Tag>
                            )}
                          </HStack>
                        </HStack>
                      </Box>
                      <AccordionIcon />
                    </AccordionButton>
                  </h2>
                  <AccordionPanel pb={4}>
                    <TableContainer>
                      {memberDkps && memberDkps?.length ? (
                        <Table variant="simple" size="sm" colorScheme="gray">
                          <Thead>
                            <Tr>
                              <Th>User</Th>
                              <Th>IGN (Ingame Nickname)</Th>
                              <Th isNumeric>
                                Current DKP (Dragon Kill Points)
                              </Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                          {!isBackoffice && memberDkps
                              ?.filter((player: any) => player.userId === myDiscordId)
                              ?.sort((a: any, b: any) => b.dkp - a.dkp)
                              .map((player: any, index: number) => {
                                const { displayName } =
                                  player?.discordData ?? {};
                                const { userId, dkp, ign } = player;
                                return (
                                  <Tr key={`${userId}${index}`} color="#81E6D9" bgColor={"#26c0ab24"}>                                   
                                    <Td><HStack display="flex" alignItems={"center"}><Logo style={{ width: "25px", borderRadius: "50px" }} src={player?.discordData?.avatarURL ?? ""} /> <strong>{displayName}</strong></HStack></Td>
                                    <Td><strong>{ign ?? ""}</strong></Td>
                                    <Td isNumeric><strong>{dkp}</strong></Td>
                                  </Tr>
                                );
                              })}
                            {memberDkps
                              ?.filter((player: any) => player.userId !== myDiscordId)
                              ?.sort((a: any, b: any) => b.dkp - a.dkp)
                              .map((player: any, index: number) => {
                                const { displayName } =
                                  player?.discordData ?? {};
                                const { userId, dkp, ign } = player;
                                return (
                                  <Tr key={`${userId}${index}`}>
                                    <Td><HStack display="flex" alignItems={"center"}><Logo style={{ width: "25px", borderRadius: "50px" }} src={player?.discordData?.avatarURL ?? ""} /> <span>{displayName}</span></HStack></Td>
                                    <Td>{ign ?? ""}</Td>
                                    <Td isNumeric>{dkp}</Td>
                                  </Tr>
                                );
                              })}
                          </Tbody>
                        </Table>
                      ) : (
                        <center>
                          There are no records for this guild yet.
                        </center>
                      )}
                    </TableContainer>
                  </AccordionPanel>
                </AccordionItem>
              );
            })}
          </Accordion>
        </>
      )}
      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={() => setIsDeleteOpen(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Guild
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete this guild? This action cannot be undone.<br/>
              <br/>
              <p>You will lose everything:</p>
              <p>- Access to your guild data like: Members, DKPs...</p>
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setIsDeleteOpen(false)}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={confirmDelete} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
};

export default Guilds;
