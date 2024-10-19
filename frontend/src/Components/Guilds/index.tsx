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
} from "@chakra-ui/react";
import { Spinner } from "@chakra-ui/react";
import styled from "styled-components";
import unknown from "../../assets/unknown.png";

const Logo = styled.img`
  width: 20%;
`;

const Guilds = ({ data, loaded }: any): React.ReactNode => {
  return (
    <>
      {!loaded ? (
        <center>
          <Spinner size="xl" />
        </center>
      ) : (
        <>
          <Accordion
            allowToggle
          >
            {data?.map((guild: any) => {
              const { icon, name } = guild?.guildData ?? {};
              const { memberDkps } = guild ?? [];

              return (
                <AccordionItem key={guild?.guildData?.id} defaultChecked={true}>
                  <h2>
                    <AccordionButton>
                      <Box as="span" flex="1" textAlign="left">
                        <HStack justifyContent={"space-between"} width={"100%"}>
                          <HStack>
                            <Logo
                              style={{ width: "25px", borderRadius: "50px" }}
                              src={icon && icon !== "" ? icon : unknown}
                            ></Logo>
                            <div>{name}</div>
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
                        <Table variant="simple">
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
                            {memberDkps?.map((player: any) => {
                              const { displayName } = player?.discordData ?? {};
                              const { userId, dkp, ign } = player;
                              return (
                                <Tr key={userId}>
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
