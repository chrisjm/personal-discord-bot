import { AtpAgent } from '@atproto/api';
import { db } from '../db';
import { blueskyFeedCache } from '../db/schema/blueskyCache';
import { BlueskyConfig, BlueskyPost, Summary } from '../types/bluesky';
import fs from 'fs';
import path from 'path';
import { openaiProvider } from '../commands/llms/providers/openai';

/**
 * Processes a batch of posts using GPT-4.1-mini to categorize and summarize them
 * @param posts Array of Bluesky posts to process
 * @returns An array of objects containing post URI, theme, and summary
 */
async function summarizePosts(posts: BlueskyPost[]): Promise<string> {
  if (posts.length === 0) return '';

  try {
    // Format the posts for the prompt
    const postsText = posts.map((post, index) => {
      const authorName = post.author.displayName || post.author.handle;
      return `POST ${index + 1}: [${post.uri}] ${authorName}: "${post.record.text}"`;
    }).join('\n\n');

    const prompt = `
      Analyze the following social media posts, group them into themes, and summarize each theme. Feel free to use emojis and Discord formatting.

      Here are the posts to analyze:
      ${postsText}
    `;

    const result = await openaiProvider.complete(prompt, {
      model: "gpt-4o-mini",
      maxTokens: 5000,
      temperature: 0.3
    });

    return result.content;
  } catch (error) {
    console.error('Error processing posts with GPT-4.1-mini:', error);
    return '';
  }
}

// Path to store session data
const SESSION_FILE_PATH = path.join(process.cwd(), '.bluesky-session.json');

// Session data interface
interface SessionData {
  accessJwt: string;
  refreshJwt: string;
  handle: string;
  did: string;
  expiresAt?: number; // When the access token expires
}

// Global state
let agent: AtpAgent | null = null;
let config: BlueskyConfig | null = null;
let cursor: string | undefined = undefined;
let sessionData: SessionData | undefined = undefined;
let sessionRefreshTimer: NodeJS.Timeout | undefined = undefined;

/**
 * Initialize the Bluesky configuration
 */
const initConfig = (): BlueskyConfig => {
  return {
    apiUrl: process.env.BLUESKY_API_URL || 'https://bsky.social',
    handle: process.env.BLUESKY_ACCOUNT_HANDLE || '',
    appPassword: process.env.BLUESKY_API_TOKEN || '',
    channelId: process.env.BLUESKY_CHANNEL_ID || '',
    cronSchedule: process.env.CRON_SCHEDULE || '0 * * * *'
  };
};

/**
 * Loads a saved session from disk if available
 */
const loadSession = async (): Promise<void> => {
  try {
    if (fs.existsSync(SESSION_FILE_PATH)) {
      const data = fs.readFileSync(SESSION_FILE_PATH, 'utf8');
      sessionData = JSON.parse(data);

      // Check if we have valid session data
      if (sessionData && sessionData.refreshJwt) {
        console.log(`Loaded Bluesky session for ${sessionData.handle}`);

        // Schedule refresh before token expires
        scheduleRefresh();
      }
    }
  } catch (error) {
    console.error('Failed to load Bluesky session:', error);
    sessionData = undefined;
  }
};

/**
 * Saves the current session to disk
 */
const saveSession = (): void => {
  try {
    if (sessionData) {
      fs.writeFileSync(
        SESSION_FILE_PATH,
        JSON.stringify(sessionData, null, 2),
        'utf8'
      );
      console.log('Bluesky session saved');
    }
  } catch (error) {
    console.error('Failed to save Bluesky session:', error);
  }
};

/**
 * Schedules a refresh of the access token before it expires
 */
const scheduleRefresh = (): void => {
  // Clear any existing timer
  if (sessionRefreshTimer) {
    clearTimeout(sessionRefreshTimer);
  }

  // If we have an expiration time, schedule refresh 5 minutes before expiry
  if (sessionData?.expiresAt) {
    const now = Date.now();
    const expiresAt = sessionData.expiresAt;

    // Calculate time until refresh (5 minutes before expiry)
    const refreshIn = Math.max(0, expiresAt - now - 5 * 60 * 1000);

    console.log(`Scheduling Bluesky token refresh in ${Math.round(refreshIn / 60000)} minutes`);

    sessionRefreshTimer = setTimeout(() => {
      refreshSession();
    }, refreshIn);
  }
};

/**
 * Performs a full login with username and password
 */
const login = async (): Promise<boolean> => {
  try {
    if (!config || !config.handle || !config.appPassword) {
      console.error('Bluesky credentials not configured');
      return false;
    }

    console.log(`Logging in to Bluesky as ${config.handle}`);

    if (!agent) {
      console.error('Bluesky agent not initialized');
      return false;
    }

    const result = await agent.com.atproto.server.createSession({
      identifier: config.handle,
      password: config.appPassword
    });

    // Store the session data
    sessionData = {
      accessJwt: result.data.accessJwt,
      refreshJwt: result.data.refreshJwt,
      handle: result.data.handle,
      did: result.data.did,
      // Set expiry to 2 hours from now (typical JWT expiry)
      expiresAt: Date.now() + 2 * 60 * 60 * 1000
    };

    // Update agent's auth header with the access token
    if (agent && sessionData) {
      agent.setHeader('authorization', `Bearer ${sessionData.accessJwt}`);
    }

    // Save the session
    saveSession();

    // Schedule refresh
    scheduleRefresh();

    return true;
  } catch (error) {
    console.error('Failed to login to Bluesky:', error);
    return false;
  }
};

/**
 * Refreshes the session using the refresh token
 */
const refreshSession = async (): Promise<boolean> => {
  try {
    if (!sessionData?.refreshJwt) {
      console.log('No refresh token available, performing full login');
      return login();
    }

    console.log('Refreshing Bluesky session token');

    try {
      if (!agent) {
        return false;
      }

      // Use the refresh token to get a new session
      // Note: The AtpAgent expects refreshJwt in the auth header for this call
      agent.setHeader('authorization', `Bearer ${sessionData.refreshJwt}`);
      const result = await agent.com.atproto.server.refreshSession();

      // Update session data with new tokens
      sessionData = {
        ...sessionData,
        accessJwt: result.data.accessJwt,
        refreshJwt: result.data.refreshJwt,
        // Set expiry to 2 hours from now (typical JWT expiry)
        expiresAt: Date.now() + 2 * 60 * 60 * 1000
      };

      // Update agent's auth header with the access token
      if (agent && sessionData) {
        agent.setHeader('authorization', `Bearer ${sessionData.accessJwt}`);
      }

      // Save the updated session
      saveSession();

      // Schedule the next refresh
      scheduleRefresh();

      return true;
    } catch (error) {
      console.log('Session refresh failed, attempting full login');
      return login();
    }
  } catch (error) {
    console.error('Failed to refresh Bluesky session:', error);

    // Try a full login as fallback
    return login();
  }
};

/**
 * Initializes the Bluesky agent with credentials
 */
const init = async (): Promise<boolean> => {
  // Initialize if not already done
  if (!agent) {
    config = initConfig();
    agent = new AtpAgent({
      service: config.apiUrl
    });

    // Try to load saved session
    await loadSession();
  }

  // If we have a valid session with refresh token, try to use it
  if (sessionData?.refreshJwt) {
    return refreshSession();
  } else {
    return login();
  }
};

/**
 * Gets the channel ID for posting summaries
 */
const getChannelId = (): string => {
  return config?.channelId || '';
};

/**
 * Gets the cron schedule expression
 */
const getCronSchedule = (): string => {
  return config?.cronSchedule || '0 * * * *';
};

/**
 * Fetches and summarizes the Bluesky feed for a specific time period
 * @param startTime Optional start time in ISO format; defaults to 1 hour ago
 * @param endTime Optional end time in ISO format; defaults to now
 */
const fetchAndSummarize = async (startTime?: string, endTime?: string): Promise<string> => {
  if (!await init()) {
    return '';
  }

  try {
    if (!agent) {
      console.error('Bluesky agent not initialized');
      return '';
    }

    // Default time range: last hour
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const start = startTime ? new Date(startTime) : oneHourAgo;
    const end = endTime ? new Date(endTime) : now;

    console.log(`Fetching Bluesky posts from ${start.toISOString()} to ${end.toISOString()}`);

    // Get timeline with a higher limit to capture the full hour
    const timeline = await agent.api.app.bsky.feed.getTimeline({
      limit: 100 // Increased from 50
    });

    // Update cursor for next fetch
    cursor = timeline.data.cursor;

    // Transform to our BlueskyPost type
    let posts: BlueskyPost[] = timeline.data.feed.map(item => ({
      uri: item.post.uri,
      cid: item.post.cid,
      author: {
        did: item.post.author.did,
        handle: item.post.author.handle,
        displayName: item.post.author.displayName,
        avatar: item.post.author.avatar
      },
      record: item.post.record as any,
      indexedAt: item.post.indexedAt,
      likeCount: item.post.likeCount,
      repostCount: item.post.repostCount,
      replyCount: item.post.replyCount
    }));

    // Filter posts by time range
    posts = posts.filter(post => {
      const postDate = new Date(post.indexedAt);
      return postDate >= start && postDate <= end;
    });

    console.log(`Found ${posts.length} posts in the specified time range`);

    if (posts.length === 0) {
      return '';
    }

    // Store posts in cache
    await db.insert(blueskyFeedCache).values(posts.map(post => ({
      record_uri: post.uri,
      fetched_at: Date.now(),
      theme: '',
      content: post.record.text
    })));

    // Summarize posts
    const summarizedPosts = await summarizePosts(posts);

    return summarizedPosts;
  } catch (error) {
    console.error('Error fetching Bluesky feed:', error);
    return '';
  }
};

// Initialize the service
init().catch(error => console.error('Failed to initialize Bluesky service:', error));

// Export the functions
export {
  fetchAndSummarize,
  getChannelId,
  getCronSchedule
};

// Ensure clean shutdown
process.on('SIGINT', () => {
  if (sessionRefreshTimer) {
    clearTimeout(sessionRefreshTimer);
  }
});
