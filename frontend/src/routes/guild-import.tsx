/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Spinner,
  Center,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Container,
} from '@chakra-ui/react';
import { IoChevronForward } from 'react-icons/io5';
import { useAuth } from '@clerk/clerk-react';
import api from '../services/axiosInstance';
import DataImport from '../Components/DataImport';

export default function GuildImportPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const { getToken, isLoaded } = useAuth();
  const navigate = useNavigate();
  const [guildData, setGuildData] = useState<{
    guildData?: { name?: string; ownerId?: string };
    memberDkps?: Array<{ userId: string; dkp: number; ign?: string }>;
    subscription?: { isPremium: boolean; expiresAt: any; planType: string };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userDiscordId, setUserDiscordId] = useState<string | null>(null);

  useEffect(() => {
    const fetchGuildData = async () => {
      if (!isLoaded || !guildId) return;

      try {
        setLoading(true);
        setError(null);


        const response = await api.get(`/guilds/${guildId}`, {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        });

        if (response.data.status === 200) {
          setGuildData(response.data.data);
          setUserDiscordId(response.data.data.userDiscordId);
        } else {
          setError('Failed to load guild data');
        }
      } catch (err) {
        console.error('Error fetching guild data:', err);
        setError('Failed to load guild data');
      } finally {
        setLoading(false);
      }
    };

    fetchGuildData();
  }, [isLoaded, guildId, getToken]);

  const handleImportComplete = async () => {
    // Refresh guild data after import
    if (!isLoaded || !guildId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await api.get(`/guilds/${guildId}`, {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
      });

      if (response.data.status === 200) {
        setGuildData(response.data.data);
        setUserDiscordId(response.data.data.userDiscordId);
      } else {
        setError('Failed to load guild data');
      }
    } catch (err) {
      console.error('Error fetching guild data:', err);
      setError('Failed to load guild data');
    } finally {
      setLoading(false);
    }
  };

  const isGuildPremium = () => {
    if (!guildData?.subscription) return false;
    
    const { isPremium, expiresAt } = guildData.subscription;
    if (!isPremium) return false;
    
    // Check if subscription has expired
    if (expiresAt) {
      const now = new Date();
      const expiryDate = expiresAt._seconds 
        ? new Date(expiresAt._seconds * 1000)
        : new Date(expiresAt);
      
      return expiryDate > now;
    }
    
    return true;
  };

  const isGuildOwner = () => {
    return userDiscordId && guildData?.guildData?.ownerId === userDiscordId;
  };

  if (loading) {
    return (
      <Center py={8}>
        <Spinner size="lg" />
      </Center>
    );
  }

  if (error || !guildData) {
    return (
      <Alert status="error">
        <AlertIcon />
        <AlertTitle>Error!</AlertTitle>
        <AlertDescription>{error || 'Guild not found'}</AlertDescription>
      </Alert>
    );
  }

  if (!isGuildOwner()) {
    return (
      <Alert status="error">
        <AlertIcon />
        <AlertTitle>Access Denied!</AlertTitle>
        <AlertDescription>
          Only the guild owner can access the data import page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={6} align="stretch">
        {/* Breadcrumb */}
        <Breadcrumb separator={<IoChevronForward color="gray.500" />}>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate('/dashboard')}>
              Dashboard
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate('/dashboard')}>
              My Guilds
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <Text color="gray.500">
              Import Data - {guildData.guildData?.name || 'Unknown Guild'}
            </Text>
          </BreadcrumbItem>
        </Breadcrumb>

        {/* Header */}
        <Box>
          <Text fontSize="2xl" fontWeight="bold">
            📥 Import Member Data
          </Text>
          <Text color="gray.600" mt={2}>
            Import your existing member DKP and IGN data from a CSV file to quickly set up your guild.
          </Text>
        </Box>

        {/* Import Component */}
        {isGuildPremium() ? (
          <DataImport 
            guildId={guildId!} 
            onImportComplete={handleImportComplete}
          />
        ) : (
          <Box p={6} border="1px" borderColor="yellow.600" borderRadius="md" bg="yellow.900">
            <VStack spacing={4} align="center">
              <Text fontSize="xl" fontWeight="bold" color="yellow.200">
                ⭐ Premium Required
              </Text>
              <Text color="yellow.100" textAlign="center">
                Data importing is a premium feature. Upgrade your guild to premium to import member data from CSV files.
              </Text>
              <Text fontSize="sm" color="yellow.200" textAlign="center">
                Contact an administrator to upgrade your guild's subscription.
              </Text>
            </VStack>
          </Box>
        )}

        {/* Guild Info */}
        <Box p={4} border="1px" borderColor="gray.600" borderRadius="md" bg="gray.800">
          <VStack align="start" spacing={2}>
            <Text fontWeight="bold">Guild Information</Text>
            <Text fontSize="sm" color="gray.300">
              <strong>Guild Name:</strong> {guildData.guildData?.name || 'Unknown'}
            </Text>
            <Text fontSize="sm" color="gray.300">
              <strong>Guild ID:</strong> {guildId}
            </Text>
            <Text fontSize="sm" color="gray.300">
              <strong>Current Members:</strong> {guildData.memberDkps?.length || 0}
            </Text>
            <Text fontSize="sm" color="gray.300">
              <strong>Premium Status:</strong> {isGuildPremium() ? (
                <Text as="span" color="green.300">⭐ Premium Active</Text>
              ) : (
                <Text as="span" color="red.300">❌ Not Premium</Text>
              )}
            </Text>
            <Text fontSize="sm" color="gray.300">
              <strong>Your Role:</strong> {isGuildOwner() ? (
                <Text as="span" color="blue.300">👑 Guild Owner</Text>
              ) : (
                <Text as="span" color="gray.400">👤 Member</Text>
              )}
            </Text>
          </VStack>
        </Box>

        {/* Back Button */}
        <HStack justify="center">
          <Button
            onClick={() => navigate('/guilds')}
            variant="outline"
            colorScheme="gray"
          >
            ← Back to My Guilds
          </Button>
        </HStack>
      </VStack>
    </Container>
  );
}
