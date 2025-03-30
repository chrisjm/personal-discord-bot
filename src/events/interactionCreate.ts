import { Events, Interaction, CacheType, ActionRowBuilder, ButtonBuilder, ComponentType, APIMessageComponent, APIActionRowComponent, APIButtonComponent } from "discord.js";
import { 
    logWaterEntry, 
    MODAL_ID_LOG_CUSTOM, 
    INPUT_ID_CUSTOM_AMOUNT,
    STREAK_TYPES // Needed for fetching current streak data
} from '../handlers/waterReminder'; // Assuming exports are set up
import * as streakService from '../utils/streakService';
import * as streakFormatter from '../utils/streakFormatter';

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction<CacheType>) { 
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands?.get(interaction.commandName);

      if (!command) {
        console.error(
          `No command matching ${interaction.commandName} was found.`,
        );
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`Error executing ${interaction.commandName}`);
        console.error(error);
      }
    } else if (interaction.isButton()) {
      // respond to a permanent button
    } else if (interaction.isStringSelectMenu()) {
      // respond to a permanent select menu
    } else if (interaction.isModalSubmit()) {
         // --- Handle Custom Water Log Modal ---
         if (interaction.customId === MODAL_ID_LOG_CUSTOM) {
            const userId = interaction.user.id;
            const amountStr = interaction.fields.getTextInputValue(INPUT_ID_CUSTOM_AMOUNT);
            const amountMl = parseInt(amountStr, 10);

            if (isNaN(amountMl) || amountMl <= 0) {
                await interaction.reply({ content: '❌ Please enter a valid positive number for the amount in ml.', ephemeral: true });
                return;
            }

            // Defer reply as logging + message edit might take a moment
            await interaction.deferReply({ ephemeral: true }); 

            try {
                // Log the water entry (this function should handle its own success reply/followUp)
                await logWaterEntry(userId, amountMl, interaction); 

                // Fetch original message to disable buttons
                if (interaction.message) { 
                    try {
                        const originalMessage = await interaction.channel?.messages.fetch(interaction.message.id); 
                        if (originalMessage && originalMessage.components.length > 0) {
                             const firstRow = originalMessage.components[0].toJSON() as APIActionRowComponent<APIButtonComponent>; 
                             const disabledRow = new ActionRowBuilder<ButtonBuilder>();
                             firstRow.components.forEach((componentJson: APIButtonComponent) => { 
                                 if (componentJson.type === ComponentType.Button) {
                                     const button = new ButtonBuilder(componentJson).setDisabled(true);
                                     disabledRow.addComponents(button);
                                 }
                             });
                            await originalMessage.edit({ components: [disabledRow] });
                            console.log(`[DEBUG] Disabled buttons on original message ${originalMessage.id} after modal submit`);
                        }
                    } catch (editErr) {
                        console.warn("Could not edit original message to disable buttons after modal:", editErr);
                    }
                }

                // --- Send Current Streak Status ---
                // The streak was already updated when the 'Custom' button was clicked.
                // Fetch the *current* data now to show the latest status.
                const currentStreakData = await streakService.getStreakData(userId, STREAK_TYPES.WATER_DAILY_CONSISTENCY);
                const streakSummaryMessage = streakFormatter.getStreakStatusMessage(currentStreakData); 
                
                if (streakSummaryMessage) {
                    try {
                         // Follow up the deferred reply with the streak status (non-ephemeral)
                         await interaction.followUp({ content: `**Current Status:**
${streakSummaryMessage}`, ephemeral: false }); 
                    } catch (followUpErr) {
                        console.warn("Could not follow up modal interaction for streak summary:", followUpErr);
                         try {
                            await interaction.user.send(`**Current Status:**
${streakSummaryMessage}`); // Fallback to DM
                        } catch (dmErr) {
                            console.error("Failed to send streak summary as DM after modal:", dmErr);
                        }
                    }
                } else {
                     // If summary is empty/null, at least edit the deferred reply so it doesn\'t hang
                     await interaction.editReply({ content: `Logged ${amountMl}ml!`}); // Simple confirmation
                }
                 // --- End Streak Status ---

            } catch (error) {
                console.error("Error processing custom water log modal:", error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply({ content: '❌ An error occurred while logging your custom amount.' });
                } else {
                     await interaction.reply({ content: '❌ An error occurred while logging your custom amount.', ephemeral: true });
                }
            }
         }
         // Handle other modals if needed...
    }
  },
};
