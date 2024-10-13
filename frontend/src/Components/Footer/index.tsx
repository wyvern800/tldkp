import { Center, Link } from "@chakra-ui/react";
import { ExternalLinkIcon } from '@chakra-ui/icons'

function Footer() {
  return (
    <>
      <Center height="50px">
        Powered with love by{" "}
        <Link marginLeft="1" href="https://github.com/wyvern800" isExternal>
          Flambs <ExternalLinkIcon mx="2px" />
        </Link>
      </Center>
    </>
  );
}

export default Footer;
