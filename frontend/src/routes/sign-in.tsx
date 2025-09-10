import { SignIn } from "@clerk/clerk-react";
import { Box, Container, VStack, Heading, Text, useColorModeValue } from "@chakra-ui/react";
import { motion } from "framer-motion";
import styled from "styled-components";

const Wrapper = styled.div`
  .cl-footerAction {
    //display: none !important;
  }
`;

export default function SignInPage() {
  const textColor = useColorModeValue("gray.600", "gray.300");

  return (
    <Container maxW="container.md" py={16}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <VStack spacing={8} align="center" mb={8}>
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
              Welcome Back
            </Heading>
            <Text color={textColor} textAlign="center" maxW="md">
              Sign in to access your dashboard and manage your DKP systems
            </Text>
          </motion.div>
        </VStack>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Box
            bg={useColorModeValue("white", "gray.800")}
            borderRadius="xl"
            shadow="lg"
            p={8}
            border="1px"
            borderColor={useColorModeValue("gray.200", "gray.600")}
          >
            <Wrapper>
              <SignIn 
                path="/sign-in" 
                signUpUrl="/sign-up" 
                forceRedirectUrl="/dashboard"
                appearance={{
                  elements: {
                    formButtonPrimary: {
                      backgroundColor: "#0F766E",
                      "&:hover": {
                        backgroundColor: "#0D9488",
                      },
                    },
                    card: {
                      boxShadow: "none",
                    },
                  },
                }}
              />
            </Wrapper>
          </Box>
        </motion.div>
      </motion.div>
    </Container>
  );
}
