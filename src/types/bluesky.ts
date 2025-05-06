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
  quote?: {
    uri: string;
    cid: string;
    text: string;
    author: {
      did: string;
      handle: string;
      displayName?: string;
    };
  };
}

export type Summary = BlueskyPost[];

export interface BlueskyConfig {
  apiUrl: string;
  handle: string;
  password?: string;
  appPassword?: string;
  channelId: string;
  cronSchedule: string;
}
