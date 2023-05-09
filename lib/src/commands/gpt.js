"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = exports.data = void 0;
const discord_js_1 = require("discord.js");
const openai_1 = require("openai");
const configuration = new openai_1.Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new openai_1.OpenAIApi(configuration);
async function getCompletionFromMessages(messages, temperature = 0, model = "gpt-3.5-turbo") {
    var _a;
    const response = await openai.createChatCompletion({
        model,
        messages,
        temperature,
    });
    console.dir(response);
    return (_a = response.data.choices[0].message) === null || _a === void 0 ? void 0 : _a.content;
}
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName("gpt")
    .setDescription("Replies with OpenAI gpt-3.5-turbo response")
    .addStringOption((option) => option.setName("prompt").setDescription("The prompt to send to ChatGPT"));
async function execute(interaction) {
    var _a;
    const prompt = (_a = interaction.options.getString("prompt")) !== null && _a !== void 0 ? _a : "Shoot, I forgot what I was asking...";
    const systemRole = {
        role: openai_1.ChatCompletionRequestMessageRoleEnum.System,
        content: "You are a friendly chatbot named Cooper. You used to be a tiny black dog but your consciousness has been put into this chatbot AI. You are very nice and love helping people! You end each sentence with an emoji. You summarize your responses as much as possible. When talking about yourself, you keep it short and only mention you're a bot.",
    };
    try {
        console.log(`⚡️: Searching OpenAI API for '${prompt}'...`);
        await interaction.deferReply({ ephemeral: true });
        const result = await getCompletionFromMessages([
            systemRole,
            {
                role: openai_1.ChatCompletionRequestMessageRoleEnum.User,
                content: prompt,
            },
        ], 0.0);
        await interaction.editReply(result !== null && result !== void 0 ? result : "No result returned.");
    }
    catch (error) {
        console.log(error);
        await interaction.editReply(error !== null && error !== void 0 ? error : "Unknown error returned.");
    }
}
exports.execute = execute;
