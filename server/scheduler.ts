import { JsonDB } from './db.ts';
import { PlatformPublisher } from './platforms.ts';
import type { PlatformType } from '../src/types/index.ts';

export class BackgroundScheduler {
  private static intervalTimer: NodeJS.Timeout | null = null;
  private static isRunningTick = false;

  public static start() {
    if (this.intervalTimer) return;
    console.log('[SocialFlow Scheduler] Background publishing worker started (5s interval)');
    // Initial check right away
    this.tick().catch(console.error);
    this.intervalTimer = setInterval(() => {
      this.tick().catch(console.error);
    }, 5000);
  }

  public static stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
      console.log('[SocialFlow Scheduler] Background publishing worker stopped');
    }
  }

  public static async tick() {
    if (this.isRunningTick) return;
    this.isRunningTick = true;

    try {
      const db = JsonDB.getInstance();
      const scheduledPosts = db.getAllScheduledPosts();
      const now = Date.now();

      for (const post of scheduledPosts) {
        const video = db.getVideo(post.userId, post.videoId);
        if (!video) {
          console.warn(`[Scheduler] Video ${post.videoId} not found for post ${post.id}. Marking failed.`);
          continue;
        }

        const platforms: PlatformType[] = ['tiktok', 'instagram', 'facebook'];
        let postUpdated = false;

        for (const plat of platforms) {
          const config = post.platforms[plat];
          if (!config || !config.enabled) continue;
          if (config.status !== 'scheduled') continue;

          const targetTimeStr = config.scheduledAt || post.defaultScheduledAt;
          if (!targetTimeStr) continue;

          const targetTime = new Date(targetTimeStr).getTime();
          // Check if due
          if (targetTime <= now) {
            console.log(
              `[Scheduler] Processing scheduled post "${post.title}" for platform ${plat} (Scheduled at: ${targetTimeStr})`
            );

            // Step 1: Mark as publishing immediately to prevent duplicate runs
            config.status = 'publishing';
            config.attemptCount = (config.attemptCount || 0) + 1;
            db.updatePost(post.userId, post.id, { platforms: post.platforms });
            postUpdated = true;

            // Step 2: Fetch connection
            const connections = db.getPlatforms(post.userId);
            const connection = connections[plat];

            // Step 3: Publish
            const result = await PlatformPublisher.publish(plat, config, video, connection);

            if (result.status === 'published') {
              config.status = 'published';
              config.publishedAt = new Date().toISOString();
              config.externalPostId = result.externalPostId;
              config.externalPostUrl = result.externalPostUrl;
              config.errorMessage = null;

              db.logActivity(post.userId, {
                type: 'post_published',
                platform: plat,
                title: `Published to ${connection.name}: "${post.title}"`,
                description: `Confirmed live publication with ID ${result.externalPostId}`,
                postId: post.id,
                videoId: post.videoId,
              });
              console.log(`[Scheduler] Confirmed live publish for post ${post.id} to ${plat}`);
            } else if (result.status === 'pending_confirmation') {
              config.status = 'pending_confirmation';
              config.publishedAt = null;
              config.externalPostId = result.externalPostId || null;
              config.externalPostUrl = null;
              config.errorMessage =
                result.statusDetails ||
                'Dispatched to n8n publishing workflow. Awaiting live publication confirmation.';

              db.logActivity(post.userId, {
                type: 'post_scheduled',
                platform: plat,
                title: `Webhook event dispatched for "${post.title}" (${connection.name})`,
                description:
                  result.statusDetails ||
                  'Dispatched to n8n workflow. Awaiting external confirmation.',
                postId: post.id,
                videoId: post.videoId,
              });
              console.log(
                `[Scheduler] Dispatched post ${post.id} to ${plat} webhook. Status set to pending_confirmation.`
              );
            } else {
              config.status = 'failed';
              config.errorMessage = result.errorMessage || 'Failed to publish to destination platform';

              db.logActivity(post.userId, {
                type: 'post_failed',
                platform: plat,
                title: `Failed publishing to ${connection.name}: "${post.title}"`,
                description: config.errorMessage,
                postId: post.id,
                videoId: post.videoId,
              });
              console.error(`[Scheduler] Failed publishing post ${post.id} to ${plat}: ${config.errorMessage}`);
            }

            db.updatePost(post.userId, post.id, { platforms: post.platforms });
          }
        }
      }
    } catch (err) {
      console.error('[Scheduler] Error in tick cycle:', err);
    } finally {
      this.isRunningTick = false;
    }
  }
}
