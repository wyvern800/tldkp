/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  HStack,
  Text,
  IconButton,
  useToast,
  Button,
  Input,
  Select,
  VStack,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Switch,
  InputGroup,
  InputLeftElement,
  Spinner,
  useDisclosure,
  Divider,
  Tooltip,
} from '@chakra-ui/react';
import { SearchIcon, EditIcon, ViewIcon } from '@chakra-ui/icons';
import { FaClock, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { useAuth } from '@clerk/clerk-react';
import api from '../../services/axiosInstance';

interface SubscriptionStatus {
  isPremium: boolean;
  expiresAt: Date | null;
  planType: string;
  isActive: boolean;
}

interface Guild {
  guildData: {
    id: string;
    name: string;
    ownerId: string;
    icon: string;
  };
  subscription?: {
    isPremium: boolean;
    expiresAt: any;
    planType: string;
  };
  subscriptionStatus: SubscriptionStatus;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface SubscriptionManagementProps {
  onSubscriptionUpdate?: () => void;
}

const SubscriptionManagement: React.FC<SubscriptionManagementProps> = ({ onSubscriptionUpdate }) => {
  const { getToken } = useAuth();
  const toast = useToast();
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const { isOpen: isViewOpen, onOpen: onViewOpen, onClose: onViewClose } = useDisclosure();
  
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
  const [editForm, setEditForm] = useState({
    isPremium: false,
    expiresAt: '',
    planType: 'free'
  });

  const fetchGuilds = useCallback(async (page = 1, search = '', status = 'all') => {
    setLoading(true);
    try {
      const response = await api.get('/admin/subscriptions', {
        params: { page, search, status, limit: 20 },
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
      });

      if (response.data.status === 200) {
        setGuilds(response.data.data.guilds);
        setPagination(response.data.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching guilds:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch guilds',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [getToken, toast]);

  useEffect(() => {
    fetchGuilds();
  }, [fetchGuilds]);


  const handleSearch = () => {
    fetchGuilds(1, searchTerm, statusFilter);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    fetchGuilds(1, searchTerm, status);
  };

  const handleEditGuild = (guild: Guild) => {
    setSelectedGuild(guild);
    setEditForm({
      isPremium: guild.subscriptionStatus.isPremium,
      expiresAt: guild.subscriptionStatus.expiresAt 
        ? new Date(guild.subscriptionStatus.expiresAt).toISOString().split('T')[0]
        : '',
      planType: guild.subscriptionStatus.planType
    });
    onEditOpen();
  };

  const handleViewGuild = (guild: Guild) => {
    setSelectedGuild(guild);
    onViewOpen();
  };

  const handleUpdateSubscription = async () => {
    if (!selectedGuild) return;

    try {
      const response = await api.put(`/admin/subscriptions/${selectedGuild.guildData.id}`, editForm, {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
      });

      if (response.data.status === 200) {
        toast({
          title: 'Success',
          description: 'Subscription updated successfully',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
        onEditClose();
        fetchGuilds(pagination.page, searchTerm, statusFilter);
        
        // Notify parent component to refresh premium count
        if (onSubscriptionUpdate) {
          onSubscriptionUpdate();
        }
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast({
        title: 'Error',
        description: 'Failed to update subscription',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const getStatusBadge = (subscription: SubscriptionStatus) => {
    if (subscription.isActive) {
      return (
        <HStack spacing={1}>
          <FaCheckCircle color="green" />
          <Badge colorScheme="green">
            Active Premium
          </Badge>
        </HStack>
      );
    } else if (subscription.isPremium && !subscription.isActive) {
      return (
        <HStack spacing={1}>
          <FaClock color="orange" />
          <Badge colorScheme="orange">
            Expired
          </Badge>
        </HStack>
      );
    } else {
      return (
        <HStack spacing={1}>
          <FaTimesCircle color="gray" />
          <Badge colorScheme="gray">
            Free
          </Badge>
        </HStack>
      );
    }
  };

  const getPlanTypeBadge = (planType: string) => {
    const colors = {
      free: 'gray',
      trial: 'orange',
      premium: 'blue',
      lifetime: 'purple'
    };
    
    return (
      <Badge colorScheme={colors[planType as keyof typeof colors] || 'gray'}>
        {planType.charAt(0).toUpperCase() + planType.slice(1)}
      </Badge>
    );
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString();
  };

  return (
    <Box>
      <VStack spacing={4} align="stretch">
        {/* Search and Filter Controls */}
        <Box>
          <HStack spacing={4} mb={4}>
            <InputGroup maxW="300px">
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.300" />
              </InputLeftElement>
              <Input
                placeholder="Search guilds..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </InputGroup>
            <Button onClick={handleSearch} colorScheme="teal">
              Search
            </Button>
            <Select
              value={statusFilter}
              onChange={(e) => handleStatusFilter(e.target.value)}
              maxW="200px"
            >
              <option value="all">All Status</option>
              <option value="premium">Premium</option>
              <option value="expired">Expired</option>
              <option value="free">Free</option>
            </Select>
          </HStack>
        </Box>

        {/* Guilds Table */}
        <TableContainer>
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th>Guild</Th>
                <Th>Status</Th>
                <Th>Plan</Th>
                <Th>Expires</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {loading ? (
                <Tr>
                  <Td colSpan={5} textAlign="center">
                    <Spinner size="lg" />
                  </Td>
                </Tr>
              ) : guilds.length === 0 ? (
                <Tr>
                  <Td colSpan={5} textAlign="center">
                    <Text>No guilds found</Text>
                  </Td>
                </Tr>
              ) : (
                guilds.map((guild) => (
                  <Tr key={guild.guildData.id}>
                    <Td>
                      <HStack>
                        <Box
                          w="32px"
                          h="32px"
                          borderRadius="50%"
                          bg="gray.200"
                          backgroundImage={guild.guildData.icon ? `url(${guild.guildData.icon})` : 'none'}
                          backgroundSize="cover"
                          backgroundPosition="center"
                        />
                        <VStack align="start" spacing={0}>
                          <Text fontWeight="bold">{guild.guildData.name}</Text>
                          <Text fontSize="xs" color="gray.500">
                            ID: {guild.guildData.id}
                          </Text>
                        </VStack>
                      </HStack>
                    </Td>
                    <Td>{getStatusBadge(guild.subscriptionStatus)}</Td>
                    <Td>{getPlanTypeBadge(guild.subscriptionStatus.planType)}</Td>
                    <Td>{formatDate(guild.subscriptionStatus.expiresAt)}</Td>
                    <Td>
                      <HStack spacing={2}>
                        <Tooltip label="View Details">
                          <IconButton
                            aria-label="View guild"
                            icon={<ViewIcon />}
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewGuild(guild)}
                          />
                        </Tooltip>
                        <Tooltip label="Edit Subscription">
                          <IconButton
                            aria-label="Edit subscription"
                            icon={<EditIcon />}
                            size="sm"
                            variant="ghost"
                            colorScheme="blue"
                            onClick={() => handleEditGuild(guild)}
                          />
                        </Tooltip>
                      </HStack>
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <HStack justify="center" spacing={2}>
            <Button
              isDisabled={pagination.page === 1}
              onClick={() => fetchGuilds(pagination.page - 1, searchTerm, statusFilter)}
            >
              Previous
            </Button>
            <Text>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </Text>
            <Button
              isDisabled={pagination.page === pagination.totalPages}
              onClick={() => fetchGuilds(pagination.page + 1, searchTerm, statusFilter)}
            >
              Next
            </Button>
          </HStack>
        )}
      </VStack>

      {/* Edit Subscription Modal */}
      <Modal isOpen={isEditOpen} onClose={onEditClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Subscription - {selectedGuild?.guildData.name}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="isPremium" mb="0">
                  Premium Access
                </FormLabel>
                <Switch
                  id="isPremium"
                  isChecked={editForm.isPremium}
                  onChange={(e) => setEditForm({ ...editForm, isPremium: e.target.checked })}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Plan Type</FormLabel>
                <Select
                  value={editForm.planType}
                  onChange={(e) => setEditForm({ ...editForm, planType: e.target.value })}
                >
                  <option value="free">Free</option>
                  <option value="trial">Trial (7 days)</option>
                  <option value="premium">Premium (Monthly)</option>
                  <option value="lifetime">Lifetime</option>
                </Select>
              </FormControl>

              {editForm.isPremium && (editForm.planType === 'premium' || editForm.planType === 'trial') && (
                <FormControl>
                  <FormLabel>Expiration Date</FormLabel>
                  <Input
                    type="date"
                    value={editForm.expiresAt}
                    onChange={(e) => setEditForm({ ...editForm, expiresAt: e.target.value })}
                  />
                  {editForm.planType === 'trial' && (
                    <Text fontSize="sm" color="gray.500" mt={1}>
                      Trial plans automatically expire after 7 days if no date is set
                    </Text>
                  )}
                </FormControl>
              )}

              <HStack spacing={4} w="full">
                <Button onClick={onEditClose} flex={1}>
                  Cancel
                </Button>
                <Button colorScheme="blue" onClick={handleUpdateSubscription} flex={1}>
                  Update Subscription
                </Button>
              </HStack>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* View Guild Details Modal */}
      <Modal isOpen={isViewOpen} onClose={onViewClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Guild Details - {selectedGuild?.guildData.name}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {selectedGuild && (
              <VStack spacing={4} align="stretch">
                <HStack>
                  <Box
                    w="64px"
                    h="64px"
                    borderRadius="50%"
                    bg="gray.200"
                    backgroundImage={selectedGuild.guildData.icon ? `url(${selectedGuild.guildData.icon})` : 'none'}
                    backgroundSize="cover"
                    backgroundPosition="center"
                  />
                  <VStack align="start" spacing={1}>
                    <Text fontSize="xl" fontWeight="bold">{selectedGuild.guildData.name}</Text>
                    <Text fontSize="sm" color="gray.500">ID: {selectedGuild.guildData.id}</Text>
                    <Text fontSize="sm" color="gray.500">Owner: <Text as="span" color="blue.400">{selectedGuild.guildData.ownerId}</Text></Text>
                  </VStack>
                </HStack>

                <Divider />

                <VStack spacing={3} align="stretch">
                  <HStack justify="space-between">
                    <Text fontWeight="bold">Subscription Status:</Text>
                    {getStatusBadge(selectedGuild.subscriptionStatus)}
                  </HStack>
                  
                  <HStack justify="space-between">
                    <Text fontWeight="bold">Plan Type:</Text>
                    {getPlanTypeBadge(selectedGuild.subscriptionStatus.planType)}
                  </HStack>
                  
                  <HStack justify="space-between">
                    <Text fontWeight="bold">Expires At:</Text>
                    <Text>{formatDate(selectedGuild.subscriptionStatus.expiresAt)}</Text>
                  </HStack>
                </VStack>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default SubscriptionManagement;
