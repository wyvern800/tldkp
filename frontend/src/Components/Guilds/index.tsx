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
  Spacer,
  Text,
} from "@chakra-ui/react";
import { Spinner } from "@chakra-ui/react";
import styled from "styled-components";
import unknown from "../../assets/unknown.png";
import { useUser } from "@clerk/clerk-react";
import { useState, useEffect } from "react";

const Logo = styled.img`
  width: 20%;
`;

const Guilds = ({ data, loaded }: any): React.ReactNode => {
  const { isLoaded, user } = useUser();
  const [myDiscordId, setMyDiscordId] = useState<string | undefined>("");

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
          <Accordion allowToggle>
            {data?.map((guild: any, index: number) => {
              const { icon, name, alias } = guild?.guildData ?? {};
              const { memberDkps } = guild ?? [];

              return (
                <AccordionItem
                  key={`${guild?.guildData?.id}${index}`}
                  defaultChecked={true}
                >
                  <h2>
                    <AccordionButton>
                      <Box as="span" flex="1" textAlign="left">
                        <HStack justifyContent={"space-between"} width={"100%"}>
                          <HStack>
                            <Logo
                              style={{ width: "25px", borderRadius: "50px" }}
                              src={icon && icon !== "" ? icon : unknown}
                            ></Logo>
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
                            </HStack>
                          </HStack>
                          <Spacer />
                          {memberDkps?.length && (
                            <Tag marginRight="8px" colorScheme="teal">
                              {memberDkps?.length}
                            </Tag>
                          )}
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
                          {memberDkps
                              ?.filter((player: any) => player.userId === myDiscordId)
                              ?.sort((a: any, b: any) => b.dkp - a.dkp)
                              .map((player: any, index: number) => {
                                const { displayName } =
                                  player?.discordData ?? {};
                                const { userId, dkp, ign } = player;
                                return (
                                  <Tr key={`${userId}${index}`} color="#81E6D9" bgColor={"#26c0ab24"}>
                                    <Td><strong>{displayName}</strong></Td>
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
                                    <Td>{displayName}</Td>
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
    </>
  );
};

export default Guilds;
