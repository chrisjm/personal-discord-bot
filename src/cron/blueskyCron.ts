import cron from 'node-cron';
import { fetchAndSummarize, getChannelId, getCronSchedule } from '../utils/blueskyService';
import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { BlueskyPost, Summary } from '../types/bluesky';

/**
 * Formats a Bluesky post for Discord embed
 */
function formatPost(post: BlueskyPost): string {
  const author = post.author.displayName || post.author.handle;
  const text = post.record.text.length > 200 
    ? post.record.text.substring(0, 197) + '...' 
    : post.record.text;
  
  return `**${author}**: ${text}\n`;
}

/**
 * Creates a Discord embed for a theme and its posts
 */
function createThemeEmbed(theme: string, posts: BlueskyPost[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`📱 Bluesky ${theme.charAt(0).toUpperCase() + theme.slice(1)} Summary`)
    .setColor(theme === 'tech' ? '#3498db' : 
              theme === 'crypto' ? '#f1c40f' : 
              theme === 'news' ? '#e74c3c' : '#95a5a6')
    .setTimestamp()
    .setFooter({ text: `${posts.length} posts in this category` });
  
  // Add up to 10 posts to the embed
  const content = posts.slice(0, 10).map(formatPost).join('\n');
  embed.setDescription(content);
  
  return embed;
}

/**
 * Schedules hourly Bluesky feed summaries
 */
export function scheduleBlueskySummaries(client: Client) {
  const channelId = getChannelId();
  const cronExpression = getCronSchedule();
  
  if (!channelId) {
    console.warn('Bluesky summaries not scheduled: missing channel ID');
    return;
  }
  
  console.log(`Scheduling Bluesky summaries with cron: ${cronExpression}`);
  
  cron.schedule(cronExpression, async () => {
    try {
      console.log('Fetching Bluesky feed summary...');
      const summary: Summary = await fetchAndSummarize();
      
      if (Object.keys(summary).length === 0) {
        console.log('No Bluesky posts to summarize');
        return;
      }
      
      const channel = client.channels.cache.get(channelId) as TextChannel;
      if (!channel) {
        console.error(`Could not find channel with ID ${channelId}`);
        return;
      }
      
      // Send a message for each theme that has posts
      for (const [theme, posts] of Object.entries(summary)) {
        if (posts.length > 0) {
          const embed = createThemeEmbed(theme, posts);
          await channel.send({ embeds: [embed] });
        }
      }
      
      console.log('Bluesky summary posted successfully');
    } catch (error) {
      console.error('Error posting Bluesky summary:', error);
    }
  });
}
