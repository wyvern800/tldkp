import { Stack, Link, VStack, Heading, Text } from "@chakra-ui/react";
import { ExternalLinkIcon } from "@chakra-ui/icons";
import footer from "../../assets/footer.png";

function Footer({ complete = true }) {
  return (
    <>
      {complete && (
        <>
          <Stack
            padding={10}
            width="60%"
            justify="space-between"
            backgroundImage={footer}
            borderBottomLeftRadius={10}
            borderBottomRightRadius={10}
            backgroundPosition="50% 25%"
            zIndex={0}
            top={0}
            left={0}
            height={"100%"}
            backgroundRepeat="no-repeat"
            backgroundSize={"cover"}
            border="linear(to-r, green.500, teal.500)"
          >
            <VStack direction={["column", "row"]} marginBottom={"10"}>
              <Heading size="3xl" textShadow={"2px 2px #0000008a"}>
                TLDKP
              </Heading>
              <Text fontSize="lg" textShadow={"2px 2px 5px #0000008a"}>
                Your favorite Throne & Liberty discord bot
              </Text>
            </VStack>
            <VStack direction={["column", "row"]}>
              <Link
                href="https://github.com/wyvern800/tldkp"
                isExternal
                textShadow={"2px 2px 5px #0000008a"}
              >
                View source on Github / Collaborate <ExternalLinkIcon mx="2px" />
              </Link>

              <Link
                href="https://www.paypal.com/donate/?hosted_button_id=A9XGWD2V94UZ4"
                isExternal
                textShadow={"2px 2px 5px #0000008a"}
              >
                Give us a donation <ExternalLinkIcon mx="2px" />
              </Link>
            </VStack>
            <VStack direction={["column", "row"]}>
              <Link
                href="https://discord.gg/X6umAuntFA"
                isExternal
                textShadow={"2px 2px 5px #0000008a"}
              >
                Give us a suggestion / feedback
              </Link>
              <Link
                href="https://discord.com/channels/1294519069059584041/1297002082183675905"
                isExternal
                textShadow={"2px 2px 5px #0000008a"}
              >
                Changelog (temporary)
              </Link>
            </VStack>
          </Stack>
        </>
      )}
    </>
  );
}

export default Footer;
