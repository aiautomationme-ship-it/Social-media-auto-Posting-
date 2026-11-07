import fs from 'fs';
import path from 'path';
import type {
  PlatformType,
  PlatformPostConfig,
  VideoRecord,
  PlatformConnection,
  WebhookTestResult,
} from '../src/types/index.ts';
import { JsonDB } from './db.ts';

export interface PublishResult {
  success: boolean;
  isTestRun?: boolean;
  status: 'published' | 'pending_confirmation' | 'failed';
  httpStatus?: number;
  externalPostId?: string | null;
  externalPostUrl?: string | null;
  errorMessage?: string | null;
  statusDetails?: string;
  responseExcerpt?: string;
  workflowEngine: 'n8n_webhook';
  durationMs?: number;
}

export class PlatformPublisher {
  /**
   * Resolve active n8n webhook configuration with clear source precedence:
   * 1. Environment variable: N8N_PUBLISH_WEBHOOK_URL or PUBLISHING_WORKFLOW_URL
   * 2. Database settings stored by user in UI settings
   */
  public static getWebhookUrl(platform?: PlatformType): {
    url: string;
    isConfigured: boolean;
    isTestUrl: boolean;
    source: 'platform' | 'env' | 'database' | 'none';
    platformWebhooks?: Record<string, string>;
  } {
    let dbSettings: any = null;
    try {
      dbSettings = JsonDB.getInstance().getSettings();
    } catch {
      // fallback
    }

    const platformWebhooks = (dbSettings?.platformWebhooks || {}) as Record<string, string>;

    // 1. Dedicated platform webhook (if platform is provided and configured)
    if (platform && platformWebhooks[platform] && platformWebhooks[platform].trim()) {
      const platUrl = platformWebhooks[platform].trim();
      return {
        url: platUrl,
        isConfigured: true,
        isTestUrl: platUrl.includes('/webhook-test/'),
        source: 'platform',
        platformWebhooks,
      };
    }

    // 2. Environment variable: N8N_PUBLISH_WEBHOOK_URL or PUBLISHING_WORKFLOW_URL
    const envUrl = process.env.N8N_PUBLISH_WEBHOOK_URL || process.env.PUBLISHING_WORKFLOW_URL;
    if (envUrl && envUrl.trim()) {
      const trimmed = envUrl.trim();
      return {
        url: trimmed,
        isConfigured: true,
        isTestUrl: trimmed.includes('/webhook-test/'),
        source: 'env',
        platformWebhooks,
      };
    }

    // 3. Database global settings stored by user
    if (dbSettings?.webhookUrl && dbSettings.webhookUrl.trim()) {
      const trimmed = dbSettings.webhookUrl.trim();
      return {
        url: trimmed,
        isConfigured: true,
        isTestUrl: trimmed.includes('/webhook-test/'),
        source: 'database',
        platformWebhooks,
      };
    }

    return {
      url: '',
      isConfigured: false,
      isTestUrl: false,
      source: 'none',
      platformWebhooks,
    };
  }

  /**
   * Validate platform-specific requirements before publishing
   */
  public static validate(
    platform: PlatformType,
    config: PlatformPostConfig,
    video: VideoRecord,
    _connection?: PlatformConnection
  ): { valid: boolean; error?: string } {
    if (!config.enabled) {
      return { valid: false, error: 'Platform is not enabled for this post.' };
    }

    if (!video || !video.filename) {
      return { valid: false, error: 'Missing source video file.' };
    }

    // Platform-specific content validation
    if (platform === 'instagram') {
      if (config.caption && config.caption.length > 2200) {
        return {
          valid: false,
          error: 'Instagram Reel caption exceeds maximum limit of 2,200 characters.',
        };
      }
    } else if (platform === 'facebook') {
      if (config.caption && config.caption.length > 5000) {
        return {
          valid: false,
          error: 'Facebook Page video description exceeds maximum limit of 5,000 characters.',
        };
      }
    } else if (platform === 'tiktok') {
      if (config.caption && config.caption.length > 2200) {
        return {
          valid: false,
          error: 'TikTok post title/caption exceeds maximum limit of 2,200 characters.',
        };
      }
    }

    return { valid: true };
  }

  /**
   * Execute publishing to the destination platform via real n8n workflow.
   * Real publishing logic:
   * - Never fabricates fake post IDs or random URLs.
   * - Never marks a post as published unless confirmed by external live publication.
   * - When using the n8n Test URL (/webhook-test/), sets status to pending_confirmation / test run.
   */
  public static async publish(
    platform: PlatformType,
    config: PlatformPostConfig,
    video: VideoRecord,
    connection?: PlatformConnection
  ): Promise<PublishResult> {
    const validation = this.validate(platform, config, video, connection);
    if (!validation.valid) {
      return {
        success: false,
        status: 'failed',
        errorMessage: validation.error,
        workflowEngine: 'n8n_webhook',
      };
    }

    const webhookConfig = this.getWebhookUrl(platform);
    if (!webhookConfig.isConfigured || !webhookConfig.url) {
      const errorMsg = `No Webhook URL configured for ${platform}. Please configure your n8n Webhook URL in Settings.`;
      console.warn(`[Publishing Workflow] ${errorMsg}`);
      return {
        success: false,
        status: 'failed',
        errorMessage: errorMsg,
        workflowEngine: 'n8n_webhook',
      };
    }

    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const currentDay = dayNames[now.getDay()];
    const currentMonth = monthNames[now.getMonth()];
    const currentYear = now.getFullYear();
    const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentTime = now.toLocaleTimeString('en-US', { hour12: true });

    const platformDisplayMap: Record<PlatformType, string> = {
      tiktok: 'TikTok',
      instagram: 'Instagram',
      facebook: 'Facebook',
    };
    const platformName = platformDisplayMap[platform] || platform;

    // Locate physical video file on disk in uploads/videos
    const uploadsDir = path.resolve(process.cwd(), 'uploads/videos');
    let filePath = path.resolve(uploadsDir, video.filename);
    if (!fs.existsSync(filePath)) {
      const altPath = path.resolve(process.cwd(), video.filename);
      if (fs.existsSync(altPath)) {
        filePath = altPath;
      } else {
        // Try basename in uploadsDir
        const baseNamePath = path.resolve(uploadsDir, path.basename(video.fileUrl || video.filename));
        if (fs.existsSync(baseNamePath)) {
          filePath = baseNamePath;
        }
      }
    }

    if (!fs.existsSync(filePath)) {
      const errorMsg = `Source video file "${video.filename}" could not be found on disk for direct file upload.`;
      console.error(`[Publishing Workflow] ${errorMsg}`);
      return {
        success: false,
        status: 'failed',
        errorMessage: errorMsg,
        workflowEngine: 'n8n_webhook',
      };
    }

    // Read raw uncompressed video file directly — zero compression, zero transcoding
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = video.originalName || video.filename || 'video.mp4';
    const mimeType = video.mimeType || 'video/mp4';
    const fileBlob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });

    // Build direct multipart/form-data request
    const formData = new FormData();

    // 1. Attach direct raw video binary (standard property in n8n is 'data')
    formData.append('data', fileBlob, fileName);

    // 2. Attach all metadata, platform details, and real-time date/time
    formData.append('event', 'socialflow.publish');
    formData.append('platform', platform);
    formData.append('platformName', platformName);
    formData.append('platformDisplayName', platformName);
    formData.append('targetPlatform', platform);
    formData.append('sourcePlatform', platform);
    formData.append('isTestWorkflow', String(webhookConfig.isTestUrl));
    formData.append('videoTitle', video.originalName || fileName);
    formData.append('fileName', fileName);
    formData.append('caption', config.caption || '');
    formData.append('description', config.caption || '');
    formData.append('fileSize', String(fileBuffer.length));
    formData.append('mimeType', mimeType);

    // Detailed real-time day, date, month, year, time
    formData.append('day', currentDay);
    formData.append('date', currentDate);
    formData.append('month', currentMonth);
    formData.append('year', String(currentYear));
    formData.append('time', currentTime);
    formData.append('timestamp', now.toISOString());
    formData.append('formattedTime', `${currentDay}, ${now.getDate()} ${currentMonth} ${currentYear} at ${currentTime}`);

    formData.append('realtime', JSON.stringify({
      timestamp: now.toISOString(),
      date: currentDate,
      day: currentDay,
      month: currentMonth,
      year: currentYear,
      time: currentTime,
      formatted: `${currentDay}, ${now.getDate()} ${currentMonth} ${currentYear} at ${currentTime}`,
    }));

    formData.append('content', JSON.stringify({
      platform,
      platformName,
      caption: config.caption || '',
      description: config.caption || '',
      tiktokSettings: config.tiktokSettings || null,
    }));

    const appUrl = process.env.APP_URL || '';
    const fullVideoUrl = (video.fileUrl || '').startsWith('http')
      ? video.fileUrl
      : `${appUrl.replace(/\/$/, '')}${video.fileUrl}`;

    formData.append('videoUrl', fullVideoUrl);
    formData.append('fileUrl', fullVideoUrl);
    formData.append('downloadUrl', fullVideoUrl);

    if (config.scheduledAt) {
      formData.append('scheduledAt', config.scheduledAt);
    }

    // Log outbound webhook diagnostic (store metadata summary, not raw video buffer)
    const diagnosticSummary = {
      event: 'socialflow.publish',
      mode: 'direct_file_multipart',
      platform,
      platformName,
      videoTitle: video.originalName || fileName,
      fileName,
      fileSize: fileBuffer.length,
      mimeType,
      videoUrl: fullVideoUrl,
      caption: config.caption || '',
      realtime: {
        timestamp: now.toISOString(),
        date: currentDate,
        day: currentDay,
        month: currentMonth,
        year: currentYear,
        time: currentTime,
        formatted: `${currentDay}, ${now.getDate()} ${currentMonth} ${currentYear} at ${currentTime}`,
      },
    };

    const startTime = Date.now();
    try {
      console.log(
        `[Publishing Workflow] Dispatching direct video file (${fileBuffer.length} bytes) for ${platform} to n8n webhook (${webhookConfig.source}): ${webhookConfig.url}`
      );

      const response = await fetch(webhookConfig.url, {
        method: 'POST',
        headers: {
          'User-Agent': 'SocialFlow-Publisher/2.0',
          Accept: 'application/json, text/plain, */*',
        },
        body: formData,
        signal: AbortSignal.timeout(60000), // 60s timeout for binary file streaming
      });

      const durationMs = Date.now() - startTime;
      const responseText = await response.text();

      JsonDB.getInstance().logWebhookDiagnostic({
        url: webhookConfig.url,
        event: 'socialflow.publish',
        platform,
        isTestEvent: webhookConfig.isTestUrl,
        httpStatus: response.status,
        statusText: response.statusText,
        success: response.ok,
        durationMs,
        requestPayload: diagnosticSummary,
        responseBody: responseText.substring(0, 1000),
        errorMessage: response.ok
          ? undefined
          : `HTTP ${response.status}: ${responseText.substring(0, 300)}`,
      });

      if (!response.ok) {
        let errorMsg = `n8n publishing workflow returned HTTP ${response.status}: ${
          responseText.substring(0, 200) || response.statusText
        }`;

        if (response.status === 404 && responseText.includes('is not registered')) {
          errorMsg = webhookConfig.isTestUrl
            ? `n8n Test Webhook Inactive (HTTP 404): In n8n, test webhooks only listen for ONE test call after clicking "Execute workflow". Switch to the Production URL (/webhook/...) in Settings and toggle the workflow Active switch in n8n to ON.`
            : `n8n Production Workflow Inactive (HTTP 404): The webhook is not active in n8n. Open your workflow in n8n and toggle the Active switch in the top-right corner to ON.`;
        }

        return {
          success: false,
          status: 'failed',
          httpStatus: response.status,
          errorMessage: errorMsg,
          responseExcerpt: responseText.substring(0, 300),
          workflowEngine: 'n8n_webhook',
          durationMs,
        };
      }

      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { raw: responseText };
      }

      // Check external confirmation
      if (webhookConfig.isTestUrl) {
        // Test URL: Triggered the n8n "Listen for test event".
        // It is NOT a live published post on Instagram/TikTok/Facebook.
        return {
          success: true,
          isTestRun: true,
          status: 'pending_confirmation',
          httpStatus: response.status,
          externalPostId: data.externalPostId || data.postId || null,
          externalPostUrl: null,
          statusDetails:
            'Delivered to n8n Test Webhook. Test workflow trigger received (Development test run — not live on social platforms).',
          responseExcerpt: responseText.substring(0, 200),
          workflowEngine: 'n8n_webhook',
          durationMs,
        };
      }

      // Production URL: Only mark published if verified by external workflow confirmation
      const hasVerifiedLiveConfirmation =
        data.confirmedPublished === true ||
        (data.status === 'published' && Boolean(data.externalPostId) && Boolean(data.externalPostUrl));

      if (hasVerifiedLiveConfirmation) {
        return {
          success: true,
          isTestRun: false,
          status: 'published',
          httpStatus: response.status,
          externalPostId: data.externalPostId || data.postId,
          externalPostUrl: data.externalPostUrl || data.postUrl,
          statusDetails: 'Live post verified on destination platform.',
          responseExcerpt: responseText.substring(0, 200),
          workflowEngine: 'n8n_webhook',
          durationMs,
        };
      }

      // Webhook accepted/started workflow, but final live post confirmation is pending
      return {
        success: true,
        isTestRun: false,
        status: 'pending_confirmation',
        httpStatus: response.status,
        externalPostId: data.externalPostId || data.postId || null,
        externalPostUrl: data.externalPostUrl || null,
        statusDetails:
          data.message ||
          'Dispatched to n8n publishing workflow. Awaiting live external publication confirmation.',
        responseExcerpt: responseText.substring(0, 200),
        workflowEngine: 'n8n_webhook',
        durationMs,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      console.error('[Publishing Workflow] Error invoking n8n webhook:', err);

      JsonDB.getInstance().logWebhookDiagnostic({
        url: webhookConfig.url,
        event: 'socialflow.publish',
        platform,
        isTestEvent: webhookConfig.isTestUrl,
        success: false,
        durationMs,
        requestPayload: diagnosticSummary,
        errorMessage: err.message || 'Network connection failed',
      });

      return {
        success: false,
        status: 'failed',
        errorMessage: `Failed to contact n8n publishing workflow: ${err.message}`,
        workflowEngine: 'n8n_webhook',
        durationMs,
      };
    }
  }

  /**
   * Diagnostic Action: Send Test Webhook Event
   * Dispatches the exact same event payload structure that a real post would send,
   * with test flags identifying it as a diagnostic event.
   */
  public static async sendDiagnosticTestEvent(customUrl?: string, platform: PlatformType = 'instagram'): Promise<WebhookTestResult> {
    const webhookConfig = this.getWebhookUrl(platform);
    const targetUrl = (customUrl && customUrl.trim()) || webhookConfig.url;

    if (!targetUrl) {
      return {
        success: false,
        durationMs: 0,
        url: '',
        errorMessage:
          `No Webhook URL configured for ${platform} (or globally). Please set your Webhook URL in Settings.`,
        dispatchedPayload: null,
      };
    }

    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const currentDay = dayNames[now.getDay()];
    const currentMonth = monthNames[now.getMonth()];
    const currentYear = now.getFullYear();
    const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentTime = now.toLocaleTimeString('en-US', { hour12: true });

    // Look for real video file on disk
    const uploadsDir = path.resolve(process.cwd(), 'uploads/videos');
    const userVideos = JsonDB.getInstance().getVideos('user_default');
    const activeVideo = userVideos && userVideos.length > 0 ? userVideos[0] : null;

    let targetFilePath = '';
    let fileName = 'sample.mp4';
    let mimeType = 'video/mp4';

    if (activeVideo && activeVideo.filename) {
      const candidatePath = path.resolve(uploadsDir, activeVideo.filename);
      if (fs.existsSync(candidatePath)) {
        targetFilePath = candidatePath;
        fileName = activeVideo.originalName || activeVideo.filename;
        mimeType = activeVideo.mimeType || 'video/mp4';
      }
    }

    if (!targetFilePath) {
      const samplePath = path.resolve(uploadsDir, 'sample.mp4');
      if (fs.existsSync(samplePath)) {
        targetFilePath = samplePath;
        fileName = 'sample.mp4';
        mimeType = 'video/mp4';
      }
    }

    const formData = new FormData();
    let fileBuffer: Buffer | null = null;

    if (targetFilePath && fs.existsSync(targetFilePath)) {
      fileBuffer = fs.readFileSync(targetFilePath);
      const fileBlob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });

      // Attach direct video file (standard single binary property 'data')
      formData.append('data', fileBlob, fileName);
    }

    // Attach diagnostic metadata fields
    formData.append('event', 'socialflow.webhook_test');
    formData.append('isTestEvent', 'true');
    formData.append('diagnosticMode', 'true');
    formData.append('platform', 'instagram');
    formData.append('platformName', 'Instagram');
    formData.append('platformDisplayName', 'Instagram');
    formData.append('targetPlatform', 'instagram');
    formData.append('sourcePlatform', 'instagram');
    formData.append('videoTitle', fileName);
    formData.append('fileName', fileName);
    formData.append('caption', 'Diagnostic test event from SocialFlow — testing n8n Webhook node trigger listener');
    formData.append('description', 'SocialFlow Diagnostic Test Event');
    formData.append('fileSize', String(fileBuffer ? fileBuffer.length : 0));
    formData.append('mimeType', mimeType);

    formData.append('day', currentDay);
    formData.append('date', currentDate);
    formData.append('month', currentMonth);
    formData.append('year', String(currentYear));
    formData.append('time', currentTime);
    formData.append('timestamp', now.toISOString());
    formData.append('formattedTime', `${currentDay}, ${now.getDate()} ${currentMonth} ${currentYear} at ${currentTime}`);

    formData.append('realtime', JSON.stringify({
      timestamp: now.toISOString(),
      date: currentDate,
      day: currentDay,
      month: currentMonth,
      year: currentYear,
      time: currentTime,
      formatted: `${currentDay}, ${now.getDate()} ${currentMonth} ${currentYear} at ${currentTime}`,
    }));

    formData.append('content', JSON.stringify({
      platform: 'instagram',
      platformName: 'Instagram',
      caption: 'Diagnostic test event from SocialFlow — testing n8n Webhook node trigger listener',
      description: 'SocialFlow Diagnostic Test Event',
      tiktokSettings: null,
    }));

    const diagnosticSummary = {
      event: 'socialflow.webhook_test',
      mode: 'direct_file_multipart',
      isTestEvent: true,
      diagnosticMode: true,
      platform: 'instagram',
      platformName: 'Instagram',
      videoTitle: fileName,
      fileName,
      fileSize: fileBuffer ? fileBuffer.length : 0,
      mimeType,
      caption: 'Diagnostic test event from SocialFlow — testing n8n Webhook node trigger listener',
      realtime: {
        timestamp: now.toISOString(),
        date: currentDate,
        day: currentDay,
        month: currentMonth,
        year: currentYear,
        time: currentTime,
        formatted: `${currentDay}, ${now.getDate()} ${currentMonth} ${currentYear} at ${currentTime}`,
      },
    };

    const startTime = Date.now();
    try {
      console.log(`[Diagnostic Webhook] Sending test payload with direct file to: ${targetUrl}`);
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'User-Agent': 'SocialFlow-Publisher/2.0 (Diagnostic-Test)',
          Accept: 'application/json, text/plain, */*',
        },
        body: formData,
        signal: AbortSignal.timeout(30000),
      });

      const durationMs = Date.now() - startTime;
      const responseText = await response.text();

      JsonDB.getInstance().logWebhookDiagnostic({
        url: targetUrl,
        event: 'socialflow.publish',
        platform: 'instagram',
        isTestEvent: true,
        httpStatus: response.status,
        statusText: response.statusText,
        success: response.ok,
        durationMs,
        requestPayload: diagnosticSummary,
        responseBody: responseText.substring(0, 1000),
        errorMessage: response.ok
          ? undefined
          : `HTTP ${response.status}: ${responseText.substring(0, 300)}`,
      });

      if (!response.ok) {
        let errorMsg = `n8n webhook returned HTTP ${response.status} (${response.statusText}): ${
          responseText.substring(0, 200) || 'No response body'
        }`;

        if (response.status === 404 && responseText.includes('is not registered')) {
          errorMsg = targetUrl.includes('/webhook-test/')
            ? `n8n Test Webhook Inactive (HTTP 404): In n8n, test webhooks only listen for ONE test call after clicking "Execute workflow". Switch to the Production URL (/webhook/...) and toggle the workflow Active switch in n8n to ON.`
            : `n8n Production Workflow Inactive (HTTP 404): The webhook is not active in n8n. Open your workflow in n8n and toggle the Active switch in the top-right corner to ON.`;
        }

        return {
          success: false,
          httpStatus: response.status,
          statusText: response.statusText,
          durationMs,
          url: targetUrl,
          responseBody: responseText.substring(0, 1000),
          dispatchedPayload: diagnosticSummary,
          errorMessage: errorMsg,
        };
      }

      return {
        success: true,
        httpStatus: response.status,
        statusText: response.statusText,
        durationMs,
        url: targetUrl,
        responseBody: responseText.substring(0, 1000),
        dispatchedPayload: diagnosticSummary,
        confirmationMessage: `Direct video file & metadata successfully delivered to n8n Webhook node (HTTP ${response.status} OK in ${durationMs}ms). Trigger event confirmed.`,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      JsonDB.getInstance().logWebhookDiagnostic({
        url: targetUrl,
        event: 'socialflow.publish',
        platform: 'instagram',
        isTestEvent: true,
        success: false,
        durationMs,
        requestPayload: diagnosticSummary,
        errorMessage: err.message || 'Network connection failed',
      });

      return {
        success: false,
        durationMs,
        url: targetUrl,
        dispatchedPayload: diagnosticSummary,
        errorMessage: `Network error reaching n8n webhook: ${err.message}`,
      };
    }
  }
}
