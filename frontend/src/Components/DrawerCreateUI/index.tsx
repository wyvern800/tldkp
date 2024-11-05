import {
  Button,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  DrawerHeader,
  DrawerBody,
  Stack,
  FormLabel,
  Box,
  Input,
  InputGroup,
  InputLeftAddon,
  Select,
  Textarea,
  DrawerFooter,
} from "@chakra-ui/react";

type StatePropType = {
  isOpen: boolean;
  onClose: () => void;
};

interface DrawerExampleProps {
  title?: string;
  submitButtonLabel?: string;
  state: StatePropType;
}

export default function DrawerCreateUI({
  title,
  submitButtonLabel = "Submit",
  state,
}: DrawerExampleProps) {
  const { isOpen, onClose } = state ?? {};

  return (
    <>
      <Drawer isOpen={isOpen} placement="right" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px">{title}</DrawerHeader>

          <DrawerBody>
            <Stack spacing="24px">
              <Box>
                <FormLabel htmlFor="username">Name</FormLabel>
                <Input id="username" placeholder="Please enter user name" />
              </Box>

              <Box>
                <FormLabel htmlFor="url">Url</FormLabel>
                <InputGroup>
                  <InputLeftAddon>http://</InputLeftAddon>
                  <Input
                    type="url"
                    id="url"
                    placeholder="Please enter domain"
                  />
                </InputGroup>
              </Box>

              <Box>
                <FormLabel htmlFor="owner">Select Owner</FormLabel>
                <Select id="owner" defaultValue="segun">
                  <option value="segun">Segun Adebayo</option>
                  <option value="kola">Kola Tioluwani</option>
                </Select>
              </Box>

              <Box>
                <FormLabel htmlFor="desc">Description</FormLabel>
                <Textarea id="desc" />
              </Box>
            </Stack>
          </DrawerBody>

          <DrawerFooter borderTopWidth="1px">
            <Button variant="outline" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue">{submitButtonLabel}</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
