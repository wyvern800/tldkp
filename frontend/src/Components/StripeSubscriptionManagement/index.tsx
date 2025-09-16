import React, { useState } from 'react';
import {
  Box,
  Button,
  VStack,
  Text,
  useToast,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  HStack,
  Badge,
  Divider,
  Icon,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
} from '@chakra-ui/react';
import { FaCrown, FaCreditCard, FaTimes, FaCheck } from 'react-icons/fa';
import { useAuth } from '@clerk/clerk-react';
import api from '../../services/axiosInstance';
import StripeCheckout from '../StripeCheckout';

interface SubscriptionInfo {
  isPremium: boolean;
  expiresAt: Date | null;
  planType: string;
  isActive: boolean;
}

interface StripeSubscriptionManagementProps {
  guildId: string;
  subscription: SubscriptionInfo;
  onSubscriptionUpdate?: () => void;
}

const StripeSubscriptionManagement: React.FC<StripeSubscriptionManagementProps> = ({
  guildId,
  subscription,
  onSubscriptionUpdate,
}) => {
  const { getToken } = useAuth();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [loading, setLoading] = useState(false);

  const handleManageBilling = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const returnUrl = `${window.location.origin}/dashboard`;

      const response = await api.post(
        '/stripe/create-billing-portal-session',
        { returnUrl },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.status === 200) {
        window.location.href = response.data.data.url;
      } else {
        throw new Error(response.data.message || 'Failed to open billing portal');
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error('Billing portal error:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to open billing portal',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Never';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  };

  const getStatusBadge = () => {
    if (!subscription.isPremium) {
      return <Badge colorScheme="gray">Free</Badge>;
    }

    if (subscription.planType === 'lifetime') {
      return <Badge colorScheme="purple">Lifetime</Badge>;
    }

    if (subscription.isActive) {
      return <Badge colorScheme="green">Active</Badge>;
    }

    return <Badge colorScheme="red">Expired</Badge>;
  };

  const getStatusIcon = () => {
    if (!subscription.isPremium) {
      return <Icon as={FaTimes} color="gray.500" />;
    }

    if (subscription.isActive || subscription.planType === 'lifetime') {
      return <Icon as={FaCheck} color="green.500" />;
    }

    return <Icon as={FaTimes} color="red.500" />;
  };

  const getStatusText = () => {
    if (!subscription.isPremium) {
      return 'No active subscription';
    }

    if (subscription.planType === 'lifetime') {
      return 'Lifetime premium access';
    }

    if (subscription.isActive) {
      return `Premium active until ${formatDate(subscription.expiresAt)}`;
    }

    return `Premium expired on ${formatDate(subscription.expiresAt)}`;
  };

  return (
    <Box>
      <VStack spacing={4} align="stretch">
        <Box
          borderWidth={1}
          borderRadius="lg"
          p={6}
          bg="gray.800"
          borderColor="gray.700"
          shadow="lg"
        >
          <VStack spacing={4} align="stretch">
            <HStack justify="space-between" align="start">
              <VStack align="start" spacing={2}>
                <HStack>
                  <Icon as={FaCrown} color="yellow.500" />
                  <Text fontSize="lg" fontWeight="bold" color="white">
                    Premium Subscription
                  </Text>
                </HStack>
                <Text color="gray.300" fontSize="sm">
                  {getStatusText()}
                </Text>
              </VStack>
              {getStatusBadge()}
            </HStack>

            <Divider />

            <VStack spacing={3} align="stretch">
              <HStack justify="space-between">
                <Text fontSize="sm" color="gray.300">
                  Status
                </Text>
                <HStack>
                  {getStatusIcon()}
                  <Text fontSize="sm" fontWeight="medium" color="white">
                    {subscription.isPremium ? 'Premium' : 'Free'}
                  </Text>
                </HStack>
              </HStack>

              {subscription.isPremium && subscription.expiresAt && (
                <HStack justify="space-between">
                  <Text fontSize="sm" color="gray.300">
                    {subscription.planType === 'lifetime' ? 'Type' : 'Expires'}
                  </Text>
                  <Text fontSize="sm" fontWeight="medium" color="white">
                    {subscription.planType === 'lifetime' 
                      ? 'Lifetime' 
                      : formatDate(subscription.expiresAt)
                    }
                  </Text>
                </HStack>
              )}

              <HStack justify="space-between">
                <Text fontSize="sm" color="gray.300">
                  Plan Type
                </Text>
                <Text fontSize="sm" fontWeight="medium" color="white">
                  {subscription.planType.charAt(0).toUpperCase() + subscription.planType.slice(1)}
                </Text>
              </HStack>
            </VStack>

            <Divider />

            <VStack spacing={2} align="stretch">
              {!subscription.isPremium ? (
                <Button
                  colorScheme="green"
                  leftIcon={<Icon as={FaCrown} />}
                  onClick={onOpen}
                >
                  Upgrade to Premium
                </Button>
              ) : subscription.planType === 'lifetime' ? (
                <Text fontSize="sm" color="gray.300" textAlign="center" py={2}>
                  Lifetime Premium - No billing management needed
                </Text>
              ) : (
                <Button
                  colorScheme="blue"
                  variant="outline"
                  leftIcon={<Icon as={FaCreditCard} />}
                  onClick={handleManageBilling}
                  isLoading={loading}
                  loadingText="Opening..."
                >
                  Manage Billing
                </Button>
              )}
            </VStack>
          </VStack>
        </Box>

        {subscription.isPremium && (
          <Alert status="success">
            <AlertIcon />
            <Box>
              <AlertTitle>
                {subscription.planType === 'lifetime' 
                  ? 'Lifetime Premium Active!' 
                  : 'Premium Features Active!'
                }
              </AlertTitle>
              <AlertDescription>
                {subscription.planType === 'lifetime' 
                  ? 'You have lifetime access to all premium features including advanced auctions, priority support, and custom settings.'
                  : 'You have access to all premium features including advanced auctions, priority support, and custom settings.'
                }
              </AlertDescription>
            </Box>
          </Alert>
        )}
      </VStack>

      <Modal isOpen={isOpen} onClose={onClose} size="6xl">
        <ModalOverlay />
        <ModalContent bg="gray.800" borderColor="gray.700">
          <ModalHeader color="white">Upgrade to Premium</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <StripeCheckout
              guildId={guildId}
              onSuccess={() => {
                onClose();
                onSubscriptionUpdate?.();
                toast({
                  title: 'Success!',
                  description: 'Your subscription has been activated.',
                  status: 'success',
                  duration: 5000,
                  isClosable: true,
                });
              }}
              onCancel={() => {
                onClose();
              }}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default StripeSubscriptionManagement;
