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
  Image,
  Center
} from "@chakra-ui/react";
import { IoChevronForward } from "react-icons/io5";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import bid from "../assets/howto/1.png";
import bid2 from "../assets/howto/2.png";

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
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        padding: "20px",
      }}
    >
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
              <BreadcrumbLink as={Link} to="/knowledge-base">
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
                  1- To bid, you must wait for the auction to start. Once the bidding thread starts you can click on <b style={{color: "0AAAEF"}}>1 message</b> &rsaquo; on the upper right corner (Like in the photo): <br/>
                  <Center>
                    <Image src={bid} width="40%" alt='Dan Abramov' borderRadius={"10px"} margin={"15px"}/><br/>
                  </Center>
                  2- And there use the command <b>/bid [amount]</b> (Like in the photo):
                  <Center>
                    <Image src={bid2} width={"30%"} alt='Dan Abramov' borderRadius={"10px"} margin={"15px"}/><br/>
                  </Center>
                  3- Then if you have sufficient DKP (not bidded in others items) you can keep bidding until your DKP is fully alocated.<br/>
                  4- Then if you have the highest bid, you will be notified and you can claim the item when the guild master decides to distribute.
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
                  You can share your HUD by clicking HUDS and then upload clicking on the button 'Upload HUD', have in mind that your HUD must be accepted in order for it to be freely available to others.
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
          ) : (
            <Spinner size="xl" />
          )}
        </main>
      </>
      </div>
    </div>
  );
}
