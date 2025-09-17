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
  const [premiumCount, setPremiumCount] = useState<number>(0);

  // Function to calculate premium server count
  const calculatePremiumCount = (guilds: any[]) => {
    if (!guilds) {
      console.log('No guilds data provided');
      return 0;
    }
    
    console.log('Calculating premium count for', guilds.length, 'guilds');
    
    const premiumGuilds = guilds.filter(guild => {
      console.log('Full guild object:', guild);
      console.log('Guild keys:', Object.keys(guild));
      console.log('Guild subscription property:', guild.subscription);
      console.log('Subscription keys:', guild.subscription ? Object.keys(guild.subscription) : 'No subscription');
      console.log('Subscription values:', JSON.stringify(guild.subscription, null, 2));
      
      const subscription = guild.subscription || { isPremium: false, expiresAt: null, planType: 'free' };
      
      console.log('Guild:', guild.guildData?.name, 'Subscription:', subscription);
      
      // Check if it's premium and active
      if (!subscription.isPremium) return false;
      
      // If it's lifetime, it's always active
      if (subscription.planType === 'lifetime') {
        console.log('Lifetime plan found:', guild.guildData?.name);
        return true;
      }
      
      // If it has an expiration date, check if it's still valid
      if (subscription.expiresAt) {
        let expirationDate;
        
        // Handle Firestore timestamp format
        if (subscription.expiresAt._seconds) {
          expirationDate = new Date(subscription.expiresAt._seconds * 1000);
        } else if (subscription.expiresAt.toDate) {
          expirationDate = subscription.expiresAt.toDate();
        } else {
          expirationDate = new Date(subscription.expiresAt);
        }
        
        const isActive = expirationDate > new Date();
        console.log('Expiring plan:', guild.guildData?.name, 'Expires:', expirationDate, 'Active:', isActive);
        return isActive;
      }
      
      return false;
    });
    
    console.log('Premium guilds found:', premiumGuilds.length);
    return premiumGuilds.length;
  };

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
        
        // Calculate premium count
        const premiumServers = calculatePremiumCount(res?.data?.data?.guilds);
        console.log('Guilds data:', res?.data?.data?.guilds);
        console.log('Premium servers count:', premiumServers);
        setPremiumCount(premiumServers);
      } else {
        navigate("/");
      }
    };
    fetch();
  }, [isLoaded]);

  // Debug premium count changes
  useEffect(() => {
    console.log('Premium count updated:', premiumCount);
  }, [premiumCount]);

  // Function to refresh premium count (can be called by child components)
  const refreshPremiumCount = async () => {
    try {
      const res = await api.get(`/admin`, {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
      });
      if (res?.data?.data?.isAdmin) {
        setData(res?.data?.data);
        const premiumServers = calculatePremiumCount(res?.data?.data?.guilds);
        setPremiumCount(premiumServers);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

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
              <Tab>Subscriptions <Tag marginLeft="8px" colorScheme="green">{premiumCount}</Tag></Tab>
              <Tab>Configurations</Tab>
            </TabList>

            <TabPanels>
              <TabPanel>
                <Guilds data={data?.guilds} loaded={loaded} isBackoffice />
              </TabPanel>
              <TabPanel>
                <SubscriptionManagement onSubscriptionUpdate={refreshPremiumCount} />
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
