import { TextChannel } from "discord.js";
import { RSSItem } from "./rssDatabase";

export async function displayNewEntries(
  channel: TextChannel,
  items: RSSItem[],
  sourceName: string,
): Promise<void> {
  if (items.length === 0) return;

  // Sort items by publication date, newest first
  const sortedItems = [...items].sort((a, b) => {
    const dateA = new Date(a.pubDate);
    const dateB = new Date(b.pubDate);
    return dateB.getTime() - dateA.getTime();
  });

  // Create a message with all items
  const message = sortedItems
    .map((item) => {
      const description = item.content
        ? `\n  ${item.content.substring(0, 200)}${
            item.content.length > 200 ? "..." : ""
          }`
        : "";
      return `• **${item.title}**\n  Source: ${sourceName}${description}\n  ${item.link}`;
    })
    .join("\n\n");

  // Split message if it's too long (Discord's 2000 character limit)
  const chunks = splitMessage(message);

  // Send each chunk
  for (const chunk of chunks) {
    await channel.send(chunk);
  }
}

function splitMessage(message: string, maxLength: number = 2000): string[] {
  const chunks: string[] = [];
  let currentChunk = "";

  const lines = message.split("\n\n");
  for (const line of lines) {
    // If adding this line would exceed the limit, start a new chunk
    if (currentChunk.length + line.length + 2 > maxLength) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = line;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + line;
    }
  }

  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}
