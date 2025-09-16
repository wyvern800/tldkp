import React from 'react';
import {
  Box,
  Container,
  VStack,
  Text,
  Heading,
  Icon,
  Button,
  useColorModeValue,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react';
import { FaCheckCircle, FaCrown } from 'react-icons/fa';
import { useNavigate, useSearchParams } from 'react-router-dom';

const SuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const subscription = searchParams.get('subscription');
  
  const bg = useColorModeValue("gray.50", "gray.900");// Dark background as per guidelines
  const cardBg = "#1F2937"; // Slightly lighter dark for cards
  const borderColor = "#374151"; // Subtle border color

  const isSubscriptionSuccess = subscription === 'success';

  return (
    <Box minH="100vh" bg={bg}>
      <Container maxW="container.md" py={16}>
        <VStack spacing={8} align="center">
          <Box
            p={8}
            bg={cardBg}
            borderRadius="xl"
            shadow="xl"
            borderWidth={1}
            borderColor={borderColor}
            textAlign="center"
            maxW="md"
            w="full"
          >
            <VStack spacing={6}>
              <Icon
                as={isSubscriptionSuccess ? FaCrown : FaCheckCircle}
                boxSize={20}
                color={isSubscriptionSuccess ? "#F59E0B" : "#0F766E"}
              />
              
              <VStack spacing={2}>
                <Heading size="lg" color={isSubscriptionSuccess ? "#F59E0B" : "#0F766E"}>
                  {isSubscriptionSuccess ? 'Subscription Successful!' : 'Success!'}
                </Heading>
                <Text color="#D1D5DB" fontSize="lg">
                  {isSubscriptionSuccess 
                    ? 'Your premium subscription has been activated successfully!' 
                    : 'Your request has been processed successfully.'
                  }
                </Text>
              </VStack>

              {isSubscriptionSuccess && (
                <Alert status="success" borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Premium Features Unlocked!</AlertTitle>
                    <AlertDescription>
                      You now have access to all premium features including advanced auctions, 
                      priority support, and custom settings.
                    </AlertDescription>
                  </Box>
                </Alert>
              )}

              <VStack spacing={4} w="full">
                <Button
                  bg={isSubscriptionSuccess ? "#F59E0B" : "#0F766E"}
                  color="white"
                  _hover={{ bg: isSubscriptionSuccess ? "#D97706" : "#0D6B5F" }}
                  size="lg"
                  w="full"
                  onClick={() => navigate('/dashboard')}
                >
                  Go to Dashboard
                </Button>
                
                <Button
                  variant="outline"
                  borderColor="#6B7280"
                  color="#D1D5DB"
                  _hover={{ bg: "#374151", borderColor: "#9CA3AF" }}
                  size="md"
                  w="full"
                  onClick={() => navigate('/')}
                >
                  Back to Home
                </Button>
              </VStack>
            </VStack>
          </Box>

          {isSubscriptionSuccess && (
            <Box
              p={6}
              bg={cardBg}
              borderRadius="lg"
              shadow="md"
              borderWidth={1}
              borderColor={borderColor}
              w="full"
            >
              <VStack spacing={4} align="start">
                <Heading size="md" color="#F59E0B">
                  What's Next?
                </Heading>
                <VStack spacing={2} align="start" fontSize="sm" color="#D1D5DB">
                  <Text>• Your Discord server now has premium access</Text>
                  <Text>• Advanced auction features are now available</Text>
                  <Text>• You can manage your subscription anytime</Text>
                  <Text>• Check your email for the receipt</Text>
                </VStack>
              </VStack>
            </Box>
          )}
        </VStack>
      </Container>
    </Box>
  );
};

export default SuccessPage;
