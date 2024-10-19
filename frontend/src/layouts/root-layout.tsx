import { Outlet, useNavigate } from "react-router-dom";
import { ClerkProvider, ClerkLoaded, ClerkLoading } from "@clerk/clerk-react";
import { Container, useColorModeValue } from "@chakra-ui/react";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import { Spinner } from "@chakra-ui/react";

export default function RootLayout() {
  const navigate = useNavigate();

  const bg = useColorModeValue("blue.600", "white");
  const gradient = useColorModeValue(
    "linear(to-r, teal.500, purple.500)",
    "linear(to-r, teal.600, purple.600)",
  );

  return (
    <ClerkProvider
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
    >
      <ClerkLoading>
        <Container
          maxW="100vw"
          bg={bg}
          bgGradient={gradient}
          minH="100vh"
          centerContent
          alignItems="center"
          justifyContent="center"
        >
          <Spinner size="xl" />
        </Container>
      </ClerkLoading>

      <ClerkLoaded>
        <Container
          maxW="100vw"
          bg={bg}
          bgGradient={gradient}
          minH="100vh"
          centerContent
          alignItems="center"
          justifyContent="space-between"
        >
          <Navbar />
          <Outlet />
          <Footer />
        </Container>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
