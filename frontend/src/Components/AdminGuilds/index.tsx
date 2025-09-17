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
  InputGroup,
  InputLeftElement,
  Spinner,
  Tooltip,
  Tag,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Divider,
  Avatar,
} from '@chakra-ui/react';
import { SearchIcon, ViewIcon, DeleteIcon } from '@chakra-ui/icons';
import { FaCrown, FaStar } from 'react-icons/fa';
import { useAuth } from '@clerk/clerk-react';
import api from '../../services/axiosInstance';

interface Guild {
  id: string;
  guildData: {
    id: string;
    name: string;
    ownerId: string;
    icon?: string;
    ownerDiscordData?: {
      displayName: string;
      avatarURL: string;
    };
  };
  subscription?: {
    isPremium: boolean;
    expiresAt: any;
    planType: string;
  };
  memberCount: number; // Only count, not full data
}

interface MemberDkp {
  userId: string;
  dkp: number;
  ign?: string;
  updatedAt?: string;
  discordData?: {
    displayName: string;
    avatarURL: string;
  };
  displayName?: string;
  avatarURL?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AdminGuildsProps {
  onGuildUpdate?: () => void;
}

const AdminGuilds: React.FC<AdminGuildsProps> = () => {
  const { getToken } = useAuth();
  const toast = useToast();
  const { isOpen: isViewOpen, onOpen: onViewOpen, onClose: onViewClose } = useDisclosure();
  
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
  const [memberDkps, setMemberDkps] = useState<MemberDkp[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const fetchGuilds = useCallback(async (page = 1, search = '', status = 'all', sort = 'name', order = 'asc') => {
    setLoading(true);
    try {
      const response = await api.get('/admin/guilds', {
        params: { 
          page, 
          search, 
          status, 
          sort, 
          order,
          limit: 20 
        },
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
    fetchGuilds(1, searchTerm, statusFilter, sortBy, sortOrder);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    fetchGuilds(1, searchTerm, status, sortBy, sortOrder);
  };

  const handleSort = (field: string) => {
    const newOrder = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortBy(field);
    setSortOrder(newOrder);
    fetchGuilds(pagination.page, searchTerm, statusFilter, field, newOrder);
  };

  const fetchMemberData = async (guildId: string) => {
    setLoadingMembers(true);
    try {
      const response = await api.get(`/admin/guilds/${guildId}/members`, {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
      });

      if (response.data.status === 200) {
        setMemberDkps(response.data.data.memberDkps);
        return response.data.data;
      }
    } catch (error) {
      console.error('Error fetching member data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch member data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleViewGuild = async (guild: Guild) => {
    setSelectedGuild(guild);
    setMemberDkps([]); // Clear previous data
    onViewOpen();
    
    // Fetch member data when modal opens
    await fetchMemberData(guild.id);
  };

  const handleCloseModal = () => {
    onViewClose();
    setMemberDkps([]); // Clear member data when modal closes
  };

  /*const handleDeleteGuild = async (guildId: string, guildName: string) => {
    if (!window.confirm(`Are you sure you want to delete guild "${guildName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await api.delete(`/admin/guilds/${guildId}`, {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
      });

      if (response.data.status === 200) {
        toast({
          title: 'Success',
          description: 'Guild deleted successfully',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
        fetchGuilds(pagination.page, searchTerm, statusFilter, sortBy, sortOrder);
        
        if (onGuildUpdate) {
          onGuildUpdate();
        }
      }
    } catch (error) {
      console.error('Error deleting guild:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete guild',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };*/

  const getStatusBadge = (guild: Guild) => {
    const subscription = guild.subscription || { isPremium: false, expiresAt: null, planType: 'free' };
    
    if (subscription.isPremium) {
      if (subscription.planType === 'lifetime') {
        return (
          <HStack spacing={1}>
            <FaStar color="#10B981" size={12} />
            <Badge colorScheme="purple">Lifetime</Badge>
          </HStack>
        );
      } else if (subscription.expiresAt) {
        const expirationDate = subscription.expiresAt._seconds 
          ? new Date(subscription.expiresAt._seconds * 1000)
          : new Date(subscription.expiresAt);
        const isActive = expirationDate > new Date();
        
        return (
          <HStack spacing={1}>
            <FaStar color={isActive ? "#10B981" : "#F59E0B"} size={12} />
            <Badge colorScheme={isActive ? "green" : "orange"}>
              {isActive ? "Premium" : "Expired"}
            </Badge>
          </HStack>
        );
      } else {
        return (
          <HStack spacing={1}>
            <FaStar color="#10B981" size={12} />
            <Badge colorScheme="green">Premium</Badge>
          </HStack>
        );
      }
    } else {
      return (
        <Badge colorScheme="gray">Free</Badge>
      );
    }
  };

  const getMemberCount = (guild: Guild) => {
    return guild.memberCount || 0;
  };

  const formatDate = (date: any) => {
    if (!date) return 'Never';
    
    const expirationDate = date._seconds 
      ? new Date(date._seconds * 1000)
      : new Date(date);
    
    return expirationDate.toLocaleDateString();
  };

  return (
    <Box>
      <VStack spacing={4} align="stretch">
        {/* Search and Filter Controls */}
        <Box>
          <HStack spacing={4} mb={4} wrap="wrap">
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
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              maxW="150px"
            >
              <option value="name">Sort by Name</option>
              <option value="members">Sort by Members</option>
              <option value="created">Sort by Created</option>
            </Select>
            <Button
              size="sm"
              onClick={() => handleSort(sortBy)}
              variant="outline"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </HStack>
        </Box>

        {/* Guilds Table */}
        <TableContainer>
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th cursor="pointer" onClick={() => handleSort('name')}>
                  Guild {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </Th>
                <Th>Owner</Th>
                <Th>Status</Th>
                <Th cursor="pointer" onClick={() => handleSort('members')}>
                  Members {sortBy === 'members' && (sortOrder === 'asc' ? '↑' : '↓')}
                </Th>
                <Th>Expires</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {loading ? (
                <Tr>
                  <Td colSpan={6} textAlign="center">
                    <Spinner size="lg" />
                  </Td>
                </Tr>
              ) : guilds.length === 0 ? (
                <Tr>
                  <Td colSpan={6} textAlign="center">
                    <Text>No guilds found</Text>
                  </Td>
                </Tr>
              ) : (
                guilds.map((guild) => (
                  <Tr key={guild.id}>
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
                    <Td>
                      <HStack>
                        <Text fontSize="sm">{guild.guildData?.ownerDiscordData?.displayName || 'Unknown'}</Text>
                        <FaCrown color="#FFD700" size={10} />
                      </HStack>
                    </Td>
                    <Td>{getStatusBadge(guild)}</Td>
                    <Td>
                      <Tag size="sm" colorScheme="blue">
                        {getMemberCount(guild)} members
                      </Tag>
                    </Td>
                    <Td>
                      <Text fontSize="sm">
                        {guild.subscription?.expiresAt ? formatDate(guild.subscription.expiresAt) : 'Never'}
                      </Text>
                    </Td>
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
                        {/*<Tooltip label="Delete Guild">
                          <IconButton
                            aria-label="Delete guild"
                            icon={<DeleteIcon />}
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => handleDeleteGuild(guild.id, guild.guildData.name)}
                          />
                        </Tooltip>*/}
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
              onClick={() => fetchGuilds(pagination.page - 1, searchTerm, statusFilter, sortBy, sortOrder)}
            >
              Previous
            </Button>
            <Text>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </Text>
            <Button
              isDisabled={pagination.page === pagination.totalPages}
              onClick={() => fetchGuilds(pagination.page + 1, searchTerm, statusFilter, sortBy, sortOrder)}
            >
              Next
            </Button>
          </HStack>
        )}
      </VStack>

      {/* View Guild Details Modal */}
      <Modal isOpen={isViewOpen} onClose={handleCloseModal} size="6xl">
        <ModalOverlay />
        <ModalContent maxH="90vh">
          <ModalHeader>
            <HStack>
              <Text>Guild Details - {selectedGuild?.guildData.name}</Text>
              {selectedGuild && getStatusBadge(selectedGuild)}
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6} overflowY="auto">
            {selectedGuild && (
              <VStack spacing={6} align="stretch">
                {/* Guild Info */}
                <Box>
                  <HStack spacing={4}>
                    <Avatar
                      size="lg"
                      src={selectedGuild.guildData.icon}
                      name={selectedGuild.guildData.name}
                    />
                    <VStack align="start" spacing={2}>
                      <Text fontSize="2xl" fontWeight="bold">
                        {selectedGuild.guildData.name}
                      </Text>
                      <Text color="gray.500">
                        ID: {selectedGuild.guildData.id}
                      </Text>
                      <HStack>
                        <Text color="gray.500">Owner:</Text>
                        <Text fontWeight="bold">
                          {selectedGuild.guildData.ownerDiscordData?.displayName || 'Unknown'}
                        </Text>
                        <FaCrown color="#FFD700" size={12} />
                      </HStack>
                      <HStack>
                        <Text color="gray.500">Members:</Text>
                        <Tag colorScheme="blue">
                          {getMemberCount(selectedGuild)} members
                        </Tag>
                      </HStack>
                    </VStack>
                  </HStack>
                </Box>

                <Divider />

                {/* Member DKP Table */}
                <Box>
                  <Text fontSize="lg" fontWeight="bold" mb={4}>
                    Member DKP List ({getMemberCount(selectedGuild)} members)
                  </Text>
                  
                  {loadingMembers ? (
                    <Box textAlign="center" py={8}>
                      <Spinner size="lg" />
                      <Text mt={2}>Loading member data...</Text>
                    </Box>
                  ) : memberDkps && memberDkps.length > 0 ? (
                    <TableContainer maxH="400px" overflowY="auto">
                      <Table size="sm" variant="simple">
                        <Thead position="sticky" top={0} bg="gray.800" zIndex={1}>
                          <Tr>
                            <Th color="white">Member</Th>
                            <Th color="white">IGN</Th>
                            <Th color="white">DKP</Th>
                            <Th color="white">Last Updated</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {memberDkps
                            .sort((a, b) => (b.dkp || 0) - (a.dkp || 0)) // Sort by DKP descending
                            .map((member, index) => (
                            <Tr key={member.userId || index}>
                              <Td>
                                <HStack>
                                  <Avatar
                                    size="sm"
                                    src={member.discordData?.avatarURL || member.avatarURL}
                                    name={member.discordData?.displayName || member.displayName || 'Unknown'}
                                    bg="gray.600"
                                  />
                                  <VStack align="start" spacing={0}>
                                    <Text fontSize="sm" fontWeight="medium">
                                      {member.discordData?.displayName || member.displayName || 'Unknown User'}
                                    </Text>
                                    <Text fontSize="xs" color="gray.500">
                                      {member.userId}
                                    </Text>
                                  </VStack>
                                </HStack>
                              </Td>
                              <Td>
                                <Text fontSize="sm">
                                  {member.ign || 'N/A'}
                                </Text>
                              </Td>
                              <Td>
                                <Badge
                                  colorScheme={member.dkp > 0 ? "green" : "gray"}
                                  variant="solid"
                                >
                                  {member.dkp || 0}
                                </Badge>
                              </Td>
                              <Td>
                                <Text fontSize="xs" color="gray.500">
                                  {member.updatedAt 
                                    ? new Date(member.updatedAt).toLocaleDateString()
                                    : 'N/A'
                                  }
                                </Text>
                              </Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Box textAlign="center" py={8}>
                      <Text color="gray.500">No members found</Text>
                    </Box>
                  )}
                </Box>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default AdminGuilds;
