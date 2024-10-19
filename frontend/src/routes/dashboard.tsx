/* eslint-disable react-hooks/exhaustive-deps */

import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Tag
} from "@chakra-ui/react";
import { IoChevronForward } from "react-icons/io5";
import { useEffect, useState } from "react";
import api from "../services/axiosInstance";
import { useAuth } from "@clerk/clerk-react";
import Guilds from "../Components/Guilds";

export default function DashboardPage() {
  const { getToken, isLoaded } = useAuth();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>([]);
  const [loaded, setLoaded] = useState<boolean>(false);

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
    <div
      style={{
        display: "flex",
        justifyItems: "space-between",
        width: "60%",
        minHeight: "75vh",
        flexDirection: "column",
        borderRadius: "10px",
        backgroundColor: "rgba(0, 0, 0, 0.1)",
        border: "linear(to-r, green.500, teal.500)"
        
      }}
    >
      <>
        <Breadcrumb
          spacing="8px"
          separator={<IoChevronForward color="gray.500" />}
          style={{
            padding: "15px",
            backgroundColor: "#0000004d",
            borderTopLeftRadius: "10px",
            borderTopRightRadius: "10px",
          }}
        >
          <BreadcrumbItem>
            <BreadcrumbLink as={Link} to="/">
              Home
            </BreadcrumbLink>
          </BreadcrumbItem>

          <BreadcrumbItem>
            <BreadcrumbLink as={Link} to="/dashboard">
              Dashboard
            </BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>
        <main
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px",
            flexDirection: "column",
          }}
        >
          <Tabs
            variant="enclosed"
            style={{ width: "100%" }}
            isFitted
            colorScheme="teal"
          >
            <TabList>
              <Tab>My Guilds {data?.ownerGuilds?.length && <Tag marginLeft="8px" colorScheme="gray">{data?.ownerGuilds?.length}</Tag>}</Tab>
              <Tab>Guilds I'm participating {data?.memberGuilds?.length && <Tag marginLeft="8px" colorScheme="gray">{data?.memberGuilds?.length}</Tag>}</Tab>
            </TabList>

            <TabPanels>
              <TabPanel>
                <p style={{ marginTop: "20px", marginBottom: "20px" }}>
                  The guilds here means a server discord that you own, so if you
                  are the server owner with the bot implemented, you may see
                  them here and have access to some controls you wouldn't as a
                  member
                </p>

                <Guilds data={data?.ownerGuilds} loaded={loaded} />
              </TabPanel>
              <TabPanel>
                <p style={{ marginTop: "20px", marginBottom: "20px" }}>
                  The guilds here means a server discord that you participate
                </p>

                <Guilds data={data?.memberGuilds} loaded={loaded} />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </main>
      </>
    </div>
  );
}
