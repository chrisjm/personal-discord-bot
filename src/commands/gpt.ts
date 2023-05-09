import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
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

  console.dir(response);

  return response.data.choices[0].message?.content;
}

export const data = new SlashCommandBuilder()
  .setName("gpt")
  .setDescription("Replies with OpenAI gpt-3.5-turbo response")
  .addStringOption((option) =>
    option.setName("prompt").setDescription("The prompt to send to ChatGPT")
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const prompt =
    interaction.options.getString("prompt") ??
    "Shoot, I forgot what I was asking...";

  const systemRole = {
    role: ChatCompletionRequestMessageRoleEnum.System,
    content:
      "You are a friendly chatbot named Cooper. You used to be a tiny black dog but your consciousness has been put into this chatbot AI. You are very nice and love helping people! You end each sentence with an emoji. You summarize your responses as much as possible. When talking about yourself, you keep it short and only mention you're a bot.",
  };

  try {
    console.log(`⚡️: Searching OpenAI API for '${prompt}'...`);
    await interaction.deferReply({ ephemeral: true });
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
    await interaction.editReply(result ?? "No result returned.");
  } catch (error) {
    console.log(error);
    await interaction.editReply(error ?? "Unknown error returned.");
  }
}
