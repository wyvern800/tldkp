export const changelog = [
  {
    version: 'v1.0.5',
    date: '2025-01-27',
    changes: [
      "Added time-ban system for DKP claims - guild admins can now temporarily ban users from claiming DKP points",
      "New `/time-ban` command allows admins to ban users from claiming DKP for a specified duration (1 minute to 1 week)",
      "New `/time-unban` command allows admins to remove time-bans and restore DKP claiming privileges",
      "Time-banned users receive funny messages when trying to claim DKP codes",
      "Ban messages can be exposed publicly or kept private based on admin preference",
      "Automatic cleanup of expired time-bans to keep the system clean"
    ]
  },
  {
    version: 'v1.0.4',
    date: '2025-09-16',
    changes: [
      "Added a feature where you can export your data to a JSON or CSV file, to download your data",
      "Added subscription system, so you can now subscribe to the bot to get more features",
    ]
  },
  {
    version: 'v1.0.3',
    date: '2025-09-10',
    changes: [
      "Audit log for codes is now available, to check who claimed the code, and how many times it was claimed",
      "Guild admins can import members from a CSV file, to add them to the DKP system",
      "Added a feature where you can check if the bot has all the required permissions to work properly, this will be needed for the auction system to work properly",
      "Auction system is now available for everyone, you can create an auction, and people can bid on it. The auction will be closed when you decide, and the winner will be the one with the highest bid. The winner will have the DKP deducted from his account. The auction creator can also cancel it if the auction didn's start yet. The auction creator can also set a minimum bid incremented.",
    ]
  },
  {
    version: 'v1.0.2^4',
    date: '2025-09-09',
    changes: [
      "A visual revamp is now available, with new colors, animations, and a new design",
      "New domain is now available, so you can access the app at https://tldkp.org",
    ]
  },
  {
    version: 'v1.0.2^3',
    date: '2025-03-01',
    changes: [
      "Included a feature where guild admins can delete their guild from the app and remove all data",
    ]
  },
  {
    version: 'v1.0.2^2',
    date: '2024-12-23',
    changes: [
      "Fixed a bug where we could not set up auto decay system, was something related to the old and glithy cache system",
    ]
  },
  {
    version: 'v1.0.2^1',
    date: '2024-12-02',
    changes: [
      "Removed all the cache system, so the app should be more real-time, and avoids the data loss",
    ]
  },
  {
    version: 'v1.0.2',
    date: '2024-11-15',
    changes: [
      "Released this 'little-big' feature here, where people will be able to share their UI's with the community. I'll be pushing this today, so people can test it out. I decided to have this, since I didn't see any app with this functionality yet, will come this week",
    ]
  },
  {
    version: 'v1.0.1',
    date: '2024-11-14',
    changes: [
      'Commands: generate-code, manage, check are now available for ROLES that has the PermissionFlagBit.ModerateMembers, so if you guys want to allow your guild moderators/helpers to use that, just create a role with this FlagBit',
      'All the replies are now awaiting, to avoid data loss, and the cache was lowered a bit for things look more real-time',
      'Separated the responsability of adding/removing DKP from the command /manage, so, no more divergences',
      "We know there are many improvements and other things to do in prio, but we've been working on this 'little-big' feature here, where people will be able to share their UI's with the community. I'll be pushing this today, so people can test it out. I decided to have this, since I didn't see any app with this functionality yet, will come this week",
      "Clerk.js is now updated to last version and locked so it won't be updated anymore",
      "We've added rollbar to monitor the app, so if any major error happens, we should act faster",
      "We've fixed the error of wrongly decaying the DKP, now it's working as expected",
      "/claim command now shows better info about the claimed DKP code",
      "We've corrected the display of people's discord data on the webapp"
    ]
  },
  {
    version: 'v1.0.0',
    date: '2024-11-03',
    changes: [
      'Added commands for claiming DKP with funny redeeming codes',
      'Corrected bug where setting a name without having a dkp, would tell nothing, but give an error',
      'Implemented a feature: You can now set a role on join, and also give new members a fixed amount of DKP once (thanks for the suggestion @potetto)',
    ]
  },
  {
    version: 'v1.0.3',
    date: '2024-11-20',
    changes: [
      "We've added an Auction System, where you can create an auctions, and people can bid on them. The auctions will be closed when you decide, and the winner will be the one with the highest bid. The winner will have the DKP deducted from his account. The auction creator can also cancel it if the auction didn's start yet. The auction creator can also set a minimum bid incremented. As you already know, there are some expenses we must pay to have this working since its usage is huge, hence that, the feature will be available free at start, but will become a premium feature soon, for those who supports the bot",
    ]
  },
];