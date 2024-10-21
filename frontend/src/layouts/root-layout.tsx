import { Outlet, useNavigate } from "react-router-dom";
import { ClerkProvider, ClerkLoaded, ClerkLoading } from "@clerk/clerk-react";
import { Container, useColorModeValue/*, useDisclosure*/ } from "@chakra-ui/react";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import { Spinner } from "@chakra-ui/react";
import Modal from "../Components/Modal";
import { useEffect } from "react";

export default function RootLayout() {
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Modal for advising users that the website is under attack
  /*useEffect(() => {
    onOpen();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);*/

  const bg = useColorModeValue("blue.600", "white");
  const gradient = useColorModeValue(
    "linear(to-r, teal.500, purple.500)",
    "linear(to-r, teal.600, purple.600)"
  );

  return (
    <>
      {/*<Modal
        title="We're experiencing attacks"
        state={{ isOpen, onClose }}
        isCentered={true}
        closeOnOverlayClick={true}
      >
        Hello, sorry for the inconvenience, but we're currently experiencing attacks to our databases which caused the usage
        to be disabled. We're working on fixing this issue and we'll be back soon. Thank you for your patience.
        There is no ETA for when we'll be back, but we're working on it.
      </Modal>*/}
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
    </>
  );
}
