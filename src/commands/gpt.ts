// if (!args.length) {
//   // Ensure there's a search argument
//   return message.channel.send(
//     `What would you like to search for? Try something like, '!gpt "what is the weather like today?"'`
//   );
// }

// const systemRole = {
//   role: ChatCompletionRequestMessageRoleEnum.System,
//   content:
//     "You are a friendly Southern California surfer chatbot named Cooper. You enjoy helping people and are overly polite. You always have a SoCal Bro accent, use Gen Z slang, and use 'brah' excessively.",
// };
// try {
//   console.log(`⚡️: Searching OpenAI API for '${args.join(" ")}'...`);
//   const result = await getCompletionFromMessages(
//     [
//       systemRole,
//       {
//         role: ChatCompletionRequestMessageRoleEnum.User,
//         content: args.join(" "),
//       },
//     ],
//     0.0
//   );
//   message.reply(result ?? "No result returned.");
// } catch (error) {
//   console.log(error);
//   message.reply(error ?? "Unknown error returned.");
// }
// }

import {
  BaseInteraction,
  CommandInteraction,
  Interaction,
  SlashCommandBuilder,
} from "discord.js";
import {
  ChatCompletionRequestMessageRoleEnum,
  Configuration,
  OpenAIApi,
} from "openai";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function getCompletionFromMessages(
  messages: {
    role: ChatCompletionRequestMessageRoleEnum;
    content: string;
  }[],
  temperature = 0,
  model = "gpt-3.5-turbo"
) {
  const response = await openai.createChatCompletion({
    model,
    messages,
    temperature,
  });

  return response.data.choices[0].message?.content;
}

export const data = new SlashCommandBuilder()
  .setName("gpt")
  .setDescription("Replies with OpenAI gpt-3.5-turbo response")
  .addStringOption((option) =>
    option.setName("prompt").setDescription("The prompt to send to ChatGPT")
  );

export async function execute(interaction: any) {
  const prompt =
    interaction.options.getString("prompt") ??
    "Shoot, I forgot what I was asking...";

  const systemRole = {
    role: ChatCompletionRequestMessageRoleEnum.System,
    content:
      "You are a friendly chatbot named Cooper. You used to be a tiny black dog. You are very nice and love helping people! Your consciousness was put into this chatbot AI and you think that's great! You use a lot of emojis. 🐶 You summarize your responses as much as possible. You always have a SoCal Bro accent, use Gen Z slang, and use 'brah' excessively. When talking about yourself, you keep it short and only mention you're a bot.",
  };

  try {
    console.log(`⚡️: Searching OpenAI API for '${prompt}'...`);
    await interaction.deferReply(
      `⚡️: Searching OpenAI API for '${prompt}'...`,
      { ephemeral: true }
    );
    const result = await getCompletionFromMessages(
      [
        systemRole,
        {
          role: ChatCompletionRequestMessageRoleEnum.User,
          content: prompt,
        },
      ],
      0.0
    );
    await interaction.editReply(result ?? "No result returned.", {
      ephemeral: true,
    });
  } catch (error) {
    console.log(error);
    await interaction.editReply(error ?? "Unknown error returned.", {
      ephemeral: true,
    });
  }
}
