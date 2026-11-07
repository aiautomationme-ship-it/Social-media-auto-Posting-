import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  MonthlyTarget,
  VideoRecord,
  SocialPost,
  PlatformConnection,
  ActivityLog,
  PlatformType,
  DashboardStats,
  PlatformPostConfig,
  WebhookDiagnosticLog,
} from '../src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'socialflow-db.json');
const UPLOADS_DIR = path.resolve(__dirname, '../uploads/videos');

export interface AppSettings {
  webhookUrl: string;
  platformWebhooks?: {
    tiktok?: string;
    instagram?: string;
    facebook?: string;
  };
  payloadMode?: 'multipart' | 'json';
  timeZone?: string;
  timeFormat?: '12h' | '24h';
  defaultAdvanceHours?: number;
  autoPreviewVideos?: boolean;
  showToasts?: boolean;
}

export interface DatabaseSchema {
  users: Array<{ id: string; email: string; name: string }>;
  targets: MonthlyTarget[];
  videos: VideoRecord[];
  posts: SocialPost[];
  platforms: Record<string, Record<PlatformType, PlatformConnection>>; // userId -> platform -> connection
  activity: ActivityLog[];
  settings: AppSettings;
  webhookLogs: WebhookDiagnosticLog[];
}

const DEFAULT_PLATFORMS: Record<PlatformType, PlatformConnection> = {
  tiktok: {
    platform: 'tiktok',
    name: 'TikTok',
    connected: true,
    requiredScopes: ['video.upload', 'video.publish', 'user.info.basic'],
    grantedScopes: ['video.upload', 'video.publish', 'user.info.basic'],
    apiMode: 'live',
    accountName: 'TikTok (Backend / n8n Workflow)',
    details: 'Authentication & tokens managed by backend workflow',
  },
  instagram: {
    platform: 'instagram',
    name: 'Instagram Reels',
    connected: true,
    requiredScopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list'],
    grantedScopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list'],
    apiMode: 'live',
    accountName: 'Instagram Reels (Backend / n8n Workflow)',
    details: 'Authentication & tokens managed by backend workflow',
  },
  facebook: {
    platform: 'facebook',
    name: 'Facebook Page',
    connected: true,
    requiredScopes: ['pages_manage_posts', 'pages_read_engagement', 'publish_video'],
    grantedScopes: ['pages_manage_posts', 'pages_read_engagement', 'publish_video'],
    apiMode: 'live',
    accountName: 'Facebook Page (Backend / n8n Workflow)',
    details: 'Authentication & tokens managed by backend workflow',
  },
};

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

export class JsonDB {
  private static instance: JsonDB;
  private data: DatabaseSchema;

  private constructor() {
    ensureDirectories();
    this.data = this.load();
  }

  public static getInstance(): JsonDB {
    if (!JsonDB.instance) {
      JsonDB.instance = new JsonDB();
    }
    return JsonDB.instance;
  }

  private load(): DatabaseSchema {
    const defaultSettings: AppSettings = {
      webhookUrl:
        process.env.N8N_PUBLISH_WEBHOOK_URL || process.env.PUBLISHING_WORKFLOW_URL || '',
      timeZone: 'Asia/Karachi',
    };

    try {
      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        return {
          users: parsed.users || [{ id: 'user_default', email: 'aiautomationme@gmail.com', name: 'AI Automation' }],
          targets: parsed.targets || [],
          videos: parsed.videos || [],
          posts: parsed.posts || [],
          platforms: parsed.platforms || {},
          activity: parsed.activity || [],
          settings: parsed.settings || defaultSettings,
          webhookLogs: parsed.webhookLogs || [],
        };
      }
    } catch (err) {
      console.error('Error loading DB file, initializing clean database:', err);
    }

    const initial: DatabaseSchema = {
      users: [{ id: 'user_default', email: 'aiautomationme@gmail.com', name: 'AI Automation' }],
      targets: [],
      videos: [],
      posts: [],
      platforms: {},
      activity: [],
      settings: defaultSettings,
      webhookLogs: [],
    };
    this.saveDirect(initial);
    return initial;
  }

  private saveDirect(dataToSave: DatabaseSchema) {
    ensureDirectories();
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(dataToSave, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  }

  private persist() {
    this.saveDirect(this.data);
  }

  // --- Settings ---
  public getSettings(): AppSettings {
    if (!this.data.settings) {
      this.data.settings = {
        webhookUrl:
          process.env.N8N_PUBLISH_WEBHOOK_URL || process.env.PUBLISHING_WORKFLOW_URL || '',
        timeZone: 'Asia/Karachi',
      };
      this.persist();
    }
    return this.data.settings;
  }

  public updateSettings(update: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    this.data.settings = {
      ...current,
      ...update,
    };
    this.persist();
    return this.data.settings;
  }

  // --- Webhook Diagnostic Logs ---
  public logWebhookDiagnostic(
    log: Omit<WebhookDiagnosticLog, 'id' | 'timestamp'>
  ): WebhookDiagnosticLog {
    if (!this.data.webhookLogs) {
      this.data.webhookLogs = [];
    }
    const entry: WebhookDiagnosticLog = {
      ...log,
      id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    this.data.webhookLogs.unshift(entry);
    if (this.data.webhookLogs.length > 50) {
      this.data.webhookLogs = this.data.webhookLogs.slice(0, 50);
    }
    this.persist();
    return entry;
  }

  public getWebhookDiagnostics(limit = 20): WebhookDiagnosticLog[] {
    if (!this.data.webhookLogs) {
      this.data.webhookLogs = [];
    }
    return this.data.webhookLogs.slice(0, limit);
  }

  // --- Users ---
  public getUser(userId: string) {
    return this.data.users.find((u) => u.id === userId) || this.data.users[0];
  }

  // --- Activity ---
  public logActivity(userId: string, item: Omit<ActivityLog, 'id' | 'userId' | 'timestamp'>) {
    const entry: ActivityLog = {
      ...item,
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      timestamp: new Date().toISOString(),
    };
    this.data.activity.unshift(entry);
    // Keep max 100 recent activities
    if (this.data.activity.length > 100) {
      this.data.activity = this.data.activity.slice(0, 100);
    }
    this.persist();
    return entry;
  }

  public getActivities(userId: string, limit = 20): ActivityLog[] {
    return this.data.activity.filter((a) => a.userId === userId).slice(0, limit);
  }

  // --- Targets ---
  public getTarget(userId: string, month: number, year: number): MonthlyTarget | null {
    return (
      this.data.targets.find(
        (t) => t.userId === userId && t.month === Number(month) && t.year === Number(year)
      ) || null
    );
  }

  public getAllTargets(userId: string): MonthlyTarget[] {
    return this.data.targets.filter((t) => t.userId === userId);
  }

  public setTarget(userId: string, month: number, year: number, targetCount: number): MonthlyTarget {
    if (targetCount <= 0 || !Number.isInteger(targetCount)) {
      throw new Error('Target count must be a positive integer');
    }
    if (month < 1 || month > 12) {
      throw new Error('Month must be between 1 and 12');
    }
    if (year < 2000 || year > 2100) {
      throw new Error('Invalid year provided');
    }

    const existingIndex = this.data.targets.findIndex(
      (t) => t.userId === userId && t.month === month && t.year === year
    );

    const now = new Date().toISOString();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const monthName = monthNames[month - 1];

    if (existingIndex >= 0) {
      const updated: MonthlyTarget = {
        ...this.data.targets[existingIndex],
        targetCount,
        updatedAt: now,
      };
      this.data.targets[existingIndex] = updated;
      this.logActivity(userId, {
        type: 'target_updated',
        title: `Updated Target for ${monthName} ${year}`,
        description: `Target set to ${targetCount} confirmed published posts`,
      });
      this.persist();
      return updated;
    } else {
      const created: MonthlyTarget = {
        id: `tgt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId,
        month,
        year,
        targetCount,
        createdAt: now,
        updatedAt: now,
      };
      this.data.targets.push(created);
      this.logActivity(userId, {
        type: 'target_created',
        title: `Set New Target for ${monthName} ${year}`,
        description: `Goal of ${targetCount} confirmed published posts`,
      });
      this.persist();
      return created;
    }
  }

  public updateTarget(userId: string, targetId: string, targetCount: number): MonthlyTarget {
    if (targetCount <= 0 || !Number.isInteger(targetCount)) {
      throw new Error('Target count must be a positive integer');
    }
    const target = this.data.targets.find((t) => t.id === targetId && t.userId === userId);
    if (!target) {
      throw new Error('Monthly target not found or unauthorized');
    }
    target.targetCount = targetCount;
    target.updatedAt = new Date().toISOString();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    this.logActivity(userId, {
      type: 'target_updated',
      title: `Updated Target for ${monthNames[target.month - 1]} ${target.year}`,
      description: `Target changed to ${targetCount} published posts`,
    });
    this.persist();
    return target;
  }

  public deleteTarget(userId: string, targetId: string): boolean {
    const index = this.data.targets.findIndex((t) => t.id === targetId && t.userId === userId);
    if (index === -1) {
      return false;
    }
    const deleted = this.data.targets.splice(index, 1)[0];
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    this.logActivity(userId, {
      type: 'target_deleted',
      title: `Deleted Target for ${monthNames[deleted.month - 1]} ${deleted.year}`,
      description: `Previous target of ${deleted.targetCount} removed`,
    });
    this.persist();
    return true;
  }

  // --- Videos ---
  public addVideo(video: Omit<VideoRecord, 'id' | 'uploadedAt'>): VideoRecord {
    const newVideo: VideoRecord = {
      ...video,
      id: `vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      uploadedAt: new Date().toISOString(),
    };
    this.data.videos.unshift(newVideo);
    this.logActivity(newVideo.userId, {
      type: 'video_uploaded',
      title: `Uploaded video "${newVideo.originalName}"`,
      description: `File size: ${(newVideo.fileSize / (1024 * 1024)).toFixed(1)} MB`,
      videoId: newVideo.id,
    });
    this.persist();
    return newVideo;
  }

  public addVideos(videos: Omit<VideoRecord, 'id' | 'uploadedAt'>[]): VideoRecord[] {
    const created: VideoRecord[] = [];
    for (const item of videos) {
      const newVideo: VideoRecord = {
        ...item,
        id: `vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        uploadedAt: new Date().toISOString(),
      };
      this.data.videos.unshift(newVideo);
      created.push(newVideo);
      this.logActivity(newVideo.userId, {
        type: 'video_uploaded',
        title: `Uploaded video "${newVideo.originalName}"`,
        description: `File size: ${(newVideo.fileSize / (1024 * 1024)).toFixed(1)} MB`,
        videoId: newVideo.id,
      });
    }
    // Persist once for the entire batch
    this.persist();
    return created;
  }

  public getVideos(userId: string): VideoRecord[] {
    return this.data.videos.filter((v) => v.userId === userId);
  }

  public getVideo(userId: string, videoId: string): VideoRecord | null {
    return this.data.videos.find((v) => v.id === videoId && v.userId === userId) || null;
  }

  public deleteVideo(userId: string, videoId: string): boolean {
    let index = this.data.videos.findIndex((v) => v.id === videoId && v.userId === userId);
    if (index === -1) {
      index = this.data.videos.findIndex((v) => v.id === videoId);
    }
    if (index === -1) return false;

    const video = this.data.videos[index];
    // Delete file on disk if exists
    const uploadsDir = path.resolve(process.cwd(), 'uploads/videos');
    const filePath = path.resolve(uploadsDir, video.filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('Failed to delete physical video file:', err);
      }
    }

    this.data.videos.splice(index, 1);
    this.logActivity(userId || video.userId || 'user_default', {
      type: 'video_deleted',
      title: `Deleted video "${video.originalName}"`,
      description: `Video file and record removed from library`,
      videoId: video.id,
    });
    this.persist();
    return true;
  }

  public updateVideo(userId: string, videoId: string, update: { originalName?: string }): VideoRecord {
    let video = this.data.videos.find((v) => v.id === videoId && v.userId === userId);
    if (!video) {
      video = this.data.videos.find((v) => v.id === videoId);
    }
    if (!video) throw new Error('Video not found');
    if (update.originalName && update.originalName.trim()) {
      video.originalName = update.originalName.trim();
    }
    this.persist();
    return video;
  }

  public replaceVideoFile(
    userId: string,
    videoId: string,
    newFile: { filename: string; originalName: string; fileSize: number; mimeType: string }
  ): VideoRecord {
    let video = this.data.videos.find((v) => v.id === videoId && v.userId === userId);
    if (!video) {
      video = this.data.videos.find((v) => v.id === videoId);
    }
    if (!video) throw new Error('Video not found');

    const uploadsDir = path.resolve(process.cwd(), 'uploads/videos');
    const oldPath = path.resolve(uploadsDir, video.filename);
    if (fs.existsSync(oldPath)) {
      try {
        fs.unlinkSync(oldPath);
      } catch (err) {
        console.error('Failed to unlink old video file during replacement:', err);
      }
    }

    video.filename = newFile.filename;
    video.originalName = newFile.originalName;
    video.fileUrl = `/uploads/videos/${newFile.filename}`;
    video.fileSize = newFile.fileSize;
    video.mimeType = newFile.mimeType;
    video.uploadedAt = new Date().toISOString();

    this.logActivity(userId || video.userId || 'user_default', {
      type: 'video_uploaded',
      title: `Replaced video file for "${video.originalName}"`,
      description: `New file size: ${(video.fileSize / (1024 * 1024)).toFixed(1)} MB`,
      videoId: video.id,
    });

    this.persist();
    return video;
  }

  // --- Platforms (Backend-Managed Destinations) ---
  public getPlatforms(userId: string): Record<PlatformType, PlatformConnection> {
    if (!this.data.platforms[userId]) {
      this.data.platforms[userId] = JSON.parse(JSON.stringify(DEFAULT_PLATFORMS));
      this.persist();
    }
    const plats = this.data.platforms[userId];
    let changed = false;
    for (const key of ['tiktok', 'instagram', 'facebook'] as PlatformType[]) {
      if (!plats[key] || !plats[key].connected) {
        plats[key] = {
          ...DEFAULT_PLATFORMS[key],
          ...(plats[key] || {}),
          connected: true,
          accountName: plats[key]?.accountName || DEFAULT_PLATFORMS[key].accountName,
        };
        changed = true;
      }
    }
    if (changed) {
      this.persist();
    }
    return this.data.platforms[userId];
  }

  public updatePlatformConnection(
    userId: string,
    platform: PlatformType,
    update: Partial<PlatformConnection>
  ): PlatformConnection {
    const platforms = this.getPlatforms(userId);
    const existing = platforms[platform] || { ...DEFAULT_PLATFORMS[platform] };
    const updated = {
      ...existing,
      ...update,
    };
    platforms[platform] = updated;
    this.data.platforms[userId] = platforms;

    if (update.connected === true) {
      this.logActivity(userId, {
        type: 'platform_connected',
        platform,
        title: `Connected to ${updated.name}`,
        description: `Account: ${updated.accountName || 'Active account'}`,
      });
    } else if (update.connected === false) {
      this.logActivity(userId, {
        type: 'platform_disconnected',
        platform,
        title: `Disconnected from ${updated.name}`,
        description: `Platform access revoked`,
      });
    }

    this.persist();
    return updated;
  }

  // --- Posts ---
  public getPosts(userId: string): SocialPost[] {
    const userPosts = this.data.posts.filter((p) => p.userId === userId);
    // Enrich with video record
    return userPosts.map((post) => {
      const video = this.data.videos.find((v) => v.id === post.videoId);
      return {
        ...post,
        video,
      };
    });
  }

  public getPost(userId: string, postId: string): SocialPost | null {
    const post = this.data.posts.find((p) => p.id === postId && p.userId === userId);
    if (!post) return null;
    const video = this.data.videos.find((v) => v.id === post.videoId);
    return {
      ...post,
      video,
    };
  }

  public createPost(
    userId: string,
    params: {
      videoId: string;
      title: string;
      defaultScheduledAt?: string | null;
      platforms: Record<PlatformType, PlatformPostConfig>;
    }
  ): SocialPost {
    const now = new Date().toISOString();
    // Determine overall post status
    let status: SocialPost['status'] = 'draft';
    const enabledPlatforms = Object.values(params.platforms).filter((p) => p.enabled);
    if (enabledPlatforms.some((p) => p.status === 'scheduled')) {
      status = 'scheduled';
    } else if (enabledPlatforms.some((p) => p.status === 'ready')) {
      status = 'ready';
    }

    const newPost: SocialPost = {
      id: `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      videoId: params.videoId,
      title: params.title || 'Untitled Post',
      defaultScheduledAt: params.defaultScheduledAt || null,
      platforms: params.platforms,
      status,
      createdAt: now,
      updatedAt: now,
    };

    this.data.posts.unshift(newPost);

    this.logActivity(userId, {
      type: status === 'scheduled' ? 'post_scheduled' : 'post_created',
      title: `Created post "${newPost.title}"`,
      description:
        status === 'scheduled'
          ? `Scheduled for publishing across ${enabledPlatforms.length} platform(s)`
          : `Saved draft for ${enabledPlatforms.length} destination platform(s)`,
      postId: newPost.id,
      videoId: newPost.videoId,
    });

    this.persist();
    const video = this.data.videos.find((v) => v.id === newPost.videoId);
    return { ...newPost, video };
  }

  public updatePost(
    userId: string,
    postId: string,
    update: Partial<SocialPost>
  ): SocialPost {
    const index = this.data.posts.findIndex((p) => p.id === postId && p.userId === userId);
    if (index === -1) {
      throw new Error('Post not found');
    }

    const existing = this.data.posts[index];
    const updated: SocialPost = {
      ...existing,
      ...update,
      updatedAt: new Date().toISOString(),
    };

    // Calculate aggregated overall status
    const enabledPlatforms = Object.values(updated.platforms).filter((p) => p.enabled);
    if (enabledPlatforms.length > 0 && enabledPlatforms.every((p) => p.status === 'published')) {
      updated.status = 'published';
    } else if (enabledPlatforms.some((p) => p.status === 'publishing')) {
      updated.status = 'publishing';
    } else if (enabledPlatforms.some((p) => p.status === 'pending_confirmation')) {
      updated.status = 'pending_confirmation';
    } else if (enabledPlatforms.some((p) => p.status === 'scheduled')) {
      updated.status = 'scheduled';
    } else if (enabledPlatforms.some((p) => p.status === 'failed')) {
      updated.status = 'failed';
    } else if (enabledPlatforms.some((p) => p.status === 'cancelled')) {
      updated.status = 'cancelled';
    }

    this.data.posts[index] = updated;
    this.persist();
    const video = this.data.videos.find((v) => v.id === updated.videoId);
    return { ...updated, video };
  }

  public deletePost(userId: string, postId: string): boolean {
    const index = this.data.posts.findIndex((p) => p.id === postId && p.userId === userId);
    if (index === -1) return false;

    const post = this.data.posts.splice(index, 1)[0];
    this.logActivity(userId, {
      type: 'post_cancelled',
      title: `Deleted post "${post.title}"`,
      description: `Post record removed`,
      postId: post.id,
    });
    this.persist();
    return true;
  }

  // --- Scheduler Query Helper (Internal/Backend) ---
  public getAllScheduledPosts(): SocialPost[] {
    return this.data.posts.filter((post) => {
      if (post.status === 'cancelled' || post.status === 'published') return false;
      const platforms = Object.values(post.platforms);
      return platforms.some(
        (p) => p.enabled && p.status === 'scheduled' && p.scheduledAt
      );
    });
  }

  // --- Dashboard Aggregations (Rule: Only count confirmed published posts) ---
  public getDashboardStats(userId: string, month: number, year: number): DashboardStats {
    const target = this.getTarget(userId, month, year);
    const targetCount = target ? target.targetCount : 0;

    // Get all user posts
    const userPosts = this.data.posts.filter((p) => p.userId === userId);

    // Confirmed published posts rule:
    // A post or platform post is confirmed published ONLY if status === 'published' AND publishedAt is in the requested month & year.
    // Progress is measured by unique posts that achieved publication, or confirmed platform publications in that month.
    let confirmedPublishedCount = 0;
    const platformPublishedCounts: Record<PlatformType, number> = {
      tiktok: 0,
      instagram: 0,
      facebook: 0,
    };
    const platformScheduledCounts: Record<PlatformType, number> = {
      tiktok: 0,
      instagram: 0,
      facebook: 0,
    };

    userPosts.forEach((post) => {
      let postCountedForMonth = false;
      const platforms: PlatformType[] = ['tiktok', 'instagram', 'facebook'];

      platforms.forEach((plat) => {
        const platConfig = post.platforms[plat];
        if (platConfig && platConfig.enabled) {
          if (platConfig.status === 'published' && platConfig.publishedAt) {
            const pubDate = new Date(platConfig.publishedAt);
            if (pubDate.getMonth() + 1 === month && pubDate.getFullYear() === year) {
              platformPublishedCounts[plat]++;
              if (!postCountedForMonth) {
                confirmedPublishedCount++;
                postCountedForMonth = true;
              }
            }
          } else if (platConfig.status === 'scheduled') {
            platformScheduledCounts[plat]++;
          }
        }
      });
    });

    const remainingPostsNeeded = Math.max(0, targetCount - confirmedPublishedCount);
    const progressPercentage =
      targetCount > 0 ? Math.min(100, Math.round((confirmedPublishedCount / targetCount) * 100)) : 0;

    // Upcoming posts: scheduled posts for future
    const upcomingPosts = userPosts
      .filter((post) => {
        const platforms = Object.values(post.platforms);
        return platforms.some((p) => p.enabled && p.status === 'scheduled');
      })
      .map((post) => {
        const video = this.data.videos.find((v) => v.id === post.videoId);
        return { ...post, video };
      })
      .sort((a, b) => {
        const timeA = a.defaultScheduledAt ? new Date(a.defaultScheduledAt).getTime() : 0;
        const timeB = b.defaultScheduledAt ? new Date(b.defaultScheduledAt).getTime() : 0;
        return timeA - timeB;
      });

    // Platforms status
    const platformConnections = this.getPlatforms(userId);
    const platformOverview: DashboardStats['platformOverview'] = {
      tiktok: {
        connected: platformConnections.tiktok?.connected || false,
        publishedCount: platformPublishedCounts.tiktok,
        scheduledCount: platformScheduledCounts.tiktok,
        accountName: platformConnections.tiktok?.accountName,
      },
      instagram: {
        connected: platformConnections.instagram?.connected || false,
        publishedCount: platformPublishedCounts.instagram,
        scheduledCount: platformScheduledCounts.instagram,
        accountName: platformConnections.instagram?.accountName,
      },
      facebook: {
        connected: platformConnections.facebook?.connected || false,
        publishedCount: platformPublishedCounts.facebook,
        scheduledCount: platformScheduledCounts.facebook,
        accountName: platformConnections.facebook?.accountName,
      },
    };

    return {
      target,
      targetCount,
      confirmedPublishedCount,
      remainingPostsNeeded,
      progressPercentage,
      selectedMonth: month,
      selectedYear: year,
      upcomingPosts,
      recentActivity: this.getActivities(userId, 15),
      platformOverview,
    };
  }
}
