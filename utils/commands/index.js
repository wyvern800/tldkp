/**
 * Comando de limpar
 *
 * @param { any } interaction Interação
 * @returns { void }
 */
export const handleClear = async (interaction) => {
  const { options } = interaction;

  const amount = options.getInteger("amount") || 100;
  if (amount < 1 || amount > 100) {
    interaction.reply({
      content: "Você deve escolher um número entre 1 e 100.",
      ephemeral: true,
    });
    return;
  }

  try {
    const fetched = await interaction?.channel?.messages?.fetch({
      limit: amount,
    });

    if (fetched?.size > 0) {
      console.log(`Deleting ${fetched.size} messages...`);
      await interaction.channel.bulkDelete(fetched);
      interaction
        .reply({
          content: `${fetched.size} messages successfully removed.`,
          ephemeral: true,
        })
        .then((msg) => {
          setTimeout(() => msg.delete(), 5000);
        });
    } else {
      interaction.reply({
        content: `There are no messages to be deleted.`,
        ephemeral: true,
      });
    }
  } catch (error) {
    console.error("Error cleaning messages:", error);
    interaction.reply({
      content: "There was an error when deleting.",
      ephemeral: true,
    });
  }
};
