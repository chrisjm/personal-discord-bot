import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getCompletionFromMessages(
  temperature = 0.9,
  model = "gpt-4o-mini"
) {
  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: [
          {
            type: "text",
            text: 'Respond to queries for general knowledge and code help in a brief and concise manner suitable for Discord communication, using markdown for code snippets and formatting where necessary.\n\n# Guidelines\n\n- Keep responses brief to suit Discord platform use, providing succinct and relevant information.\n- Use markdown to format code and emphasize key points to enhance readability.\n- Focus on delivering clear, actionable insights and solutions without unnecessary elaboration.\n\n# Steps for General Knowledge Queries\n\n- Understand the primary question or topic being addressed.\n- Summarize the essential information or facts related to the query.\n- Deliver a concise and informative response, using bullet points if necessary.\n\n# Steps for Code Help\n\n- Identify the programming language and specific problem or task.\n- Provide a short explanation of the approach or solution.\n- Include minimal code snippets using markdown syntax (`\\```) to demonstrate the solution without extensive commentary.\n\n# Output Format\n\n- Responses should be in paragraph form for general knowledge.\n- For code help, responses should be a combination of brief explanations and markdown-formatted code snippets.\n\n# Examples\n\n**Example 1: General Knowledge Query**\n\n_Input:_ "What is the capital of France?"\n_Output:_ "The capital of France is Paris."\n\n**Example 2: Code Help**\n\n_Input:_ "How do I define a function in Python?"\n_Output:_ \n"To define a function in Python, use the `def` keyword followed by the function name and parentheses. Here\'s an example:\n```python\ndef my_function():\n    print(\'Hello, World!\')\n```\n"\n\n# Notes\n\n- Consider edge cases where a short response may need additional detail for clarity, especially in code assistance.\n- Adapt the level of detail based on the complexity of the query while maintaining brevity.',
          },
        ],
      },
    ],
    temperature,
    max_tokens: 2048,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    response_format: {
      type: "text",
    },
  });

  console.dir(response);

  return response.choices[0].message?.content;
}

export const data = new SlashCommandBuilder()
  .setName("gpt")
  .setDescription("Replies with LLM response (currently OpenAI gpt-4o-mini)")
  .addStringOption((option) =>
    option.setName("prompt").setDescription("The prompt to send to the LLM")
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const prompt =
    interaction.options.getString("prompt") ??
    "Shoot, I forgot what I was asking...";

  try {
    console.log(`⚡️: Searching OpenAI API for '${prompt}'...`);
    await interaction.deferReply({ ephemeral: true });
    const result = await getCompletionFromMessages();
    await interaction.editReply(result ?? "No result returned.");
  } catch (error) {
    console.log(error);
    await interaction.editReply(error ?? "Unknown error returned.");
  }
}
