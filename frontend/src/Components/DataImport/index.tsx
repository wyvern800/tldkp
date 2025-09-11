/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useToast,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Divider,
  Code,
  Icon,
} from '@chakra-ui/react';
import { FaDownload, FaUpload, FaCheck, FaTimes } from 'react-icons/fa';
import api from '../../services/axiosInstance';

interface ImportMember {
  userId: string;
  ign: string | null;
  dkp: number;
  status: 'valid' | 'invalid' | 'duplicate';
  errors?: string[];
}

interface DataImportProps {
  guildId: string;
  onImportComplete?: () => void;
}

export default function DataImport({ guildId, onImportComplete }: DataImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ImportMember[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select a CSV file (.csv extension)',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      if (selectedFile.size > 1024 * 1024) { // 1MB limit
        toast({
          title: 'File too large',
          description: 'Maximum file size is 1MB',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      setFile(selectedFile);
      setErrors([]);
      setParsedData([]);
      setImportResults(null);
    }
  };

  const parseCSV = (csvContent: string): ImportMember[] => {
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV file is empty or invalid');
    }

    // Validate header
    const header = lines[0].toLowerCase().trim();
    const expectedHeader = 'discord_user_id,ign,dkp';
    if (header !== expectedHeader) {
      throw new Error(`Invalid CSV format. Expected header: ${expectedHeader}, Found: ${header}`);
    }

    const members: ImportMember[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const columns = line.split(',');
      if (columns.length !== 3) {
        errors.push(`Row ${i + 1}: Invalid number of columns (expected 3, found ${columns.length})`);
        continue;
      }

      const [discordUserId, ign, dkpStr] = columns.map(col => col.trim());
      const memberErrors: string[] = [];

      // Validate Discord User ID
      if (!discordUserId || !/^\d{17,19}$/.test(discordUserId)) {
        memberErrors.push(`Invalid Discord User ID: ${discordUserId}`);
      }

      // Validate DKP
      const dkp = parseInt(dkpStr);
      if (isNaN(dkp) || dkp < 0) {
        memberErrors.push(`Invalid DKP amount: ${dkpStr}`);
      }

      // Validate IGN (optional)
      const cleanIGN = ign && ign !== '' ? ign.trim() : null;
      if (cleanIGN && (cleanIGN.length < 2 || cleanIGN.length > 20)) {
        memberErrors.push(`Invalid IGN length: ${cleanIGN} (must be 2-20 characters)`);
      }

      members.push({
        userId: discordUserId,
        ign: cleanIGN,
        dkp: dkp,
        status: memberErrors.length > 0 ? 'invalid' : 'valid',
        errors: memberErrors.length > 0 ? memberErrors : undefined
      });
    }

    if (errors.length > 0) {
      setErrors(errors);
    }

    return members;
  };

  const handleProcessFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    setErrors([]);

    try {
      const csvContent = await file.text();
      const parsed = parseCSV(csvContent);

      if (parsed.length > 100) {
        toast({
          title: 'Too many members',
          description: 'Maximum 100 members per import',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        setIsProcessing(false);
        return;
      }

      if (parsed.length === 0) {
        toast({
          title: 'No valid data',
          description: 'No valid member data found in the CSV file',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        setIsProcessing(false);
        return;
      }

      setParsedData(parsed);
      onOpen();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse CSV file';
      toast({
        title: 'Parse Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!file || parsedData.length === 0) return;

    const validMembers = parsedData.filter(member => member.status === 'valid');
    if (validMembers.length === 0) {
      toast({
        title: 'No valid members',
        description: 'Please fix the errors before importing',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsImporting(true);

    try {
      // Convert to CSV format for the API
      const csvContent = [
        'discord_user_id,ign,dkp',
        ...validMembers.map(member => `${member.userId},${member.ign || ''},${member.dkp}`)
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', blob, 'import.csv');

      const response = await api.post(`/admin/import/${guildId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.status === 200) {
        setImportResults(response.data.data);
        toast({
          title: 'Import Successful',
          description: `Successfully imported ${validMembers.length} members`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
        
        onImportComplete?.();
        onClose();
      } else {
        throw new Error(response.data.message || 'Import failed');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Import Failed',
        description: 'Failed to import member data. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = `discord_user_id,ign,dkp
123456789012345678,PlayerName1,100
987654321098765432,PlayerName2,250
555666777888999000,PlayerName3,75`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'member_import_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const validCount = parsedData.filter(m => m.status === 'valid').length;
  const invalidCount = parsedData.filter(m => m.status === 'invalid').length;

  return (
    <Box>
      <VStack spacing={6} align="stretch">
        <Box>
          <Text fontSize="xl" fontWeight="bold" mb={4}>
            📥 Import Member Data
          </Text>
          <Text color="gray.600" mb={4}>
            Import member DKP and IGN data from a CSV file to quickly set up your guild.
          </Text>
        </Box>

        {/* Template Download */}
        <Box p={4} border="1px" borderColor="gray.200" borderRadius="md" bg="gray.50">
          <HStack justify="space-between">
            <VStack align="start" spacing={2}>
              <Text fontWeight="bold">📋 Download Template</Text>
              <Text fontSize="sm" color="gray.600">
                Get the CSV template with the correct format and example data
              </Text>
            </VStack>
            <Button
              leftIcon={<Icon as={FaDownload} />}
              onClick={downloadTemplate}
              colorScheme="blue"
              variant="outline"
            >
              Download Template
            </Button>
          </HStack>
        </Box>

        {/* File Upload */}
        <Box p={4} border="1px" borderColor="gray.200" borderRadius="md">
          <VStack spacing={4}>
            <HStack justify="space-between" w="full">
              <Text fontWeight="bold">📁 Upload CSV File</Text>
              <Text fontSize="sm" color="gray.500">
                Max 1MB, CSV format only
              </Text>
            </HStack>
            
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button
                as="span"
                leftIcon={<Icon as={FaUpload} />}
                colorScheme="green"
                variant="outline"
                cursor="pointer"
              >
                {file ? file.name : 'Choose CSV File'}
              </Button>
            </label>

            {file && (
              <Button
                onClick={handleProcessFile}
                isLoading={isProcessing}
                loadingText="Processing..."
                colorScheme="blue"
                isDisabled={isProcessing}
              >
                Process File
              </Button>
            )}
          </VStack>
        </Box>

        {/* Errors */}
        {errors.length > 0 && (
          <Alert status="error">
            <AlertIcon />
            <Box>
              <AlertTitle>Parse Errors Found!</AlertTitle>
              <AlertDescription>
                <VStack align="start" spacing={1} mt={2}>
                  {errors.slice(0, 5).map((error, index) => (
                    <Text key={index} fontSize="sm">• {error}</Text>
                  ))}
                  {errors.length > 5 && (
                    <Text fontSize="sm" color="gray.500">
                      ... and {errors.length - 5} more errors
                    </Text>
                  )}
                </VStack>
              </AlertDescription>
            </Box>
          </Alert>
        )}

        {/* Import Results */}
        {importResults && (
          <Alert status="success">
            <AlertIcon />
            <Box>
              <AlertTitle>Import Completed!</AlertTitle>
              <AlertDescription>
                <VStack align="start" spacing={1} mt={2}>
                  <Text>• Added: {importResults.addedCount} new members</Text>
                  <Text>• Updated: {importResults.updatedCount} existing members</Text>
                  <Text>• Total processed: {importResults.totalProcessed} members</Text>
                </VStack>
              </AlertDescription>
            </Box>
          </Alert>
        )}

        {/* Instructions */}
        <Box p={4} border="1px" borderColor="blue.200" borderRadius="md" bg="blue.50">
          <Text fontWeight="bold" mb={2}>📝 Instructions</Text>
          <VStack align="start" spacing={2} fontSize="sm">
            <Text>1. Download the CSV template above</Text>
            <Text>2. Fill in your member data with the correct format:</Text>
            <Code fontSize="xs" p={2} borderRadius="md" w="full">
              discord_user_id,ign,dkp<br/>
              123456789012345678,PlayerName,100
            </Code>
            <Text>3. Save the file and upload it here</Text>
            <Text>4. Review the data and confirm the import</Text>
          </VStack>
        </Box>
      </VStack>

      {/* Preview Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="6xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <HStack>
              <Text>Preview Import Data</Text>
              <Badge colorScheme={invalidCount > 0 ? 'red' : 'green'}>
                {validCount} valid, {invalidCount} invalid
              </Badge>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              {invalidCount > 0 && (
                <Alert status="warning">
                  <AlertIcon />
                  <AlertDescription>
                    {invalidCount} members have errors and will be skipped during import.
                  </AlertDescription>
                </Alert>
              )}

              <Box maxH="400px" overflowY="auto">
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>Discord User ID</Th>
                      <Th>IGN</Th>
                      <Th>DKP</Th>
                      <Th>Status</Th>
                      <Th>Errors</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {parsedData.map((member, index) => (
                      <Tr key={index}>
                        <Td fontFamily="mono" fontSize="xs">
                          {member.userId}
                        </Td>
                        <Td>
                          {member.ign ? (
                            <Badge colorScheme="blue" variant="subtle">
                              {member.ign}
                            </Badge>
                          ) : (
                            <Text color="gray.500" fontSize="sm">Not set</Text>
                          )}
                        </Td>
                        <Td fontWeight="bold">{member.dkp}</Td>
                        <Td>
                          <HStack>
                            {member.status === 'valid' ? (
                              <Icon as={FaCheck} color="green.500" />
                            ) : (
                              <Icon as={FaTimes} color="red.500" />
                            )}
                            <Text fontSize="sm" color={member.status === 'valid' ? 'green.500' : 'red.500'}>
                              {member.status}
                            </Text>
                          </HStack>
                        </Td>
                        <Td>
                          {member.errors && (
                            <VStack align="start" spacing={1}>
                              {member.errors.map((error, i) => (
                                <Text key={i} fontSize="xs" color="red.500">
                                  {error}
                                </Text>
                              ))}
                            </VStack>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>

              <Divider />

              <HStack justify="space-between">
                <Text fontSize="sm" color="gray.600">
                  Ready to import {validCount} valid members?
                </Text>
                <HStack>
                  <Button onClick={onClose} variant="outline">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImport}
                    colorScheme="green"
                    isLoading={isImporting}
                    loadingText="Importing..."
                    isDisabled={validCount === 0 || isImporting}
                  >
                    Import {validCount} Members
                  </Button>
                </HStack>
              </HStack>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}
