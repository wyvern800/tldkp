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
      "what-is-dkp": 3,
      "how-to-earn-dkp": 4,
      "premium-features": 5,
      "data-export": 6,
      "guild-setup": 7,
      "bot-commands": 8,
      "troubleshooting": 9,
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

              <AccordionItem>
                <h2>
                  <AccordionButton>
                    <Box flex="1" textAlign="left">
                      What is DKP and how does it work?
                    </Box>
                    <AccordionIcon />
                  </AccordionButton>
                </h2>
                <AccordionPanel pb={4}>
                  DKP (Dragon Kill Points) is a currency system used in guilds to track member contributions and participation. Members earn DKP through various activities like raids, dungeons, or other guild events. DKP is then used to bid on items during auctions, ensuring fair distribution of loot based on member participation and contribution.
                </AccordionPanel>
              </AccordionItem>

              <AccordionItem>
                <h2>
                  <AccordionButton>
                    <Box flex="1" textAlign="left">
                      How do I earn DKP?
                    </Box>
                    <AccordionIcon />
                  </AccordionButton>
                </h2>
                <AccordionPanel pb={4}>
                  DKP can be earned through various activities determined by your guild leadership:
                  <br/>• Participating in raids and dungeons
                  <br/>• Completing guild quests and objectives
                  <br/>• Attending scheduled guild events
                  <br/>• Contributing to guild resources
                  <br/>• Special achievements or milestones
                  <br/><br/>The specific DKP rewards are set by your guild administrators and may vary between different guilds.
                </AccordionPanel>
              </AccordionItem>

              <AccordionItem>
                <h2>
                  <AccordionButton>
                    <Box flex="1" textAlign="left">
                      What are the premium features?
                    </Box>
                    <AccordionIcon />
                  </AccordionButton>
                </h2>
                <AccordionPanel pb={4}>
                  Premium features include:
                  <br/>• <b>Unlimited data exports</b> - Export your guild data as often as needed
                  <br/>• <b>Advanced auction features</b> - Enhanced bidding and auction management
                  <br/>• <b>Priority support</b> - Faster response times for technical issues
                  <br/>• <b>Custom bot settings</b> - Advanced configuration options
                  <br/>• <b>Analytics dashboard</b> - Detailed insights and statistics
                  <br/>• <b>Lifetime subscription option</b> - One-time payment for permanent access
                  <br/><br/>Free users get basic functionality with limited exports (1 per week).
                </AccordionPanel>
              </AccordionItem>

              <AccordionItem>
                <h2>
                  <AccordionButton>
                    <Box flex="1" textAlign="left">
                      How do I export my guild data?
                    </Box>
                    <AccordionIcon />
                  </AccordionButton>
                </h2>
                <AccordionPanel pb={4}>
                  To export your guild data:
                  <br/>1. Go to your guild in the dashboard
                  <br/>2. Click the green download icon (Export Data button)
                  <br/>3. Choose your preferred format (CSV or JSON)
                  <br/>4. Click "Export" to download the file
                  <br/><br/>The export includes member information, DKP values, IGNs, and Discord data. Free users can export once per week, while premium users have unlimited exports.
                </AccordionPanel>
              </AccordionItem>

              <AccordionItem>
                <h2>
                  <AccordionButton>
                    <Box flex="1" textAlign="left">
                      How do I set up the bot for my guild?
                    </Box>
                    <AccordionIcon />
                  </AccordionButton>
                </h2>
                <AccordionPanel pb={4}>
                  To set up the TL-DKP bot for your guild:
                  <br/>1. <b>Invite the bot</b> - Use the invite link with proper permissions
                  <br/>2. <b>Configure settings</b> - Set up DKP rewards, auction rules, and member roles
                  <br/>3. <b>Import member data</b> - Upload your existing member list or add members manually
                  <br/>4. <b>Test the system</b> - Run a test auction to ensure everything works correctly
                  <br/><br/>Make sure the bot has the necessary permissions to read messages, send messages, and manage roles.
                </AccordionPanel>
              </AccordionItem>

              <AccordionItem>
                <h2>
                  <AccordionButton>
                    <Box flex="1" textAlign="left">
                      What bot commands are available?
                    </Box>
                    <AccordionIcon />
                  </AccordionButton>
                </h2>
                <AccordionPanel pb={4}>
                  Common bot commands include:
                    <br/>• <b>/help</b> - Display all available commands
                    <br/>• Check the 'commands' above in the list
                </AccordionPanel>
              </AccordionItem>

              <AccordionItem>
                <h2>
                  <AccordionButton>
                    <Box flex="1" textAlign="left">
                      Troubleshooting common issues
                    </Box>
                    <AccordionIcon />
                  </AccordionButton>
                </h2>
                <AccordionPanel pb={4}>
                  <b>Bot not responding:</b>
                  <br/>• Check if the bot is online and has proper permissions
                  <br/>• Verify the bot can read and send messages in the channel
                  <br/><br/><b>DKP not updating:</b>
                  <br/>• Ensure you're using the correct command format
                  <br/>• Check if you have admin permissions for DKP management
                  <br/><br/><b>Export not working:</b>
                  <br/>• Free users are limited to 1 export per week
                  <br/>• Check your internet connection
                  <br/>• Try refreshing the page and attempting again
                  <br/><br/><b>Can't see guild data:</b>
                  <br/>• Make sure you're logged in with the correct Discord account
                  <br/>• Verify you have access to the guild
                  <br/>• Contact your guild administrator if issues persist
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
