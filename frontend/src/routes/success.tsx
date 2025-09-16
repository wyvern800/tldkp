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
  
  const bg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");

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
                color={isSubscriptionSuccess ? "yellow.500" : "green.500"}
              />
              
              <VStack spacing={2}>
                <Heading size="lg" color={isSubscriptionSuccess ? "yellow.600" : "green.600"}>
                  {isSubscriptionSuccess ? 'Subscription Successful!' : 'Success!'}
                </Heading>
                <Text color="gray.600" fontSize="lg">
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
                  colorScheme={isSubscriptionSuccess ? "yellow" : "green"}
                  size="lg"
                  w="full"
                  onClick={() => navigate('/dashboard')}
                >
                  Go to Dashboard
                </Button>
                
                <Button
                  variant="outline"
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
                <Heading size="md" color="gray.700">
                  What's Next?
                </Heading>
                <VStack spacing={2} align="start" fontSize="sm" color="gray.600">
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
