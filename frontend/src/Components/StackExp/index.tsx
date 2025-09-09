import { ReactNode } from "react";
import { 
  Box, 
  Heading, 
  Text, 
  useColorModeValue,
  Icon,
  Flex,
  Badge,
  Container,
  VStack,
  HStack
} from "@chakra-ui/react";
import { 
  FaDragon, 
  FaGift, 
  FaCog, 
  FaRobot, 
  FaCrown,
  FaArrowRight,
  FaMagic,
  FaStar
} from "react-icons/fa";
import { IconType } from "react-icons";
import { 
  MagicCard, 
  MagicFloat, 
  MagicShimmer, 
  MagicGradientBorder,
  MagicReveal,
  MagicPulse,
  MagicTypewriter,
  MagicStagger
} from "../../lib/magic-ui";

interface FeatureProps {
  title: string;
  desc: string;
  icon: IconType;
  badge?: string;
  delay?: number;
}

function Feature({ title, desc, icon, badge, delay = 0 }: FeatureProps) {
  const cardBg = useColorModeValue("white", "gray.800");
  const iconColor = useColorModeValue("teal.500", "teal.400");
  const textColor = useColorModeValue("gray.700", "gray.200");
  const titleColor = useColorModeValue("gray.800", "white");

  return (
    <MagicReveal direction="up" delay={delay} distance={30}>
      <MagicGradientBorder
        gradient="linear-gradient(45deg, #0F766E, #059669, #0D9488)"
        thickness={2}
        animated={true}
        borderRadius="xl"
      >
        <MagicCard
          p={8}
          bg={cardBg}
          borderRadius="xl"
          shadow="2xl"
          hover={true}
          glow={true}
          delay={delay}
          _hover={{
            shadow: "2xl",
            transform: "translateY(-8px)",
          }}
          transition="all 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
          position="relative"
          overflow="hidden"
        >
          {/* Magic Shimmer Effect */}
          <MagicShimmer
            color="linear-gradient(90deg, transparent, rgba(14, 165, 233, 0.1), transparent)"
          >
            <Box
              position="absolute"
              top={0}
              left={0}
              right={0}
              height="4px"
              bgGradient="linear(to-r, teal.400, green.400, blue.400)"
            />
          </MagicShimmer>
          
          {/* Floating Icon */}
          <MagicFloat intensity={5} speed={4} delay={delay}>
            <Flex align="center" mb={6}>
              <MagicPulse intensity={0.2} speed={3} color="rgba(14, 165, 233, 0.3)">
                <Box
                  p={4}
                  borderRadius="xl"
                  bgGradient="linear(135deg, teal.50, green.50)"
                  color={iconColor}
                  mr={4}
                  boxShadow="lg"
                  position="relative"
                  _before={{
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: 'inherit',
                    background: 'linear-gradient(45deg, transparent, rgba(14, 165, 233, 0.1), transparent)',
                    opacity: 0,
                    transition: 'opacity 0.3s ease',
                    zIndex: 1
                  }}
                  _hover={{
                    _before: { opacity: 1 },
                    transform: 'scale(1.1)',
                    boxShadow: 'xl'
                  }}
                  transition="all 0.3s ease"
                >
                  <Icon as={icon} boxSize={8} />
                </Box>
              </MagicPulse>
              
              <VStack align="start" flex={1} spacing={2}>
                <HStack spacing={3} align="center">
                  <Heading 
                    fontSize="2xl" 
                    color={titleColor}
                    fontWeight="bold"
                    bgGradient="linear(to-r, teal.600, green.600)"
                    bgClip="text"
                  >
                    {title}
                  </Heading>
                  <Icon as={FaStar} color="yellow.400" boxSize={4} />
                </HStack>
                
                {badge && (
                  <Badge
                    colorScheme="teal"
                    variant="solid"
                    px={3}
                    py={1}
                    borderRadius="full"
                    fontSize="xs"
                    fontWeight="bold"
                    textTransform="uppercase"
                    letterSpacing="wide"
                    boxShadow="md"
                  >
                    {badge}
                  </Badge>
                )}
              </VStack>
            </Flex>
          </MagicFloat>
          
          <Text 
            color={textColor}
            fontSize="lg"
            lineHeight="1.7"
            mb={6}
            fontWeight="medium"
          >
            {desc}
          </Text>
          
          <Flex 
            align="center" 
            color={iconColor} 
            fontSize="sm" 
            fontWeight="bold"
            textTransform="uppercase"
            letterSpacing="wide"
            cursor="pointer"
            _hover={{
              color: "teal.600",
              transform: "translateX(4px)"
            }}
            transition="all 0.3s ease"
          >
            <Icon as={FaMagic} mr={2} />
            Discover More
            <Icon as={FaArrowRight} ml={2} />
          </Flex>
        </MagicCard>
      </MagicGradientBorder>
    </MagicReveal>
  );
}

function StackExp(): ReactNode {
  const containerBg = useColorModeValue("transparent", "transparent");
  const textColor = useColorModeValue("gray.600", "gray.300");
  
  const features = [
    {
      title: "Manage your guild member's DKP",
      desc: "The Dragon Kill Points (DKP) system is a method used in MMORPGs to distribute loot among players after defeating bosses or completing raids. DKP is a type of currency that players earn by participating in these activities.",
      icon: FaDragon,
      badge: "Core Feature",
      delay: 0.1
    },
    {
      title: "Totally Free",
      desc: "This bot was designed to be free and open-sourced, so you can use and do whatever you want with the code (but not sell or earn money with it).",
      icon: FaGift,
      badge: "Open Source",
      delay: 0.2
    },
    {
      title: "Steady & Simple",
      desc: "There are no complications using it, everything you want you can config via command lines. There are tons of toggles and configurations you can do within commands.",
      icon: FaCog,
      badge: "Easy Setup",
      delay: 0.3
    },
    {
      title: "Automated Tasks",
      desc: "You can automate the bot to do some tasks for you, like decaying DKP from all members, or even generate claimable dkp tokens per events. There are many more future implementations to come.",
      icon: FaRobot,
      badge: "Automation",
      delay: 0.4
    },
    {
      title: "Premium Features",
      desc: "We plan on implementing more complex features in the future, that donators can have access to, that way donators can contribute directly with the expenses and be rewarded!",
      icon: FaCrown,
      badge: "Coming Soon",
      delay: 0.5
    }
  ];

  return (
    <Container
      maxW="container.xl"
      bg={containerBg}
      py={20}
      px={4}
      position="relative"
    >
      {/* Magic Background Elements */}
      <Box
        position="absolute"
        top="10%"
        right="5%"
        width="200px"
        height="200px"
        borderRadius="50%"
        bgGradient="radial(circle, teal.200, transparent)"
        opacity={0.1}
        zIndex={0}
      />
      <Box
        position="absolute"
        bottom="20%"
        left="5%"
        width="150px"
        height="150px"
        borderRadius="50%"
        bgGradient="radial(circle, green.200, transparent)"
        opacity={0.1}
        zIndex={0}
      />

      {/* Magic Header Section */}
      <MagicReveal direction="up" distance={50}>
        <VStack spacing={8} textAlign="center" mb={16} position="relative" zIndex={1}>
          <MagicFloat intensity={3} speed={6}>
            <VStack spacing={4}>
              <Heading
                fontSize={{ base: "4xl", md: "5xl", lg: "6xl" }}
                fontWeight="black"
                bgGradient="linear(45deg, teal.400, green.400, blue.400)"
                bgClip="text"
                textShadow="0 0 30px rgba(14, 165, 233, 0.3)"
                position="relative"
              >
                <MagicTypewriter
                  text="Why Choose TL-DKP?"
                  speed={100}
                  delay={500}
                />
              </Heading>
              
              <Box
                position="relative"
                _before={{
                  content: '""',
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '120%',
                  height: '120%',
                  background: 'linear-gradient(45deg, transparent, rgba(14, 165, 233, 0.1), transparent)',
                  borderRadius: '50%',
                  zIndex: -1
                }}
              >
                <Text
                  fontSize={{ base: "lg", md: "xl", lg: "2xl" }}
                  color={textColor}
                  maxW="3xl"
                  mx="auto"
                  fontWeight="medium"
                  lineHeight="1.6"
                >
                  A comprehensive DKP management system designed for modern gaming guilds
                </Text>
              </Box>
            </VStack>
          </MagicFloat>
        </VStack>
      </MagicReveal>

      {/* Magic Features Grid */}
      <MagicStagger stagger={0.2} delay={0.5}>
        <VStack spacing={12} maxW="5xl" mx="auto" position="relative" zIndex={1}>
          {features.map((feature, index) => (
            <Feature
              key={index}
              title={feature.title}
              desc={feature.desc}
              icon={feature.icon}
              badge={feature.badge}
              delay={feature.delay}
            />
          ))}
        </VStack>
      </MagicStagger>

      {/* Magic Call-to-Action */}
      <MagicReveal direction="up" delay={2}>
        <VStack spacing={6} mt={20} textAlign="center" position="relative" zIndex={1}>
          <MagicPulse intensity={0.3} speed={4} color="rgba(14, 165, 233, 0.2)">
            <Box
              p={8}
              borderRadius="2xl"
              bgGradient="linear(135deg, teal.50, green.50, blue.50)"
              border="2px solid"
              borderColor="teal.200"
              boxShadow="xl"
              maxW="2xl"
              mx="auto"
            >
              <VStack spacing={4}>
                <HStack spacing={3}>
                  <Icon as={FaMagic} color="teal.500" boxSize={6} />
                  <Heading
                    fontSize="2xl"
                    bgGradient="linear(to-r, teal.600, green.600)"
                    bgClip="text"
                    fontWeight="bold"
                  >
                    Ready to Transform Your Guild?
                  </Heading>
                </HStack>
                <Text color={textColor} fontSize="lg" maxW="md">
                  Join thousands of guilds already using TLDKP to manage their Dragon Kill Points
                </Text>
                <MagicFloat intensity={2} speed={3}>
                  <Box
                    as="button"
                    px={8}
                    py={4}
                    bgGradient="linear(45deg, teal.500, green.500)"
                    color="white"
                    borderRadius="xl"
                    fontWeight="bold"
                    fontSize="lg"
                    textTransform="uppercase"
                    letterSpacing="wide"
                    boxShadow="lg"
                    _hover={{
                      transform: "translateY(-2px)",
                      boxShadow: "2xl",
                      bgGradient: "linear(45deg, teal.600, green.600)"
                    }}
                    transition="all 0.3s ease"
                  >
                    Get Started Now
                  </Box>
                </MagicFloat>
              </VStack>
            </Box>
          </MagicPulse>
        </VStack>
      </MagicReveal>
    </Container>
  );
}

export { StackExp };
export default StackExp;
