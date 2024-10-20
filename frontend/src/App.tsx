import { Container, useColorModeValue } from "@chakra-ui/react";
import StackExp from "./Components/StackExp";
import Footer from "./Components/Footer";
import Navbar from "./Components/Navbar";

function App() {
  const bg = useColorModeValue("blue.600", "white");
  const gradient = useColorModeValue(
    "linear(to-r, teal.500, green.500)",
    "linear(to-r, teal.900, green.900)"
  );

  return (
    <Container
      maxW="100vw"
      bg={bg}
      bgGradient={gradient}
      minH="100vh"
      centerContent
      alignItems="center"
      justifyContent="space-between"
    >
      <Navbar></Navbar>
      <StackExp />
      <Footer />
    </Container>
  );
}

export default App;
