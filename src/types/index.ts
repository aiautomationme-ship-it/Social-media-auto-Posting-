export type PlatformType = 'tiktok' | 'instagram' | 'facebook';

export type PostStatus =
  | 'draft'
  | 'ready'
  | 'scheduled'
  | 'publishing'
  | 'pending_confirmation'
  | 'published'
  | 'failed'
  | 'cancelled';

export interface MonthlyTarget {
  id: string;
  userId: string;
  month: number; // 1 - 12
  year: number; // e.g. 2026
  targetCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface VideoRecord {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  duration?: number;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  uploadedAt: string;
}

export interface TikTokSettings {
  privacyLevel: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
  allowComment: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  brandDisclosure: boolean;
  brandOrganic: boolean;
}

export interface PlatformPostConfig {
  platform: PlatformType;
  enabled: boolean;
  caption: string; // Caption for Instagram, description for Facebook, title for TikTok
  scheduledAt?: string | null;
  status: PostStatus;
  publishedAt?: string | null;
  externalPostId?: string | null;
  externalPostUrl?: string | null;
  errorMessage?: string | null;
  attemptCount: number;
  tiktokSettings?: TikTokSettings;
}

export interface SocialPost {
  id: string;
  userId: string;
  videoId: string;
  video?: VideoRecord;
  title: string;
  defaultScheduledAt?: string | null;
  platforms: Record<PlatformType, PlatformPostConfig>;
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformConnection {
  platform: PlatformType;
  name: string;
  connected: boolean;
  accountName?: string;
  accountId?: string;
  connectedAt?: string;
  apiMode: 'live' | 'sandbox';
  requiredScopes: string[];
  grantedScopes: string[];
  details?: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  type:
    | 'target_created'
    | 'target_updated'
    | 'target_deleted'
    | 'video_uploaded'
    | 'video_deleted'
    | 'post_created'
    | 'post_scheduled'
    | 'post_published'
    | 'post_failed'
    | 'post_cancelled'
    | 'platform_connected'
    | 'platform_disconnected';
  title: string;
  description: string;
  timestamp: string;
  platform?: PlatformType;
  postId?: string;
  videoId?: string;
}

export interface DashboardStats {
  target: MonthlyTarget | null;
  targetCount: number;
  confirmedPublishedCount: number;
  remainingPostsNeeded: number;
  progressPercentage: number;
  selectedMonth: number;
  selectedYear: number;
  upcomingPosts: SocialPost[];
  recentActivity: ActivityLog[];
  platformOverview: Record<
    PlatformType,
    {
      connected: boolean;
      publishedCount: number;
      scheduledCount: number;
      accountName?: string;
    }
  >;
}

export interface WebhookDiagnosticLog {
  id: string;
  timestamp: string;
  url: string;
  event: string;
  platform?: string;
  isTestEvent: boolean;
  httpStatus?: number;
  statusText?: string;
  success: boolean;
  durationMs: number;
  requestPayload: any;
  responseBody?: string;
  errorMessage?: string;
}

export interface WebhookConfig {
  url: string;
  isConfigured: boolean;
  isTestUrl: boolean;
  source: 'env' | 'database' | 'none';
  supportedPlatforms: PlatformType[];
  platformWebhooks?: Partial<Record<PlatformType, string>>;
  payloadMode?: 'multipart' | 'json';
  timeZone?: string;
}

export interface WebhookTestResult {
  success: boolean;
  httpStatus?: number;
  statusText?: string;
  durationMs: number;
  url: string;
  responseBody?: string;
  dispatchedPayload: any;
  confirmationMessage?: string;
  errorMessage?: string;
}
