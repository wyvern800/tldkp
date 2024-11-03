import { ReactNode } from "react";

import { Box, Heading, Text, Stack } from "@chakra-ui/react";

// const bg = useColorModeValue("teal", "gray");

type FeaturePropsType = {
  title: string;
  desc: string;
  rest?: ReactNode;
};

function Feature({ title, desc, ...rest }: FeaturePropsType) {
  return (
    <Box p={5} shadow="md" borderWidth="1px" {...rest}>
      <Heading fontSize="xl">{title}</Heading>
      <Text mt={4} fontSize="xl">
        {desc}
      </Text>
    </Box>
  );
}

function StackEx(): ReactNode {
  return (
    <Stack spacing={3} width="60%" marginBottom="5">
      <Feature
        title="Manage your guild member's DKP"
        desc="The Dragon Kill Points (DKP) system is a method used in MMORPGs (Massively Multiplayer Online Role-Playing Games) to distribute loot among players after defeating bosses or completing raids. DKP is a type of currency that players earn by participating in these activities, and they can spend their points to bid on or claim items dropped by defeated enemies."
      />
      <Feature
        title="Totally Free"
        desc="This bot was designed at first glance to be free and open-sourced, so you can use and do whatever you want with the code (but not sell or earn money with it)"
      />
      <Feature
        title="Steady & Simple"
        desc="There are no complications using it, everything you want you can config via command lines. There are tons of toggles and configurations you can do within commands."
      />
      <Feature
        title="Automated Tasks"
        desc="You can automate the bot to do some tasks for you, like decaying DKP from all members, or even generate claimable dkp tokens per events. There are many more future implementations to come (bidding system, auction, etc)"
      />
      <Feature
        title="For you that's asking for a better version (+)"
        desc="At start, it wasn't our first plan. But people are asking for, so we plan on implementing more complex features in the future, that donators can have access to, that way donators can contribute directly with the expenses and be rewarded!"
      />
    </Stack>
  );
}

export default StackEx;
