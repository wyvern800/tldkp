/* eslint-disable react-hooks/exhaustive-deps */

import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Box,
  Container,
  Heading,
  Text,
  useColorModeValue,
  VStack,
  HStack,
  Icon,
  Badge,
  Card,
  CardBody,
  Divider
} from "@chakra-ui/react";
import { IoChevronForward, IoHome, IoStatsChart } from "react-icons/io5";
import { FaCrown, FaUsers } from "react-icons/fa";
import { useEffect, useState } from "react";
import api from "../services/axiosInstance";
import { useAuth } from "@clerk/clerk-react";
import Guilds from "../Components/Guilds";

export default function DashboardPage() {
  const { getToken, isLoaded } = useAuth();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>([]);
  const [loaded, setLoaded] = useState<boolean>(false);

  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const textColor = useColorModeValue("gray.600", "gray.300");
  const headingColor = useColorModeValue("gray.800", "white");

  useEffect(() => {
    const fetch = async () => {
      if (!isLoaded) return;
      const res = await api.get(`/dashboard`, {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
      });
      setData(res?.data?.data);
      setLoaded(true);
    };
    fetch();
  }, [isLoaded]);

  return (
    <Container maxW="container.xl" py={8}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Header Section */}
        <VStack spacing={6} mb={8}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Heading
              size="2xl"
              bgGradient="linear(to-r, teal.400, green.400)"
              bgClip="text"
              textAlign="center"
              mb={2}
            >
              Dashboard
            </Heading>
            <Text color={textColor} textAlign="center" maxW="md">
              Manage your <s>Discord servers</s> Guilds and DKP systems
            </Text>
          </motion.div>

          {/* Stats Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <HStack spacing={4} wrap="wrap" justify="center">
              <Card bg={cardBg} borderColor={borderColor} shadow="md">
                <CardBody p={4}>
                  <HStack spacing={3}>
                    <Box
                      p={2}
                      borderRadius="lg"
                      bg="teal.100"
                      color="teal.600"
                    >
                      <Icon as={FaCrown} boxSize={5} />
                    </Box>
                    <VStack align="start" spacing={0}>
                      <Text fontSize="sm" color={textColor}>
                        Owned guilds
                      </Text>
                      <Text fontSize="2xl" fontWeight="bold" color={headingColor}>
                        {data?.ownerGuilds?.length || 0}
                      </Text>
                    </VStack>
                  </HStack>
                </CardBody>
              </Card>

              <Card bg={cardBg} borderColor={borderColor} shadow="md">
                <CardBody p={4}>
                  <HStack spacing={3}>
                    <Box
                      p={2}
                      borderRadius="lg"
                      bg="green.100"
                      color="green.600"
                    >
                      <Icon as={FaUsers} boxSize={5} />
                    </Box>
                    <VStack align="start" spacing={0}>
                      <Text fontSize="sm" color={textColor}>
                        Others' guilds
                      </Text>
                      <Text fontSize="2xl" fontWeight="bold" color={headingColor}>
                        {data?.memberGuilds?.length || 0}
                      </Text>
                    </VStack>
                  </HStack>
                </CardBody>
              </Card>
            </HStack>
          </motion.div>
        </VStack>

        {/* Breadcrumb */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <Breadcrumb
            spacing="8px"
            separator={<IoChevronForward color="gray.500" />}
            mb={6}
          >
            <BreadcrumbItem>
              <BreadcrumbLink as={Link} to="/" color={textColor} _hover={{ color: "teal.500" }}>
                <Icon as={IoHome} mr={1} />
                Home
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem isCurrentPage>
              <BreadcrumbLink as={Link} color="teal.500" fontWeight="medium">
                <Icon as={IoStatsChart} mr={1} />
                Dashboard
              </BreadcrumbLink>
            </BreadcrumbItem>
          </Breadcrumb>
        </motion.div>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <Card bg={cardBg} borderColor={borderColor} shadow="lg" overflow="hidden">
            <Tabs variant="enclosed" colorScheme="teal">
              <TabList bg={useColorModeValue("gray.50", "gray.700")} px={6}>
                <Tab
                  _selected={{
                    color: "teal.500",
                    borderColor: "teal.500",
                    bg: cardBg,
                  }}
                  py={4}
                  fontWeight="medium"
                >
                  <HStack spacing={2}>
                    <Icon as={FaCrown} />
                    <Text>My Guilds</Text>
                    {data?.ownerGuilds?.length > 0 && (
                      <Badge colorScheme="teal" variant="solid" borderRadius="full">
                        {data.ownerGuilds.length}
                      </Badge>
                    )}
                  </HStack>
                </Tab>
                <Tab
                  _selected={{
                    color: "teal.500",
                    borderColor: "teal.500",
                    bg: cardBg,
                  }}
                  py={4}
                  fontWeight="medium"
                >
                  <HStack spacing={2}>
                    <Icon as={FaUsers} />
                    <Text>Participating</Text>
                    {data?.memberGuilds?.length > 0 && (
                      <Badge colorScheme="green" variant="solid" borderRadius="full">
                        {data.memberGuilds.length}
                      </Badge>
                    )}
                  </HStack>
                </Tab>
              </TabList>

              <TabPanels>
                <TabPanel p={6}>
                  <VStack spacing={4} align="start">
                    <Text color={textColor} fontSize="sm" lineHeight="1.6">
                      The guilds here are Discord servers that you own. As the server owner with the bot implemented, 
                      you have access to administrative controls and settings that regular members don't have.
                    </Text>
                    <Divider />
                    <Guilds data={data?.ownerGuilds} loaded={loaded} isOwnedGuilds={true} />
                  </VStack>
                </TabPanel>
                <TabPanel p={6}>
                  <VStack spacing={4} align="start">
                    <Text color={textColor} fontSize="sm" lineHeight="1.6">
                      These are Discord servers where you participate as a member. You can view DKP information 
                      and participate in the DKP system, but don't have administrative privileges.
                    </Text>
                    <Divider />
                    <Guilds data={data?.memberGuilds} loaded={loaded} isOwnedGuilds={false} />
                  </VStack>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Card>
        </motion.div>
      </motion.div>
    </Container>
  );
}
