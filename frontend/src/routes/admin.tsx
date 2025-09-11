/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */

import { Link, useNavigate } from "react-router-dom";
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
import SubscriptionManagement from "../Components/SubscriptionManagement";
import Guilds from "../Components/Guilds";

export default function AdminPage() {
  const { getToken, isLoaded } = useAuth();
  const navigate = useNavigate();

   
  const [data, setData] = useState<any>([]);
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    const fetch = async () => {
      if (!isLoaded) return;
      const res = await api.get(`/admin`, {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
      });
      if (res?.data?.data?.isAdmin) {
        setData(res?.data?.data);
        setLoaded(true);
      } else {
        navigate("/");
      }
    };
    fetch();
  }, [isLoaded]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        padding: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          width: "60%",
          minHeight: "75vh",
          flexDirection: "column",
          borderRadius: "10px",
          backgroundColor: "rgba(0, 0, 0, 0.1)",
          border: "linear(to-r, green.500, teal.500)",
        }}
      >
      {loaded && (
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
                Admin
              </BreadcrumbLink>
            </BreadcrumbItem>
          </Breadcrumb>

          <Tabs
            variant="enclosed"
            style={{ width: "100%" }}
            isFitted
            colorScheme="teal"
          >
            <TabList>
              <Tab>All Guilds {data?.guilds?.length && <Tag marginLeft="8px" colorScheme="gray">{data?.guilds?.length}</Tag>}</Tab>
              <Tab>Subscription Management</Tab>
              <Tab>Configurations</Tab>
            </TabList>

            <TabPanels>
              <TabPanel>
                <Guilds data={data?.guilds} loaded={loaded} isBackoffice />
              </TabPanel>
              <TabPanel>
                <SubscriptionManagement />
              </TabPanel>
              <TabPanel>
                <p style={{ marginTop: "20px", marginBottom: "20px" }}>
                  Other configs
                </p>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </>
      )}
      </div>
    </div>
  );
}
