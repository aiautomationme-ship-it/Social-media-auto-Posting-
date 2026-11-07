import type {
  DashboardStats,
  MonthlyTarget,
  VideoRecord,
  SocialPost,
  PlatformConnection,
  ActivityLog,
  PlatformType,
} from '../types/index.ts';

const USER_ID = 'user_default';

async function fetchJson<T>(url: string, options: RequestInit = {}, retries = 3, backoffMs = 800): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    'x-user-id': USER_ID,
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, { ...options, headers });
    if (response.status === 429 && retries > 0) {
      // Exponential backoff with jitter on Cloud Run proxy rate limiting
      await new Promise((r) => setTimeout(r, backoffMs + Math.random() * 300));
      return fetchJson<T>(url, options, retries - 1, backoffMs * 2);
    }
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `Request failed with status ${response.status}`);
    }
    return response.json();
  } catch (err: any) {
    if (err.message && err.message.includes('429') && retries > 0) {
      await new Promise((r) => setTimeout(r, backoffMs + Math.random() * 300));
      return fetchJson<T>(url, options, retries - 1, backoffMs * 2);
    }
    throw err;
  }
}

export const api = {
  // Consolidated Bootstrap data (single network roundtrip, eliminates 429 bursts)
  async getBootstrapData(month: number, year: number): Promise<{
    user: { id: string; email: string; name: string; authenticated: boolean };
    stats: DashboardStats;
    videos: VideoRecord[];
    posts: SocialPost[];
    platforms: Record<PlatformType, PlatformConnection>;
    activities: ActivityLog[];
  }> {
    return fetchJson(`/api/dashboard/bootstrap?month=${month}&year=${year}`);
  },

  // Current user info
  async getCurrentUser() {
    return fetchJson<{ id: string; email: string; name: string; authenticated: boolean }>(
      '/api/auth/me'
    );
  },

  // Dashboard statistics
  async getDashboardStats(month: number, year: number): Promise<DashboardStats> {
    return fetchJson<DashboardStats>(`/api/dashboard/stats?month=${month}&year=${year}`);
  },

  // Targets
  async getTarget(month: number, year: number): Promise<{ target: MonthlyTarget | null }> {
    return fetchJson<{ target: MonthlyTarget | null }>(`/api/targets?month=${month}&year=${year}`);
  },

  async createTarget(month: number, year: number, targetCount: number): Promise<{ target: MonthlyTarget }> {
    return fetchJson<{ target: MonthlyTarget }>('/api/targets', {
      method: 'POST',
      body: JSON.stringify({ month, year, targetCount }),
    });
  },

  async updateTarget(id: string, targetCount: number): Promise<{ target: MonthlyTarget }> {
    return fetchJson<{ target: MonthlyTarget }>(`/api/targets/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ targetCount }),
    });
  },

  async deleteTarget(id: string): Promise<{ success: boolean }> {
    return fetchJson<{ success: boolean }>(`/api/targets/${id}`, {
      method: 'DELETE',
    });
  },

  // Platforms
  async getPlatforms(): Promise<Record<PlatformType, PlatformConnection>> {
    return fetchJson<Record<PlatformType, PlatformConnection>>('/api/platforms');
  },

  async connectPlatform(
    platform: PlatformType,
    params: { accountName?: string; accountId?: string; apiMode?: 'live' | 'sandbox' }
  ): Promise<{ platform: PlatformConnection }> {
    return fetchJson<{ platform: PlatformConnection }>(`/api/platforms/${platform}/connect`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async disconnectPlatform(platform: PlatformType): Promise<{ platform: PlatformConnection }> {
    return fetchJson<{ platform: PlatformConnection }>(`/api/platforms/${platform}/disconnect`, {
      method: 'POST',
    });
  },

  // Videos
  async getVideos(): Promise<VideoRecord[]> {
    return fetchJson<VideoRecord[]>('/api/videos');
  },

  async uploadVideosWithProgress(
    files: File[],
    thumbnails?: Record<string, string>,
    onProgress?: (info: {
      loaded: number;
      total: number;
      percentage: number;
      speedFormatted: string;
      loadedFormatted: string;
      totalFormatted: string;
      currentFileIndex: number;
      totalFiles: number;
      currentFileName: string;
    }) => void
  ): Promise<{ count: number; videos: VideoRecord[] }> {
    return new Promise<{ count: number; videos: VideoRecord[] }>(
      (
        resolve: (value: { count: number; videos: VideoRecord[] }) => void,
        reject: (reason?: any) => void
      ) => {
      const formData = new FormData();
      files.forEach((file: File) => {
        formData.append('videos', file);
      });
      if (thumbnails && Object.keys(thumbnails).length > 0) {
        formData.append('thumbnails', JSON.stringify(thumbnails));
      }

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/videos/upload');
      xhr.setRequestHeader('x-user-id', USER_ID);

      const startTime = Date.now();
      let lastLoaded = 0;
      let lastTime = startTime;
      let smoothedSpeed = 0;

      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (e.lengthComputable && onProgress) {
          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000;
          if (timeDiff > 0.25) {
            const instantSpeed = (e.loaded - lastLoaded) / timeDiff;
            smoothedSpeed = smoothedSpeed === 0 ? instantSpeed : smoothedSpeed * 0.7 + instantSpeed * 0.3;
            lastLoaded = e.loaded;
            lastTime = now;
          } else if (smoothedSpeed === 0) {
            const totalElapsed = (now - startTime) / 1000;
            smoothedSpeed = totalElapsed > 0.1 ? e.loaded / totalElapsed : 0;
          }

          const speedFormatted =
            smoothedSpeed > 1024 * 1024
              ? `${(smoothedSpeed / (1024 * 1024)).toFixed(1)} MB/s`
              : `${Math.max(1, Math.round(smoothedSpeed / 1024))} KB/s`;

          const loadedFormatted = `${(e.loaded / (1024 * 1024)).toFixed(1)} MB`;
          const totalFormatted = `${(e.total / (1024 * 1024)).toFixed(1)} MB`;
          const percentage = Math.min(100, Math.round((e.loaded / e.total) * 100));

          onProgress({
            loaded: e.loaded,
            total: e.total,
            percentage,
            speedFormatted,
            loadedFormatted,
            totalFormatted,
            currentFileIndex: 1,
            totalFiles: files.length,
            currentFileName: files[0]?.name || 'video',
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch {
            reject(new Error('Invalid response format from server'));
          }
        } else {
          if (xhr.status === 413) {
            reject(
              new Error('File upload was rejected by server gateway (HTTP 413 Payload Too Large).')
            );
            return;
          }
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error || `Upload failed with HTTP ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed with HTTP ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during video upload. Please check connection.'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Upload timed out. Please try again with a smaller file.'));
      };

      xhr.send(formData);
    });
  },

  async uploadVideos(files: File[]): Promise<{ count: number; videos: VideoRecord[] }> {
    return this.uploadVideosWithProgress(files);
  },

  async updateVideo(id: string, params: { originalName: string }): Promise<{ video: VideoRecord }> {
    return fetchJson<{ video: VideoRecord }>(`/api/videos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(params),
    });
  },

  async replaceVideo(id: string, file: File): Promise<{ video: VideoRecord }> {
    const formData = new FormData();
    formData.append('video', file);

    const response = await fetch(`/api/videos/${id}/replace`, {
      method: 'POST',
      headers: {
        'x-user-id': USER_ID,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || 'Failed to replace video file');
    }

    return response.json();
  },

  async deleteVideo(id: string): Promise<{ success: boolean }> {
    return fetchJson<{ success: boolean }>(`/api/videos/${id}`, {
      method: 'DELETE',
    });
  },

  // Posts
  async getPosts(): Promise<SocialPost[]> {
    return fetchJson<SocialPost[]>('/api/posts');
  },

  async createPost(params: {
    videoId: string;
    title: string;
    defaultScheduledAt?: string | null;
    platforms: Record<PlatformType, any>;
  }): Promise<{ post: SocialPost }> {
    return fetchJson<{ post: SocialPost }>('/api/posts', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async updatePost(id: string, params: Partial<SocialPost>): Promise<{ post: SocialPost }> {
    return fetchJson<{ post: SocialPost }>(`/api/posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(params),
    });
  },

  async deletePost(id: string): Promise<{ success: boolean }> {
    return fetchJson<{ success: boolean }>(`/api/posts/${id}`, {
      method: 'DELETE',
    });
  },

  async publishNow(
    postId: string,
    platformsToPublish?: PlatformType[]
  ): Promise<{ post: SocialPost; results: Record<string, any> }> {
    return fetchJson<{ post: SocialPost; results: Record<string, any> }>(
      `/api/posts/${postId}/publish-now`,
      {
        method: 'POST',
        body: JSON.stringify({ platformsToPublish }),
      }
    );
  },

  async cancelPost(postId: string): Promise<{ post: SocialPost }> {
    return fetchJson<{ post: SocialPost }>(`/api/posts/${postId}/cancel`, {
      method: 'POST',
    });
  },

  // Activity logs
  async getActivityLogs(limit = 20): Promise<ActivityLog[]> {
    return fetchJson<ActivityLog[]>(`/api/activity?limit=${limit}`);
  },

  // Settings API
  async getSettings(): Promise<any> {
    return fetchJson('/api/settings');
  },

  async updateSettings(settings: Record<string, any>): Promise<any> {
    return fetchJson('/api/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },

  // Webhook Diagnostics & Configuration
  async getWebhookConfig(): Promise<{
    url: string;
    isConfigured: boolean;
    isTestUrl: boolean;
    source: 'platform' | 'env' | 'database' | 'none';
    supportedPlatforms: PlatformType[];
    platformWebhooks?: Partial<Record<PlatformType, string>>;
    payloadMode?: 'multipart' | 'json';
    timeZone?: string;
  }> {
    return fetchJson('/api/webhook/config');
  },

  async updateWebhookConfig(params: {
    webhookUrl?: string;
    platformWebhooks?: Partial<Record<PlatformType, string>>;
    payloadMode?: 'multipart' | 'json';
    timeZone?: string;
  } | string, timeZoneArg?: string): Promise<{
    success: boolean;
    url: string;
    isConfigured: boolean;
    isTestUrl: boolean;
    source: string;
    platformWebhooks?: Partial<Record<PlatformType, string>>;
    payloadMode?: 'multipart' | 'json';
    timeZone?: string;
  }> {
    const body = typeof params === 'string'
      ? { webhookUrl: params, timeZone: timeZoneArg }
      : params;

    return fetchJson('/api/webhook/config', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async sendTestWebhook(customUrl?: string, platform: PlatformType = 'instagram'): Promise<{
    success: boolean;
    httpStatus?: number;
    statusText?: string;
    durationMs: number;
    url: string;
    responseBody?: string;
    dispatchedPayload: any;
    confirmationMessage?: string;
    errorMessage?: string;
  }> {
    return fetchJson('/api/webhook/test', {
      method: 'POST',
      body: JSON.stringify({ customUrl, platform }),
    });
  },

  async getWebhookLogs(limit = 20): Promise<any[]> {
    return fetchJson(`/api/webhook/logs?limit=${limit}`);
  },
};

