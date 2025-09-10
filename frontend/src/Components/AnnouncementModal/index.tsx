import { useState, useEffect } from "react";
import {
  Modal as ModalChakra,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Text,
  VStack,
  HStack,
  Icon,
  useColorModeValue,
  Divider,
  Box,
} from "@chakra-ui/react";
import { ExternalLinkIcon, WarningIcon } from "@chakra-ui/icons";

interface AnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function AnnouncementModal({ isOpen, onClose }: AnnouncementModalProps) {
  const [hasSeenAnnouncement, setHasSeenAnnouncement] = useState(false);
  
  const bgColor = useColorModeValue("white", "gray.800");
  const textColor = useColorModeValue("gray.800", "white");
  const accentColor = useColorModeValue("orange.500", "orange.300");
  const orangeBg = useColorModeValue("orange.50", "orange.900");
  const blueBg = useColorModeValue("blue.50", "blue.900");
  const blueText = useColorModeValue("blue.700", "blue.300");
  const grayText = useColorModeValue("gray.600", "gray.400");

  useEffect(() => {
    // Check if user has already seen the announcement
    const seen = localStorage.getItem("tldkp-announcement-seen");
    if (seen === "true") {
      setHasSeenAnnouncement(true);
      onClose();
    }
  }, [onClose]);

  const handleClose = () => {
    // Mark as seen in localStorage
    localStorage.setItem("tldkp-announcement-seen", "true");
    setHasSeenAnnouncement(true);
    onClose();
  };

  const handleDonateClick = () => {
    // Open donation link in new tab
    window.open("https://github.com/sponsors/wyvern800", "_blank");
  };

  if (hasSeenAnnouncement) {
    return null;
  }

  return (
    <ModalChakra
      isOpen={isOpen}
      onClose={handleClose}
      isCentered
      size="lg"
      closeOnOverlayClick={false}
      closeOnEsc={true}
    >
      <ModalOverlay
        bg="blackAlpha.600"
        backdropFilter="blur(4px)"
      />
      <ModalContent bg={bgColor} color={textColor}>
        <ModalHeader>
          <HStack spacing={3}>
            <Icon as={WarningIcon} color={accentColor} boxSize={6} />
            <Text fontSize="xl" fontWeight="bold">
              Important Domain Change Notice
            </Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody pb={6}>
          <VStack spacing={4} align="stretch">
            <Box
              p={4}
              bg={orangeBg}
              borderRadius="md"
              borderLeft="4px solid"
              borderLeftColor={accentColor}
            >
              <Text fontWeight="semibold" color={accentColor} mb={2}>
                🚨 Domain Migration Notice
              </Text>
              <Text fontSize="sm">
                We're moving from <strong>tldkp.online</strong> to <strong>tldkp.org </strong> 
                to reduce operational costs. The old domain will only be available until 
                <strong> October 14, 2025</strong>.
              </Text>
            </Box>

            <Text>
              Hello! 👋 We wanted to let you know about an important change happening with our website.
            </Text>

            <Text>
              Due to increasing operational costs that we've been covering from our personal funds, 
              we're migrating to a more cost-effective domain. This change will help us keep the 
              project running longer and more sustainably.
            </Text>

            <Divider />

            <Box
              p={4}
              bg={blueBg}
              borderRadius="md"
              textAlign="center"
            >
              <Text fontWeight="semibold" mb={2} color={blueText}>
                💝 Support Our Project
              </Text>
              <Text fontSize="sm" mb={3}>
                If you find our service valuable, consider making a donation to help us 
                maintain and improve the platform. Every contribution helps!
              </Text>
              <Button
                colorScheme="blue"
                size="sm"
                rightIcon={<ExternalLinkIcon />}
                onClick={handleDonateClick}
              >
                Make a Donation
              </Button>
            </Box>

            <Text fontSize="sm" color={grayText} textAlign="center">
              Thank you for your understanding and continued support! 🙏
            </Text>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button colorScheme="blue" onClick={handleClose} mr={3}>
            Got it, thanks!
          </Button>
        </ModalFooter>
      </ModalContent>
    </ModalChakra>
  );
}

export default AnnouncementModal;
