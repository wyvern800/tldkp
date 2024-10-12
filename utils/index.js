import { REST, Routes } from "discord.js";
import { config } from "dotenv";

config();

const commands = [
  /*{
    name: "loot",
    description: "cria a sala de loot",
  },
  {
    name: "reservar",
    description: "reserva um tamanco",
  },
  {
    name: "2",
    description: "ligar",
  },
  {
    name: "1",
    description: "desligar",
  },*/
  {
    name: "clear",
    description: "Limpa um número de mensagens",
    options: [
      {
        name: "amount",
        description: "Número de mensagens a limpar",
        type: 4, // Inteiro
        required: true, // Torna o parâmetro obrigatório
      },
    ],
  },
];

// Carrega os arquivos
export const loadCommands = async () => {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    if (process.env.ENV === 'dev') {
      await rest.put(
        Routes.applicationGuildCommands(
          process.env.CLIENT_ID,
          process.env.GUILD_ID
        ),
        { body: commands }
      );
    } else {
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    }
    console.log(`[SlashCommands] Started ${commands?.length} refreshing application (/) command${commands?.length > 1 ? 's': ''}.`);
  } catch (error) {
    console.error(error);
  }
};
