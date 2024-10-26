![Tux, the Linux mascot](/assets/logo.png)

# TLDKP (Throne and Liberty Dragon Kill Points)

> NOTE: This project was a nightly build, which means it was coded in speedrun mode, not much focused, but ive put some more effort onto it, so you are good to use it as it is.

## Features:
- Add command to manage people's DKPs - OK
- Add command to view my DKPs - OK
- Create command to add ingame Nick - OK
- Fix error log - OK
- Added repo - OK
- Create language/localization system - WIP
- Added base, selector/command to change language - OK
- Add help command - OK
- Create way to add the bot to the owners' servers - OK
- Add way to interact with the command only if it is a specific role determined by the site
- Ability to enable/disable an automatic DKP decaying system with some cool features like setting the minimum dkp you can have when decaying and all automatic.

## Start contributing (Setting up the local dev. environment)

### How do I start contributing?
> We use firebase so you'll have to setup your Cloud Firestore (Firebase), you'll have to create a discord bot application and also a Clerk account (for the authentication),
so you'll need:

1. Setup [Cloud Firestore](https://firebase.google.com) and set its vars on .env (root), the var is **FIREBASE_SERVICE_ACCOUNT**.  
2. Setup [Clerk](https://clerk.com) and set its vars in **frontend/.env.local**: **VITE_CLERK_PUBLISHABLE_KEY** and **VITE_BOT_INSTALL** and in the .env in the root folder: **CLERK_SECRET_KEY**, **CLERK_PUBLISHABLE_KEY** they're the same
in both (frontend and root) but since vite uses the prefix **VITE_**, it had to be set this way.  
3. Setup the [Discord Application](https://discord.com/developers/applications) and set its vars: **GUILD_ID** (Your discord server id), **CLIENT_ID** and **DISCORD_TOKEN**  
4. And last but not least, after configuring the bot application in discord dev portal, grab its install url under **Installation**, and put on the **frontend/.env.local**: **VITE_BOT_INSTALL**  
5. And you can now continue to the next steps  

### Using docker (Recommended)
We have docker environment setup for our development project, so you can [Download](https://www.docker.com/products/docker-desktop/) it and then just run:  
```docker-compose -f docker-compose.dev.yml --build```

### After running the build step (to start the dev env):  
```docker-compose -f docker-compose.dev.yml up```

### Without docker (normal way)
1. ```npm install``` (root folder)
2. ```cd frontend```
3. ```npm install```
4. Fill the necessary .envs (one in root folder, one in frontend folder)
5. Then go to root folder again, and you can run the scripts present in package.json

### Available scripts
* ```npm run dev``` - Run the whole app (bot, server and frontend)  
* ```npm run dev:bot``` - Run only the bot  
* ```npm run dev:client``` - Run only the frontend dev server  
* ```npm run dev:api``` - Run only the backend (server)  
* ```npm run dev:site``` - Run only server and frontend (leave bot down)  

If you reached here, you're now free to develop and collaborate, lets build together <3

## Updates
I will be pushing fixes/suggestions whenever I feel the urge to, so there is no updates schedule, that means I could push a bunch per week, but none in another, (remind that supporting me trough patreon and by direct donations can make me feel motivated to keep pushing more and more, as this is a free project but have it's costs to keep it up online).

## Collaboration
Feel free to fork and contribute, its always fun to share knowledge