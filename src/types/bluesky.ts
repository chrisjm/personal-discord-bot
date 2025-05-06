/**
 * Types for Bluesky AT Protocol integration
 */

export interface BlueskyPost {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  record: {
    text: string;
    createdAt: string;
    $type: string;
    embed?: {
      $type: string;
      [key: string]: any;
    };
    reply?: {
      parent: { uri: string; cid: string };
      root: { uri: string; cid: string };
    };
  };
  indexedAt: string;
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
}

export type Theme = string;
export type Summary = Record<Theme, BlueskyPost[]>;

export interface BlueskyConfig {
  apiUrl: string;
  handle: string;
  password?: string;
  appPassword?: string;
  channelId: string;
  cronSchedule: string;
}
