export const changelog = [
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
];