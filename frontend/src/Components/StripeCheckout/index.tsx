/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import {
  Box,
  Button,
  VStack,
  Text,
  useToast,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Divider,
  Badge,
  HStack,
  Icon,
} from '@chakra-ui/react';
import { FaCrown, FaCheck } from 'react-icons/fa';
import { useAuth } from '@clerk/clerk-react';
import api from '../../services/axiosInstance';
import stripePromise from '../../services/stripe';

interface StripeProduct {
  id: string;
  name: string;
  description: string;
  default_price: {
    id: string;
    unit_amount: number;
    currency: string;
    recurring: {
      interval: string;
      interval_count: number;
    };
  };
}

interface StripeCheckoutProps {
  guildId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const StripeCheckout: React.FC<StripeCheckoutProps> = ({
  guildId,
}) => {
  const { getToken } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState<StripeProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/stripe/products');
      
      console.log('Stripe products response:', response.data);
      
      if (response.data.status === 200) {
        setProducts(response.data.data);
      } else {
        setError('Failed to load subscription plans');
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (priceId: string) => {
    try {
      setCheckoutLoading(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const successUrl = `${window.location.origin}/success?subscription=success`;
      const cancelUrl = `${window.location.origin}/dashboard?subscription=cancelled`;

      const response = await api.post(
        '/stripe/create-checkout-session',
        {
          priceId,
          guildId,
          successUrl,
          cancelUrl,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.status === 200) {
        const stripe = await stripePromise;
        if (!stripe) {
          throw new Error('Stripe failed to load');
        }

        const { error } = await stripe.redirectToCheckout({
          sessionId: response.data.data.sessionId,
        });

        if (error) {
          throw new Error(error.message);
        }
      } else {
        throw new Error(response.data.message || 'Failed to create checkout session');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'Failed to start checkout process');
      toast({
        title: 'Checkout Error',
        description: err.message || 'Failed to start checkout process',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatInterval = (interval: string, intervalCount: number) => {
    if (intervalCount === 1) {
      return interval;
    }
    return `every ${intervalCount} ${interval}s`;
  };

  if (loading) {
    return (
      <Box textAlign="center" py={8}>
        <Spinner size="xl" />
        <Text mt={4}>Loading subscription plans...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert status="error">
        <AlertIcon />
        <Box>
          <AlertTitle>Error loading plans!</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Box>
      </Alert>
    );
  }

  if (products.length === 0) {
    return (
      <Alert status="info">
        <AlertIcon />
        <AlertTitle>No subscription plans available</AlertTitle>
        <AlertDescription>
          Please contact support if you believe this is an error.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      <Box textAlign="center">
        <Text fontSize="2xl" fontWeight="bold" mb={2}>
          Upgrade to Premium
        </Text>
        <Text color="gray.600">
          Unlock advanced features for your Discord server
        </Text>
      </Box>

      <VStack spacing={4}>
        {products.map((product) => (
          <Box
            key={product.id}
            borderWidth={1}
            borderRadius="lg"
            p={6}
            w="full"
            maxW="md"
            bg="white"
            shadow="md"
            _hover={{ shadow: 'lg' }}
            transition="all 0.2s"
          >
            <VStack spacing={4} align="stretch">
              <HStack justify="space-between" align="start">
                <VStack align="start" spacing={1}>
                  <HStack>
                    <Icon as={FaCrown} color="yellow.500" />
                    <Text fontSize="xl" fontWeight="bold">
                      {product.name}
                    </Text>
                  </HStack>
                  <Text color="gray.600" fontSize="sm">
                    {product.description}
                  </Text>
                </VStack>
                <Badge colorScheme="green" fontSize="sm">
                  Premium
                </Badge>
              </HStack>

              <Divider />

              <VStack spacing={2} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="2xl" fontWeight="bold" color="green.500">
                    {product.default_price ? formatPrice(
                      product.default_price.unit_amount,
                      product.default_price.currency
                    ) : 'Price not available'}
                  </Text>
                  <Text color="gray.500">
                    {product.default_price?.recurring ? 
                      `/ ${formatInterval(
                        product.default_price.recurring.interval,
                        product.default_price.recurring.interval_count
                      )}` : 
                      '/ One-time'
                    }
                  </Text>
                </HStack>

                <VStack spacing={2} align="start" fontSize="sm">
                  <HStack>
                    <Icon as={FaCheck} color="green.500" />
                    <Text>Advanced auction features</Text>
                  </HStack>
                  <HStack>
                    <Icon as={FaCheck} color="green.500" />
                    <Text>Priority support</Text>
                  </HStack>
                  <HStack>
                    <Icon as={FaCheck} color="green.500" />
                    <Text>Custom bot settings</Text>
                  </HStack>
                  <HStack>
                    <Icon as={FaCheck} color="green.500" />
                    <Text>Analytics dashboard</Text>
                  </HStack>
                </VStack>
              </VStack>

              <Button
                colorScheme="green"
                size="lg"
                w="full"
                onClick={() => product.default_price && handleCheckout(product.default_price.id)}
                isLoading={checkoutLoading}
                loadingText="Processing..."
                leftIcon={<Icon as={FaCrown} />}
                isDisabled={!product.default_price}
              >
                {product.default_price ? 'Subscribe Now' : 'Price Not Available'}
              </Button>
            </VStack>
          </Box>
        ))}
      </VStack>

      <Box textAlign="center" fontSize="sm" color="gray.500">
        <Text>
          Secure payment processing by Stripe. Cancel anytime.
        </Text>
        <Text>
          Your subscription will be linked to this Discord server.
        </Text>
      </Box>
    </VStack>
  );
};

export default StripeCheckout;
