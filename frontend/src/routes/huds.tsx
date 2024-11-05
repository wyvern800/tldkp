/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Image,
  SimpleGrid,
  Tag,
  HStack,
  Button,
  Flex,
  Kbd,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { IoChevronForward } from "react-icons/io5";
import { useEffect, useState } from "react";
import api from "../services/axiosInstance";
import Modal from "../Components/Modal";
import { formatDistance } from "date-fns";
import { convertFirestoreTimestamp } from "../utils";
import {
  DownloadIcon,
  TriangleDownIcon,
  StarIcon,
  ArrowUpIcon,
} from "@chakra-ui/icons";
import { SignedIn } from "@clerk/clerk-react";
import DrawerCreateUI from "../Components/DrawerCreateUI";
import Carousel from "../Components/Carousel";

export default function HudsPage() {
  const [data, setData] = useState<any>([]);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [previewing, setPreviewing] = useState<any>(false);
  const {
    isOpen: isNewModalOpen,
    onOpen: onNewModalOpen,
    onClose: onNewModalClose,
  } = useDisclosure();
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    const fetch = async () => {
      const res = await api.get(`/huds`, {});
      setData(res?.data?.data);
      setLoaded(true);
    };
    fetch();
  }, []);

  function getDistance(date: string) {
    return formatDistance(convertFirestoreTimestamp(date), new Date(), {
      addSuffix: true,
    });
  }

  return (
    loaded && (
      <div
        style={{
          display: "flex",
          justifyItems: "space-between",
          width: "60%",
          minHeight: "75vh",
          flexDirection: "column",
          borderRadius: "10px",
          backgroundColor: "rgba(0, 0, 0, 0.1)",
          border: "linear(to-r, green.500, teal.500)",
        }}
      >
        <>
          <HStack
            width={"100%"}
            style={{
              padding: "15px",
              backgroundColor: "#0000004d",
              borderTopLeftRadius: "10px",
              borderTopRightRadius: "10px",
              width: "100%",
              justifyContent: "space-between",
            }}
          >
            <Breadcrumb
              spacing="8px"
              separator={<IoChevronForward color="gray.500" />}
            >
              <BreadcrumbItem>
                <BreadcrumbLink as={Link} to="/">
                  Home
                </BreadcrumbLink>
              </BreadcrumbItem>

              <BreadcrumbItem>
                <BreadcrumbLink as={Link} to="/Huds">
                  HUDS
                </BreadcrumbLink>
              </BreadcrumbItem>
            </Breadcrumb>
            <div>
              <SignedIn>
                <Button
                  rightIcon={<ArrowUpIcon />}
                  colorScheme="teal"
                  variant="outline"
                  size={"xs"}
                  onClick={() => {
                    onOpen();
                  }}
                >
                  Upload HUD
                </Button>
              </SignedIn>
            </div>
          </HStack>

          <main
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px",
              flexDirection: "column",
            }}
          >
            <Text fontSize="md" mb="20px" mt="20px" align="center">
              A HUD (Heads-Up Display) in Throne and Liberty is an interface
              overlay that provides players with important information and
              controls while playing the game. This can include elements such as
              health bars, mini-maps, skill cooldowns, and other vital stats
              that help players make informed decisions during gameplay. HUDs
              are customizable, allowing players to tailor the interface to
              their preferences and enhance their gaming experience. HUDS are a
              way to share your UI with other players.
              <SignedIn>
                <b> You can share by clicking the button above.</b>
              </SignedIn>
            </Text>
            <SimpleGrid
              columns={2}
              spacing={10}
              flexDirection={["column", "row"]}
              minChildWidth="320px"
            >
              {data?.map((hud: unknown | any) => {
                return (
                  <Image
                    key={hud?.id}
                    objectFit="cover"
                    src={hud?.screenshots[0]}
                    alt={hud?.name}
                    borderRadius="15px"
                    border={"2px solid transparent"}
                    _hover={{ cursor: "pointer", border: "2px solid teal" }}
                    onClick={() => {
                      setPreviewing(hud);
                      onNewModalOpen();
                    }}
                  />
                );
              })}
            </SimpleGrid>
          </main>

          {previewing && (
            <Modal
              title={
                <>
                  <HStack justifyContent="space-between" marginTop="30px">
                    <span>{previewing?.title}</span>
                    <HStack gap="8px">
                      <Tag size="md" variant="solid" colorScheme="teal">
                        {getDistance(previewing?.createdAt)}
                      </Tag>
                      <Tag size="md" variant="solid" colorScheme="orange">
                        {previewing?.stars.toLocaleString()}
                        <StarIcon ml="5px" />
                      </Tag>
                      <Tag size="md" variant="solid" colorScheme="green">
                        {previewing?.downloads.toLocaleString()}
                        <TriangleDownIcon ml="5px" />
                      </Tag>
                    </HStack>
                  </HStack>
                </>
              }
              state={{ isOpen: isNewModalOpen, onClose: onNewModalClose }}
              isCentered={true}
              closeOnOverlayClick={true}
            >
              {previewing?.description}
              {previewing?.screenshots?.length === 1 ? (
                <Image
                  key={previewing?.id}
                  objectFit="cover"
                  src={previewing?.screenshots[0]}
                  alt={previewing?.name}
                  borderRadius="8px"
                  onClick={() => {
                    setPreviewing(previewing);
                    onNewModalOpen();
                  }}
                  mt="10px"
                  mb="10px"
                />
              ) : (
                <Carousel
                  cards={previewing?.screenshots?.map((screenshot: any) => {
                    return {
                      title: previewing?.name,
                      text: previewing?.description,
                      image: screenshot,
                    };
                  })}
                />
              )}
              Remember to download this .azj (azulejo) file, and place it under
              your <Kbd>Documents\TL\UserHUD</Kbd> folder, then ingame you can
              open the HUD editor and load it.
              <Flex alignItems="center" justifyContent="center">
                <Button
                  rightIcon={<DownloadIcon />}
                  colorScheme="teal"
                  variant="outline"
                  size={"lg"}
                  mt="20px"
                  onClick={() => {
                    window.open(previewing?.interfaceFile, "_blank");
                  }}
                >
                  Click to Download
                </Button>
              </Flex>
            </Modal>
          )}

          <DrawerCreateUI title="Upload your HUD" state={{ isOpen, onClose }} />
        </>
      </div>
    )
  );
}