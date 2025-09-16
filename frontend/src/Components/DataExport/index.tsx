/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  useToast,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Badge,
  Divider,
  Icon,
  IconButton,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Tag,
} from '@chakra-ui/react';
import { FaDownload, FaStar, FaHistory } from 'react-icons/fa';
import { useAuth } from '@clerk/clerk-react';
import api from '../../services/axiosInstance';

interface DataExportProps {
  guildId: string;
  guildName: string;
  isPremium: boolean;
  onExportComplete?: () => void;
}

interface ExportStatus {
  canExport: boolean;
  nextExportDate?: string;
  reason?: string;
  isPremium: boolean;
  exportHistory: Array<{
    id: string;
    exportType: string;
    timestamp: string;
  }>;
}

const DataExport: React.FC<DataExportProps> = ({
  guildId,
  guildName,
  isPremium,
  onExportComplete
}) => {
  const { getToken } = useAuth();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  const [exportStatus, setExportStatus] = useState<ExportStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'json'>('csv');

  useEffect(() => {
    if (isOpen) {
      fetchExportStatus();
    }
  }, [isOpen, guildId]);

  const fetchExportStatus = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await api.get(`/guilds/${guildId}/export/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.status === 200) {
        setExportStatus(response.data.data);
      } else {
        throw new Error(response.data.message || 'Failed to fetch export status');
      }
    } catch (error: any) {
      console.error('Error fetching export status:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch export status',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await api.post(
        `/guilds/${guildId}/export`,
        { format: selectedFormat },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: 'blob',
        }
      );

      // Create download link
      const blob = new Blob([response.data], {
        type: selectedFormat === 'csv' ? 'text/csv' : 'application/json'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `guild-${guildId}-members-${new Date().toISOString().split('T')[0]}.${selectedFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export Successful',
        description: `Data exported as ${selectedFormat.toUpperCase()}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Refresh export status
      await fetchExportStatus();
      onExportComplete?.();
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: error.response?.data?.message || 'Failed to export data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <>
      <IconButton
        icon={<Icon as={FaDownload} />}
        colorScheme="green"
        variant="ghost"
        size="sm"
        onClick={onOpen}
        isDisabled={loading}
        aria-label="Export Data"
        title="Export data to JSON or CSV"
      />

      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <HStack spacing={2}>
              <Icon as={FaDownload} />
              <Text>Export Guild Data</Text>
              {isPremium && (
                <Badge colorScheme="green">
                  <HStack spacing={1}>
                    <Icon as={FaStar} />
                    <Text>Premium</Text>
                  </HStack>
                </Badge>
              )}
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {loading ? (
              <Box textAlign="center" py={8}>
                <Spinner size="lg" />
                <Text mt={4}>Loading export status...</Text>
              </Box>
            ) : (
              <VStack spacing={6} align="stretch">
                {/* Guild Info */}
                <Box>
                  <Text fontSize="lg" fontWeight="bold" mb={2}>
                    {guildName}
                  </Text>
                  <Text color="gray.400" fontSize="sm">
                    Export member data including DKP, IGN, and Discord information
                  </Text>
                </Box>

                {/* Export Status */}
                {exportStatus && (
                  <Box>
                    <HStack spacing={4} mb={4}>
                      <Badge
                        colorScheme={exportStatus.canExport ? "green" : "orange"}
                        variant="solid"
                        px={3}
                        py={1}
                      >
                        {exportStatus.canExport ? "Ready to Export" : "Export Limited"}
                      </Badge>
                      {isPremium && (
                        <Badge colorScheme="purple" variant="outline">
                          Unlimited Exports
                        </Badge>
                      )}
                    </HStack>

                    {!exportStatus.canExport && exportStatus.reason && (
                      <Alert status="warning" mb={4}>
                        <AlertIcon />
                        <Box>
                          <AlertTitle>Export Limited</AlertTitle>
                          <AlertDescription>{exportStatus.reason}</AlertDescription>
                          {exportStatus.nextExportDate && (
                            <Text fontSize="sm" mt={2}>
                              Next export available: {formatDate(exportStatus.nextExportDate)}
                            </Text>
                          )}
                        </Box>
                      </Alert>
                    )}
                  </Box>
                )}

                {/* Format Selection */}
                <Box>
                  <Text fontWeight="bold" mb={3}>Export Format</Text>
                  <HStack spacing={4}>
                    <Button
                      variant={selectedFormat === 'csv' ? 'solid' : 'outline'}
                      colorScheme="blue"
                      onClick={() => setSelectedFormat('csv')}
                      size="sm"
                    >
                      CSV
                    </Button>
                    <Button
                      variant={selectedFormat === 'json' ? 'solid' : 'outline'}
                      colorScheme="blue"
                      onClick={() => setSelectedFormat('json')}
                      size="sm"
                    >
                      JSON
                    </Button>
                  </HStack>
                  <Text fontSize="sm" color="gray.500" mt={2}>
                    {selectedFormat === 'csv' 
                      ? 'Comma-separated values, compatible with Excel and Google Sheets'
                      : 'JavaScript Object Notation, structured data format'
                    }
                  </Text>
                </Box>

                {/* Export History */}
                {exportStatus?.exportHistory && exportStatus.exportHistory.length > 0 && (
                  <Box>
                    <HStack spacing={2} mb={3}>
                      <Icon as={FaHistory} />
                      <Text fontWeight="bold">Recent Exports</Text>
                    </HStack>
                    <TableContainer>
                      <Table size="sm">
                        <Thead>
                          <Tr>
                            <Th>Date</Th>
                            <Th>Format</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {exportStatus.exportHistory.slice(0, 5).map((exportItem) => (
                            <Tr key={exportItem.id}>
                              <Td>{formatDate(exportItem.timestamp)}</Td>
                              <Td>
                                <Tag size="sm" colorScheme="blue">
                                  {exportItem.exportType.toUpperCase()}
                                </Tag>
                              </Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}

                <Divider />

                {/* Export Button */}
                <Box>
                  <Button
                    colorScheme="blue"
                    size="lg"
                    width="full"
                    leftIcon={<Icon as={FaDownload} />}
                    onClick={handleExport}
                    isLoading={exporting}
                    loadingText="Exporting..."
                    isDisabled={!exportStatus?.canExport || exporting}
                  >
                    {exporting ? 'Exporting...' : `Export as ${selectedFormat.toUpperCase()}`}
                  </Button>
                  
                  {!isPremium && (
                    <Text fontSize="sm" color="gray.600" mt={2} textAlign="center">
                      Free users: 1 export per week • Premium: Unlimited exports
                    </Text>
                  )}
                </Box>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default DataExport;
