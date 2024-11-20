/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  HStack,
  Heading,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Box,
  Spinner,
} from "@chakra-ui/react";
import { IoChevronForward } from "react-icons/io5";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export default function KnowledgeBasePage() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const expandedAccordion = params.has("read");
  const [expanded, setExpanded] = useState<number | null | any[]>(null);
  const [loaded, setLoaded] = useState(true);

  const getFaq = (faq: string): number => {
    const theFaqs: { [key: string]: number } = {
      "how-to-bid": 0,
      "how-can-i-customize-my-hud": 1,
      "how-do-i-share-my-hud-with-others": 2,
    };
    return theFaqs[faq] ?? 0;
  };

  // Fix
  useEffect(() => {
    if (params.has("read")) {
      setLoaded(false);
      const theFaq = getFaq(params.get("read") ?? "");
      console.log(theFaq);
      setExpanded(theFaq);
      setLoaded(true);
    } else {
      setExpanded([]);
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedAccordion, expanded]);

  return (
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
                Knowledge Base
              </BreadcrumbLink>
            </BreadcrumbItem>
          </Breadcrumb>
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
          <Heading size="lg" mt="10" mb="5">
            Frequently Asked Questions
          </Heading>
          {loaded && expanded !== null ? (
            <Accordion allowToggle width="100%" defaultIndex={expanded ?? []}>
              <AccordionItem>
                <h2>
                  <AccordionButton>
                    <Box flex="1" textAlign="left">
                      How do I bid?
                    </Box>
                    <AccordionIcon />
                  </AccordionButton>
                </h2>
                <AccordionPanel pb={4}>
                  To bid, click on the item you want to bid on and enter the
                  amount you want to bid.
                </AccordionPanel>
              </AccordionItem>

              <AccordionItem>
                <h2>
                  <AccordionButton>
                    <Box flex="1" textAlign="left">
                      How can I customize my HUD?
                    </Box>
                    <AccordionIcon />
                  </AccordionButton>
                </h2>
                <AccordionPanel pb={4}>
                  HUDs are customizable, allowing players to tailor the
                  interface to their preferences and enhance their gaming
                  experience.
                </AccordionPanel>
              </AccordionItem>

              <AccordionItem>
                <h2>
                  <AccordionButton>
                    <Box flex="1" textAlign="left">
                      How do I share my HUD with others?
                    </Box>
                    <AccordionIcon />
                  </AccordionButton>
                </h2>
                <AccordionPanel pb={4}>
                  You can share your HUD by clicking the share button above and
                  uploading your HUD file.
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
          ) : (
            <Spinner size="xl" />
          )}
        </main>
      </>
    </div>
  );
}
