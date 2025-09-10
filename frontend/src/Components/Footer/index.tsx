import { 
  Link, 
  VStack, 
  Heading, 
  Text, 
  HStack,
  Box,
  Container,
  useColorModeValue,
  Icon,
  Divider,
  Image
} from "@chakra-ui/react";
import { 
  ExternalLinkIcon
} from "@chakra-ui/icons";
import { 
  FaGithub, 
  FaDiscord, 
  FaPaypal, 
  FaHeart,
  FaMagic,
  FaRocket
} from "react-icons/fa";
import icon from "../../assets/tl.webp";
import { 
  MagicCard, 
  MagicFloat, 
  MagicReveal,
  MagicPulse,
  MagicStagger
} from "../../lib/magic-ui";

interface FooterProps {
  complete?: boolean;
}

function Footer({ complete = true }: FooterProps) {
  const footerBg = useColorModeValue("gray.50", "gray.900");
  const textColor = useColorModeValue("gray.600", "gray.300");
  const borderColor = useColorModeValue("gray.200", "gray.700");

  if (!complete) return null;

  return (
    <MagicReveal direction="up" distance={30}>
      <Box
        bg={footerBg}
        borderTop="1px"
        borderColor={borderColor}
        mt={20}
        position="relative"
        overflow="hidden"
      >
        {/* Magic Background Pattern */}
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          opacity={0.05}
          backgroundImage="radial-gradient(circle at 20% 80%, #0F766E 0%, transparent 50%), radial-gradient(circle at 80% 20%, #059669 0%, transparent 50%)"
          zIndex={0}
        />

        {/* Floating Background Elements */}
        <MagicFloat intensity={10} speed={8} delay={0}>
          <Box
            position="absolute"
            top="20%"
            right="10%"
            width="100px"
            height="100px"
            borderRadius="50%"
            bgGradient="radial(circle, teal.300, transparent)"
            opacity={0.1}
            zIndex={0}
          />
        </MagicFloat>
        
        <MagicFloat intensity={8} speed={6} delay={1}>
          <Box
            position="absolute"
            bottom="30%"
            left="15%"
            width="80px"
            height="80px"
            borderRadius="50%"
            bgGradient="radial(circle, green.300, transparent)"
            opacity={0.1}
            zIndex={0}
          />
        </MagicFloat>

        <Container maxW="container.xl" py={20} position="relative" zIndex={1}>
          <MagicStagger stagger={0.2} delay={0.3}>
            <VStack spacing={16} align="center">
              {/* Static Logo and Description */}
              <VStack spacing={6} textAlign="center">
                <Box
                  border="3px solid"
                  borderColor="gray.200"
                  borderRadius="2xl"
                >
                  <HStack spacing={4} p={6}>
                    <Box
                      p={4}
                      borderRadius="xl"
                      bgGradient="linear(135deg, teal.50, green.50)"
                      boxShadow="xl"
                    >
                      <Image src={icon} boxSize="48px" alt="TLDKP Logo" />
                    </Box>
                    
                    <VStack align="start" spacing={1}>
                      <Heading
                        size="2xl"
                        bgGradient="linear(45deg, teal.400, green.400, blue.400)"
                        bgClip="text"
                        fontWeight="black"
                        textShadow="0 0 20px rgba(14, 165, 233, 0.3)"
                      >
                        TLDKP
                      </Heading>
                      <Text 
                        fontSize="sm" 
                        color={textColor} 
                        fontWeight="bold"
                        textTransform="uppercase"
                        letterSpacing="wide"
                      >
                        Dragon Kill Points
                      </Text>
                    </VStack>
                  </HStack>
                </Box>
                  
                <Text 
                  fontSize="xl" 
                  color={textColor}
                  maxW="2xl"
                  lineHeight="1.7"
                  fontWeight="medium"
                >
                  Your favorite Throne & Liberty Discord bot for managing DKP systems
                </Text>
              </VStack>

              {/* Magic Links Section */}
              <MagicReveal direction="up" delay={0.8}>
                <VStack spacing={8}>
                  <HStack spacing={2} color={textColor} fontSize="lg" fontWeight="bold">
                    <Icon as={FaMagic} color="teal.500" />
                    <Text>Connect With Us</Text>
                    <Icon as={FaRocket} color="green.500" />
                  </HStack>
                  
                  <HStack 
                    spacing={8} 
                    wrap="wrap" 
                    justify="center"
                    divider={<Divider orientation="vertical" height="20px" />}
                  >
                    <Link
                      href="https://github.com/wyvern800/tldkp"
                      isExternal
                    >
                      <MagicCard
                        p={4}
                        borderRadius="xl"
                        bg="transparent"
                        _hover={{ 
                          bg: "teal.50",
                          transform: "translateY(-4px)",
                          boxShadow: "xl"
                        }}
                        transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                        display="flex"
                        alignItems="center"
                        gap={3}
                        cursor="pointer"
                      >
                        <Icon as={FaGithub} color="teal.500" boxSize={5} />
                        <Text fontWeight="bold" color="teal.600">GitHub</Text>
                        <ExternalLinkIcon boxSize={3} color="teal.400" />
                      </MagicCard>
                    </Link>

                    <Link
                      href="https://discord.gg/X6umAuntFA"
                      isExternal
                    >
                      <MagicCard
                        p={4}
                        borderRadius="xl"
                        bg="transparent"
                        _hover={{ 
                          bg: "purple.50",
                          transform: "translateY(-4px)",
                          boxShadow: "xl"
                        }}
                        transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                        display="flex"
                        alignItems="center"
                        gap={3}
                        cursor="pointer"
                      >
                        <Icon as={FaDiscord} color="purple.500" boxSize={5} />
                        <Text fontWeight="bold" color="purple.600">Discord</Text>
                        <ExternalLinkIcon boxSize={3} color="purple.400" />
                      </MagicCard>
                    </Link>

                    <Link
                      href="https://github.com/sponsors/wyvern800"
                      isExternal
                    >
                      <MagicCard
                        p={4}
                        borderRadius="xl"
                        bg="transparent"
                        _hover={{ 
                          bg: "blue.50",
                          transform: "translateY(-4px)",
                          boxShadow: "xl"
                        }}
                        transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                        display="flex"
                        alignItems="center"
                        gap={3}
                        cursor="pointer"
                      >
                        <Icon as={FaPaypal} color="blue.500" boxSize={5} />
                        <Text fontWeight="bold" color="blue.600">Donate</Text>
                        <ExternalLinkIcon boxSize={3} color="blue.400" />
                      </MagicCard>
                    </Link>
                  </HStack>
                </VStack>
              </MagicReveal>

              {/* Magic Bottom Section */}
              <MagicReveal direction="up" delay={1.2}>
                <VStack spacing={6} textAlign="center">
                  <MagicFloat intensity={3} speed={5}>
                    <HStack spacing={3} color={textColor} fontSize="lg" fontWeight="medium">
                      <Text>Made with</Text>
                      <MagicPulse intensity={0.3} speed={2} color="rgba(239, 68, 68, 0.3)">
                        <Icon as={FaHeart} color="red.500" boxSize={5} />
                      </MagicPulse>
                      <Text>by the TLDKP team</Text>
                    </HStack>
                  </MagicFloat>
                  
                  <Text fontSize="sm" color={textColor} opacity={0.8} fontWeight="medium">
                    © 2024-2025 TLDKP. All rights reserved.
                  </Text>
                </VStack>
              </MagicReveal>
            </VStack>
          </MagicStagger>
        </Container>
      </Box>
    </MagicReveal>
  );
}

export default Footer;
