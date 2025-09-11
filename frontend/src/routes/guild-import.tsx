import React, { useState, useEffect } from 'react';
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
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGuildData = async () => {
      if (!isLoaded || !guildId) return;

      try {
        setLoading(true);
        setError(null);

        const token = await getToken();
        const response = await api.get(`/guilds/${guildId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.data.status === 200) {
          setGuildData(response.data.data);
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

  const handleImportComplete = () => {
    // Refresh guild data after import
    window.location.reload();
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

  return (
    <Box p={6}>
      <VStack spacing={6} align="stretch">
        {/* Breadcrumb */}
        <Breadcrumb separator={<IoChevronForward color="gray.500" />}>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate('/dashboard')}>
              Dashboard
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate('/guilds')}>
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
        <DataImport 
          guildId={guildId!} 
          onImportComplete={handleImportComplete}
        />

        {/* Guild Info */}
        <Box p={4} border="1px" borderColor="gray.200" borderRadius="md" bg="gray.50">
          <VStack align="start" spacing={2}>
            <Text fontWeight="bold">Guild Information</Text>
            <Text fontSize="sm" color="gray.600">
              <strong>Guild Name:</strong> {guildData.guildData?.name || 'Unknown'}
            </Text>
            <Text fontSize="sm" color="gray.600">
              <strong>Guild ID:</strong> {guildId}
            </Text>
            <Text fontSize="sm" color="gray.600">
              <strong>Current Members:</strong> {guildData.memberDkps?.length || 0}
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
    </Box>
  );
}
