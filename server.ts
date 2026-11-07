import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { JsonDB } from './server/db.ts';
import { PlatformPublisher } from './server/platforms.ts';
import { BackgroundScheduler } from './server/scheduler.ts';
import type { PlatformType, PlatformPostConfig } from './src/types/index.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

const UPLOADS_DIR = path.resolve(__dirname, 'uploads/videos');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 300 * 1024 * 1024, // 300 MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'video/x-msvideo',
      'video/mpeg',
      'video/3gpp',
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(mp4|mov|webm|avi|mkv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only video files (MP4, MOV, WEBM) are supported.'));
    }
  },
});

async function startServer() {
  const app = express();
  const db = JsonDB.getInstance();

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Serve uploaded video files with client caching & byte-range streaming
  app.use(
    '/uploads/videos',
    express.static(UPLOADS_DIR, {
      maxAge: '7d',
      etag: true,
      lastModified: true,
      acceptRanges: true,
      setHeaders: (res, filePath) => {
        if (filePath.match(/\.(mp4|mov|webm|avi|mkv)$/i)) {
          res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        }
      },
    })
  );

  // User auth extraction middleware
  const getUserId = (req: express.Request): string => {
    return (req.headers['x-user-id'] as string) || 'user_default';
  };

  // --- API Routes ---

  // Auth / Current User
  app.get('/api/auth/me', (req, res) => {
    const userId = getUserId(req);
    const user = db.getUser(userId);
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      authenticated: true,
    });
  });

  // Monthly Targets
  app.get('/api/targets', (req, res) => {
    const userId = getUserId(req);
    const month = parseInt(req.query.month as string, 10);
    const year = parseInt(req.query.year as string, 10);

    if (month && year) {
      const target = db.getTarget(userId, month, year);
      return res.json({ target });
    }
    const all = db.getAllTargets(userId);
    return res.json({ targets: all });
  });

  app.post('/api/targets', (req, res) => {
    try {
      const userId = getUserId(req);
      const { month, year, targetCount } = req.body;
      const target = db.setTarget(
        userId,
        parseInt(month, 10),
        parseInt(year, 10),
        parseInt(targetCount, 10)
      );
      res.json({ success: true, target });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.put('/api/targets/:id', (req, res) => {
    try {
      const userId = getUserId(req);
      const targetId = req.params.id;
      const { targetCount } = req.body;
      const target = db.updateTarget(userId, targetId, parseInt(targetCount, 10));
      res.json({ success: true, target });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/targets/:id', (req, res) => {
    try {
      const userId = getUserId(req);
      const targetId = req.params.id;
      const ok = db.deleteTarget(userId, targetId);
      if (!ok) {
        return res.status(404).json({ success: false, error: 'Target not found' });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Dashboard Aggregates
  app.get('/api/dashboard/stats', (req, res) => {
    try {
      const userId = getUserId(req);
      const now = new Date();
      const month = req.query.month ? parseInt(req.query.month as string, 10) : now.getMonth() + 1;
      const year = req.query.year ? parseInt(req.query.year as string, 10) : now.getFullYear();

      const stats = db.getDashboardStats(userId, month, year);
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Platform Accounts & Connections
  app.get('/api/platforms', (req, res) => {
    const userId = getUserId(req);
    const platforms = db.getPlatforms(userId);
    res.json(platforms);
  });

  app.post('/api/platforms/:platform/connect', (req, res) => {
    const userId = getUserId(req);
    const platform = req.params.platform as PlatformType;
    const { accountName, accountId, apiMode, grantedScopes } = req.body;

    const allowed: PlatformType[] = ['tiktok', 'instagram', 'facebook'];
    if (!allowed.includes(platform)) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    const defaultNames: Record<PlatformType, string> = {
      tiktok: '@socialflow_creator',
      instagram: '@socialflow.official',
      facebook: 'SocialFlow Media Studio',
    };

    const updated = db.updatePlatformConnection(userId, platform, {
      connected: true,
      accountName: accountName || defaultNames[platform],
      accountId: accountId || `acc_${Date.now()}`,
      connectedAt: new Date().toISOString(),
      apiMode: apiMode || 'sandbox',
      grantedScopes: grantedScopes || [
        platform === 'tiktok'
          ? 'video.upload,video.publish'
          : platform === 'instagram'
          ? 'instagram_basic,instagram_content_publish'
          : 'publish_video,pages_manage_posts',
      ],
    });

    res.json({ success: true, platform: updated });
  });

  // System & Workflow Integration Status
  app.get('/api/system/status', (_req, res) => {
    const wh = PlatformPublisher.getWebhookUrl();
    res.json({
      backendSchedulerActive: true,
      schedulerIntervalSeconds: 5,
      workflowIntegration: {
        configured: wh.isConfigured,
        webhookUrl: wh.url || null,
        mode: wh.isConfigured
          ? wh.isTestUrl
            ? 'n8n_test_workflow'
            : 'n8n_workflow'
          : 'unconfigured',
        source: wh.source,
        isTestUrl: wh.isTestUrl,
        supportedPlatforms: ['tiktok', 'instagram', 'facebook'],
      },
    });
  });

  // Webhook Configuration API
  app.get('/api/webhook/config', (_req, res) => {
    const wh = PlatformPublisher.getWebhookUrl();
    const settings = db.getSettings();
    res.json({
      url: wh.url,
      isConfigured: wh.isConfigured,
      isTestUrl: wh.isTestUrl,
      source: wh.source,
      supportedPlatforms: ['tiktok', 'instagram', 'facebook'],
      platformWebhooks: settings.platformWebhooks || {},
      payloadMode: settings.payloadMode || 'multipart',
      timeZone: settings.timeZone || 'Asia/Karachi',
    });
  });

  app.post('/api/webhook/config', (req, res) => {
    try {
      const { webhookUrl, platformWebhooks, payloadMode, timeZone } = req.body;
      const trimmedGlobal = typeof webhookUrl === 'string' ? webhookUrl.trim() : '';

      if (trimmedGlobal && !trimmedGlobal.startsWith('http://') && !trimmedGlobal.startsWith('https://')) {
        return res.status(400).json({ error: 'Global Webhook URL must start with http:// or https://' });
      }

      const cleanPlatformWebhooks: Record<string, string> = {};
      if (platformWebhooks && typeof platformWebhooks === 'object') {
        for (const [key, val] of Object.entries(platformWebhooks)) {
          if (typeof val === 'string') {
            const trimmedVal = val.trim();
            if (trimmedVal) {
              if (!trimmedVal.startsWith('http://') && !trimmedVal.startsWith('https://')) {
                return res.status(400).json({
                  error: `Webhook URL for ${key} must start with http:// or https://`,
                });
              }
              cleanPlatformWebhooks[key] = trimmedVal;
            }
          }
        }
      }

      db.updateSettings({
        webhookUrl: trimmedGlobal,
        platformWebhooks: cleanPlatformWebhooks,
        ...(payloadMode ? { payloadMode } : {}),
        ...(timeZone ? { timeZone } : {}),
      });

      const wh = PlatformPublisher.getWebhookUrl();
      const freshSettings = db.getSettings();

      db.logActivity(getUserId(req), {
        type: 'post_scheduled',
        title: trimmedGlobal || Object.keys(cleanPlatformWebhooks).length > 0
          ? 'Updated Webhook Configuration'
          : 'Cleared Webhook Configuration',
        description: `Configured webhooks: ${trimmedGlobal ? 'Global URL' : ''} ${Object.keys(cleanPlatformWebhooks).join(', ')}`,
      });

      res.json({
        success: true,
        url: wh.url,
        isConfigured: wh.isConfigured,
        isTestUrl: wh.isTestUrl,
        source: wh.source,
        platformWebhooks: freshSettings.platformWebhooks || {},
        payloadMode: freshSettings.payloadMode || 'multipart',
        timeZone: freshSettings.timeZone || 'Asia/Karachi',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // App Settings API
  app.get('/api/settings', (_req, res) => {
    const wh = PlatformPublisher.getWebhookUrl();
    const settings = db.getSettings();
    res.json({
      ...settings,
      webhookConfig: {
        url: wh.url,
        isConfigured: wh.isConfigured,
        isTestUrl: wh.isTestUrl,
        source: wh.source,
        platformWebhooks: settings.platformWebhooks || {},
      },
    });
  });

  app.post('/api/settings', (req, res) => {
    try {
      const { webhookUrl, platformWebhooks, timeZone, ...rest } = req.body;
      const updateData: any = { ...rest };
      if (typeof timeZone === 'string') {
        updateData.timeZone = timeZone;
      }
      if (typeof webhookUrl === 'string') {
        const trimmed = webhookUrl.trim();
        if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
          return res.status(400).json({ error: 'Webhook URL must start with http:// or https://' });
        }
        updateData.webhookUrl = trimmed;
      }
      if (platformWebhooks && typeof platformWebhooks === 'object') {
        updateData.platformWebhooks = platformWebhooks;
      }
      const updated = db.updateSettings(updateData);
      const wh = PlatformPublisher.getWebhookUrl();
      res.json({
        success: true,
        settings: {
          ...updated,
          webhookConfig: {
            url: wh.url,
            isConfigured: wh.isConfigured,
            isTestUrl: wh.isTestUrl,
            source: wh.source,
            platformWebhooks: updated.platformWebhooks || {},
          },
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Diagnostic Webhook Test Trigger ("Send Test Webhook Event")
  app.post('/api/webhook/test', async (req, res) => {
    try {
      const { customUrl, platform } = req.body;
      const targetPlatform = platform || 'instagram';
      const result = await PlatformPublisher.sendDiagnosticTestEvent(customUrl, targetPlatform);

      const userId = getUserId(req);
      db.logActivity(userId, {
        type: result.success ? 'post_scheduled' : 'post_failed',
        title: result.success ? `Diagnostic Test Webhook Sent (${targetPlatform})` : `Diagnostic Test Webhook Failed (${targetPlatform})`,
        description: result.confirmationMessage || result.errorMessage || 'Diagnostic test event',
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        durationMs: 0,
        errorMessage: err.message || 'Diagnostic execution failed',
      });
    }
  });

  // Webhook Diagnostic Logs
  app.get('/api/webhook/logs', (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const logs = db.getWebhookDiagnostics(limit);
    res.json(logs);
  });

  // Video Uploads & Library
  app.get('/api/videos', (req, res) => {
    const userId = getUserId(req);
    const videos = db.getVideos(userId);
    res.json(videos);
  });

  app.post('/api/videos/upload', upload.array('videos', 50), (req, res) => {
    try {
      const userId = getUserId(req);
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No video files uploaded' });
      }

      // Parse any optional client thumbnails
      let thumbnailsMap: Record<string, string> = {};
      try {
        if (req.body?.thumbnails) {
          thumbnailsMap = typeof req.body.thumbnails === 'string'
            ? JSON.parse(req.body.thumbnails)
            : req.body.thumbnails;
        }
      } catch {
        thumbnailsMap = {};
      }

      const videoItems = files.map((file) => {
        const thumb = thumbnailsMap[file.originalname];
        return {
          userId,
          filename: file.filename,
          originalName: file.originalname,
          fileUrl: `/uploads/videos/${file.filename}`,
          fileSize: file.size,
          mimeType: file.mimetype,
          thumbnailUrl: thumb || undefined,
        };
      });

      // Batch persist in database with a single disk write
      const createdVideos = db.addVideos(videoItems);

      res.json({ success: true, count: createdVideos.length, videos: createdVideos });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/videos/:id', (req, res) => {
    try {
      const userId = getUserId(req);
      const videoId = req.params.id;
      const ok = db.deleteVideo(userId, videoId);
      if (!ok) {
        return res.status(404).json({ error: 'Video not found or already deleted' });
      }
      res.json({ success: true, message: 'Video deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/videos/:id', (req, res) => {
    try {
      const userId = getUserId(req);
      const videoId = req.params.id;
      const updated = db.updateVideo(userId, videoId, req.body);
      res.json({ success: true, video: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/videos/:id/replace', upload.single('video'), (req, res) => {
    try {
      const userId = getUserId(req);
      const videoId = req.params.id;
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No replacement video file provided' });
      }

      const updated = db.replaceVideoFile(userId, videoId, {
        filename: file.filename,
        originalName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      });

      res.json({ success: true, video: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Social Posts
  app.get('/api/posts', (req, res) => {
    const userId = getUserId(req);
    const posts = db.getPosts(userId);
    res.json(posts);
  });

  app.get('/api/posts/:id', (req, res) => {
    const userId = getUserId(req);
    const post = db.getPost(userId, req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json(post);
  });

  app.post('/api/posts', (req, res) => {
    try {
      const userId = getUserId(req);
      const { videoId, title, defaultScheduledAt, platforms } = req.body;

      if (!videoId) {
        return res.status(400).json({ error: 'Source videoId is required' });
      }
      const video = db.getVideo(userId, videoId);
      if (!video) {
        return res.status(400).json({ error: 'Selected video does not exist' });
      }

      const post = db.createPost(userId, {
        videoId,
        title,
        defaultScheduledAt,
        platforms,
      });

      res.json({ success: true, post });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/posts/:id', (req, res) => {
    try {
      const userId = getUserId(req);
      const updated = db.updatePost(userId, req.params.id, req.body);
      res.json({ success: true, post: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/posts/:id', (req, res) => {
    const userId = getUserId(req);
    const ok = db.deletePost(userId, req.params.id);
    if (!ok) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json({ success: true });
  });

  // Immediate Publishing action
  app.post('/api/posts/:id/publish-now', async (req, res) => {
    try {
      const userId = getUserId(req);
      const postId = req.params.id;
      const { platformsToPublish } = req.body as { platformsToPublish?: PlatformType[] };

      const post = db.getPost(userId, postId);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }
      const video = db.getVideo(userId, post.videoId);
      if (!video) {
        return res.status(400).json({ error: 'Source video file missing' });
      }

      const connections = db.getPlatforms(userId);
      const targetPlatforms: PlatformType[] = platformsToPublish || (['tiktok', 'instagram', 'facebook'] as PlatformType[]);

      const results: Record<string, any> = {};

      for (const plat of targetPlatforms) {
        const config = post.platforms[plat];
        if (!config || !config.enabled) continue;

        const connection = connections[plat];
        config.status = 'publishing';
        config.attemptCount = (config.attemptCount || 0) + 1;
        db.updatePost(userId, post.id, { platforms: post.platforms });

        const result = await PlatformPublisher.publish(plat, config, video, connection);
        results[plat] = result;

        if (result.status === 'published') {
          config.status = 'published';
          config.publishedAt = new Date().toISOString();
          config.externalPostId = result.externalPostId;
          config.externalPostUrl = result.externalPostUrl;
          config.errorMessage = null;

          db.logActivity(userId, {
            type: 'post_published',
            platform: plat,
            title: `Published "${post.title}" to ${connection.name}`,
            description: `Confirmed live publication (ID: ${result.externalPostId})`,
            postId: post.id,
            videoId: post.videoId,
          });
        } else if (result.status === 'pending_confirmation') {
          config.status = 'pending_confirmation';
          config.publishedAt = null;
          config.externalPostId = result.externalPostId || null;
          config.externalPostUrl = null;
          config.errorMessage =
            result.statusDetails ||
            'Dispatched to n8n publishing workflow. Awaiting external confirmation.';

          db.logActivity(userId, {
            type: 'post_scheduled',
            platform: plat,
            title: `Webhook event dispatched for "${post.title}" (${connection.name})`,
            description:
              result.statusDetails ||
              'Dispatched to n8n workflow. Awaiting external confirmation.',
            postId: post.id,
            videoId: post.videoId,
          });
        } else {
          config.status = 'failed';
          config.errorMessage = result.errorMessage;

          db.logActivity(userId, {
            type: 'post_failed',
            platform: plat,
            title: `Failed publishing "${post.title}" to ${connection.name}`,
            description: result.errorMessage || 'Publishing error',
            postId: post.id,
            videoId: post.videoId,
          });
        }
      }

      const updated = db.updatePost(userId, post.id, { platforms: post.platforms });
      res.json({ success: true, post: updated, results });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Cancel scheduled post
  app.post('/api/posts/:id/cancel', (req, res) => {
    try {
      const userId = getUserId(req);
      const post = db.getPost(userId, req.params.id);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const platforms: PlatformType[] = ['tiktok', 'instagram', 'facebook'];
      platforms.forEach((plat) => {
        if (post.platforms[plat] && post.platforms[plat].status === 'scheduled') {
          post.platforms[plat].status = 'cancelled';
        }
      });

      const updated = db.updatePost(userId, post.id, {
        platforms: post.platforms,
        status: 'cancelled',
      });

      db.logActivity(userId, {
        type: 'post_cancelled',
        title: `Cancelled scheduled post "${post.title}"`,
        description: `Scheduled publishing jobs cancelled for all destinations`,
        postId: post.id,
      });

      res.json({ success: true, post: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Activity logs
  app.get('/api/activity', (req, res) => {
    const userId = getUserId(req);
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
    const activities = db.getActivities(userId, limit);
    res.json(activities);
  });

  // --- Vite / Frontend Serving ---
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Start background scheduler
  BackgroundScheduler.start();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SocialFlow Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[SocialFlow Server] Fatal startup error:', err);
  process.exit(1);
});
