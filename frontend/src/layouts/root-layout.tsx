import { Outlet, useNavigate } from "react-router-dom";
import { ClerkProvider, ClerkLoaded, ClerkLoading } from "@clerk/clerk-react";
import { Box, useColorModeValue, useDisclosure, Spinner } from "@chakra-ui/react";
import { motion } from "framer-motion";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import AnnouncementModal from "../Components/AnnouncementModal";
import { useEffect } from "react";

export default function RootLayout() {
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Debug logging
  useEffect(() => {
    console.log("RootLayout mounted");
    console.log("Clerk key:", import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
  }, []);

  // Show announcement modal on page load
  useEffect(() => {
    // Check if user has already seen the announcement
    const hasSeenAnnouncement = localStorage.getItem("tldkp-announcement-seen");
    if (hasSeenAnnouncement !== "true") {
      onOpen();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bg = useColorModeValue("gray.50", "gray.900");
  const gradient = useColorModeValue(
    "linear(to-br, teal.50, green.50, blue.50)",
    "linear(to-br, gray.900, gray.800, gray.900)"
  );

  return (
    <>
      <AnnouncementModal isOpen={isOpen} onClose={onClose} />
      <ClerkProvider
        routerPush={(to) => navigate(to)}
        routerReplace={(to) => navigate(to, { replace: true })}
        publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "pk_test_placeholder"}
      >
        <ClerkLoading>
          <Box
            minH="100vh"
            bg={bg}
            bgGradient={gradient}
            position="relative"
            overflow="hidden"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Spinner size="xl" color="teal.500" />
            </motion.div>
          </Box>
        </ClerkLoading>

        <ClerkLoaded>
          <Box
            minH="100vh"
            bg={bg}
            bgGradient={gradient}
            position="relative"
            overflow="hidden"
          >
            {/* Background Pattern */}
            <Box
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              opacity={0.05}
              backgroundImage="radial-gradient(circle at 25% 25%, #0F766E 0%, transparent 50%), radial-gradient(circle at 75% 75%, #059669 0%, transparent 50%)"
              zIndex={0}
            />
            

            {/* Main Content */}
            <Box position="relative" zIndex={1}>
              <Navbar />
              <Outlet />
              <Footer />
            </Box>
          </Box>
        </ClerkLoaded>
      </ClerkProvider>
    </>
  );
}
