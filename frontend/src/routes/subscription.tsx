import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  VStack,
  Text,
  useToast,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Container,
  Heading,
} from '@chakra-ui/react';
import { useAuth } from '@clerk/clerk-react';
import { useParams } from 'react-router-dom';
import api from '../services/axiosInstance';
import StripeSubscriptionManagement from '../Components/StripeSubscriptionManagement';

interface SubscriptionInfo {
  isPremium: boolean;
  expiresAt: Date | null;
  planType: string;
  isActive: boolean;
}

const SubscriptionPage: React.FC = () => {
  const { getToken } = useAuth();
  const { guildId } = useParams<{ guildId: string }>();
  const toast = useToast();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await api.get(`/subscription/${guildId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.status === 200) {
        setSubscription(response.data.data);
      } else {
        throw new Error(response.data.message || 'Failed to fetch subscription');
      }
    } catch (err: unknown) {
      console.error('Error fetching subscription:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch subscription';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [getToken, guildId, toast]);

  useEffect(() => {
    if (guildId) {
      fetchSubscription();
    }
  }, [guildId, fetchSubscription]);

  const handleSubscriptionUpdate = () => {
    fetchSubscription();
  };

  if (loading) {
    return (
      <Container maxW="container.md" py={8}>
        <Box textAlign="center">
          <Spinner size="xl" />
          <Text mt={4}>Loading subscription information...</Text>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxW="container.md" py={8}>
        <Alert status="error">
          <AlertIcon />
          <Box>
            <AlertTitle>Error loading subscription!</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Box>
        </Alert>
      </Container>
    );
  }

  if (!subscription) {
    return (
      <Container maxW="container.md" py={8}>
        <Alert status="warning">
          <AlertIcon />
          <AlertTitle>No subscription found</AlertTitle>
          <AlertDescription>
            Unable to load subscription information for this guild.
          </AlertDescription>
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxW="container.md" py={8}>
      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Heading size="lg" mb={2}>
            Subscription Management
          </Heading>
          <Text color="gray.600">
            Manage your premium subscription for this Discord server
          </Text>
        </Box>

        <StripeSubscriptionManagement
          guildId={guildId!}
          subscription={subscription}
          onSubscriptionUpdate={handleSubscriptionUpdate}
        />
      </VStack>
    </Container>
  );
};

export default SubscriptionPage;
