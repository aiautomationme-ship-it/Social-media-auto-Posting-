import React, { useState } from 'react';
import {
  History,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ExternalLink,
  RotateCcw,
  Trash2,
  Film,
  Activity,
  Send,
  Video,
  Target,
  Filter,
  RefreshCw,
  Clock,
  Layers,
  Check,
} from 'lucide-react';
import type {
  SocialPost,
  PlatformType,
  PostStatus,
  ActivityLog,
  VideoRecord,
} from '../types/index.ts';

interface PublishingHistoryProps {
  posts: SocialPost[];
  activities: ActivityLog[];
  videos?: VideoRecord[];
  onDeletePost: (postId: string) => Promise<void>;
  onRetryPlatformPublish: (postId: string, platform: PlatformType) => Promise<void>;
  isLoading?: boolean;
  loadError?: string | null;
  onRefresh?: () => void;
}

type AuditFilterCategory = 'all' | 'publishing' | 'targets' | 'media';

export const PublishingHistory: React.FC<PublishingHistoryProps> = ({
  posts,
  activities,
  videos = [],
  onDeletePost,
  onRetryPlatformPublish,
  isLoading = false,
  loadError = null,
  onRefresh,
}) => {
  const [activeView, setActiveView] = useState<'outcomes' | 'audit_trail'>('outcomes');

  // Outcomes View Filters
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'published' | 'pending_confirmation' | 'failed' | 'cancelled'
  >('all');
  const [platformFilter, setPlatformFilter] = useState<'all' | PlatformType>('all');

  // Audit Trail Filter
  const [auditCategory, setAuditCategory] = useState<AuditFilterCategory>('all');

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<SocialPost | null>(null);

  // 1. Accurate Status Semantics:
  // Scheduled posts belong in Publishing Calendar until a publishing attempt or outcome makes them relevant to history.
  // Historical outcomes include posts with status published, pending_confirmation, failed, or cancelled,
  // or posts where at least one enabled platform has reached an outcome (published, pending_confirmation, failed, cancelled).
  const outcomePosts = posts.filter((post) => {
    const hasFinalPostStatus =
      post.status === 'published' ||
      post.status === 'pending_confirmation' ||
      post.status === 'failed' ||
      post.status === 'cancelled';
    const hasPlatformOutcome = Object.values(post.platforms || {}).some(
      (plat) =>
        plat.enabled &&
        (plat.status === 'published' ||
          plat.status === 'pending_confirmation' ||
          plat.status === 'failed' ||
          plat.status === 'cancelled')
    );
    return hasFinalPostStatus || hasPlatformOutcome;
  });

  // Filter outcomes
  const filteredPosts = outcomePosts.filter((post) => {
    if (statusFilter !== 'all') {
      if (post.status !== statusFilter) return false;
    }
    if (platformFilter !== 'all') {
      if (!post.platforms[platformFilter]?.enabled) return false;
    }
    return true;
  });

  // Filter audit activities
  const filteredActivities = activities.filter((act) => {
    if (auditCategory === 'publishing') {
      return (
        act.type === 'post_published' ||
        act.type === 'post_failed' ||
        act.type === 'post_cancelled' ||
        act.type === 'post_scheduled' ||
        act.type === 'post_created'
      );
    }
    if (auditCategory === 'targets') {
      return (
        act.type === 'target_created' ||
        act.type === 'target_updated' ||
        act.type === 'target_deleted'
      );
    }
    if (auditCategory === 'media') {
      return act.type === 'video_uploaded' || act.type === 'video_deleted';
    }
    return true;
  });

  const resetOutcomeFilters = () => {
    setStatusFilter('all');
    setPlatformFilter('all');
  };

  const handleRetry = async (postId: string, platform: PlatformType) => {
    try {
      setActionError(null);
      setActionLoadingId(`${postId}-${platform}`);
      await onRetryPlatformPublish(postId, platform);
    } catch (err: any) {
      setActionError(`Retry failed for ${platform}: ${err?.message || 'Server error'}`);
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setActionLoadingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!postToDelete) return;
    try {
      setActionError(null);
      setActionLoadingId(postToDelete.id);
      await onDeletePost(postToDelete.id);
      setPostToDelete(null);
    } catch (err: any) {
      setActionError(`Failed to delete post: ${err?.message || 'Server error'}`);
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status: PostStatus) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-[#1F6D52]" />
            <span>Published</span>
          </span>
        );
      case 'pending_confirmation':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
            <Clock className="w-3 h-3 text-sky-600" />
            <span>Pending Confirmation / Test</span>
          </span>
        );
      case 'publishing':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 animate-pulse">
            <Send className="w-3 h-3 text-[#1F6D52]" />
            <span>Publishing...</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-700" />
            <span>Failed</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F8F6F1] text-[#0F172A]/60 border border-[#DDD7CD]">
            <XCircle className="w-3 h-3" />
            <span>Cancelled</span>
          </span>
        );
      case 'scheduled':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-[#BD7131]" />
            <span>Scheduled</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F8F6F1] text-[#0F172A]/60 border border-[#DDD7CD]">
            <span>{status}</span>
          </span>
        );
    }
  };

  const getActivityIcon = (type: ActivityLog['type']) => {
    switch (type) {
      case 'post_published':
        return <CheckCircle2 className="w-4 h-4 text-[#1F6D52]" />;
      case 'post_failed':
        return <AlertCircle className="w-4 h-4 text-rose-700" />;
      case 'post_cancelled':
        return <XCircle className="w-4 h-4 text-[#0F172A]/50" />;
      case 'post_scheduled':
      case 'post_created':
        return <Clock className="w-4 h-4 text-[#BD7131]" />;
      case 'video_uploaded':
      case 'video_deleted':
        return <Video className="w-4 h-4 text-[#1F6D52]" />;
      case 'target_created':
      case 'target_updated':
      case 'target_deleted':
        return <Target className="w-4 h-4 text-[#BD7131]" />;
      default:
        return <Activity className="w-4 h-4 text-[#0F172A]/60" />;
    }
  };

  const getPlatformLabel = (plat: PlatformType) => {
    switch (plat) {
      case 'tiktok':
        return 'TikTok';
      case 'instagram':
        return 'Instagram Reels';
      case 'facebook':
        return 'Facebook Page';
      default:
        return plat;
    }
  };

  const getVideoNameForActivity = (act: ActivityLog) => {
    if (act.videoId) {
      const match = videos.find((v) => v.id === act.videoId);
      if (match) return match.originalName;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Action Error Banner */}
      {actionError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            <span className="font-semibold">{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-rose-600 hover:text-rose-900 font-bold ml-3 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Screen Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DDD7CD]">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#111827] tracking-tight">
              Publishing History
            </h1>
          </div>
          <div className="mt-2.5 inline-flex items-center px-4 py-2 rounded-xl bg-white/90 border border-[#D1D5DB] shadow-xs">
            <p className="text-base sm:text-lg font-bold text-[#111827] tracking-tight">
              Actual publishing outcomes, platform responses, failed attempts, and persistent system audit trail.
            </p>
          </div>
        </div>
      </div>

      {/* Honest Error State */}
      {loadError && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-700 shrink-0" />
            <div>
              <p className="font-bold text-sm">Failed to load publishing history data</p>
              <p className="text-rose-700/90 mt-0.5">{loadError}</p>
            </div>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-1.5 rounded-lg bg-white border border-rose-300 font-semibold text-rose-800 hover:bg-rose-50 transition cursor-pointer flex items-center space-x-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      {/* Honest Loading State */}
      {isLoading && !loadError && (
        <div className="space-y-4">
          <div className="h-12 bg-white/80 border border-[#D1D5DB] rounded-xl animate-pulse" />
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-32 bg-white/80 border border-[#D1D5DB] rounded-2xl p-5 animate-pulse"
              />
            ))}
          </div>
        </div>
      )}

      {/* VIEW 1: PUBLISHING OUTCOMES */}
      {!isLoading && !loadError && activeView === 'outcomes' && (
        <>
          {/* Outcomes Records List */}
          <div className="space-y-4">
            {/* Case A: No outcomes exist at all */}
            {outcomePosts.length === 0 ? (
              <div className="text-center py-16 px-4 bg-[#F4F1EB] border border-dashed border-[#DDD7CD] rounded-2xl">
                <div className="w-12 h-12 rounded-2xl bg-[#F8F6F1] flex items-center justify-center mx-auto text-[#0F172A]/50 mb-3 border border-[#DDD7CD]">
                  <History className="w-6 h-6 text-[#1F6D52]" />
                </div>
                <h3 className="text-base font-bold text-[#0F172A]">No Publishing Outcomes Yet</h3>
                <p className="text-xs text-[#0F172A]/70 max-w-md mx-auto mt-1 leading-relaxed">
                  Confirmed publications, failed publishing attempts, and cancellations will appear
                  here once execution occurs. Posts that are purely scheduled remain in the{' '}
                  <strong className="text-[#0F172A] font-semibold">Publishing Calendar</strong> until
                  a publishing attempt is executed.
                </p>
              </div>
            ) : filteredPosts.length === 0 ? (
              /* Case B: Outcomes exist, but filter criteria produced 0 matches */
              <div className="text-center py-14 px-4 bg-[#F4F1EB] border border-[#DDD7CD] rounded-2xl">
                <div className="w-10 h-10 rounded-xl bg-[#F8F6F1] flex items-center justify-center mx-auto text-[#0F172A]/50 mb-3 border border-[#DDD7CD]">
                  <Filter className="w-5 h-5 text-[#BD7131]" />
                </div>
                <h3 className="text-sm font-bold text-[#0F172A]">No Outcomes Match Selected Filters</h3>
                <p className="text-xs text-[#0F172A]/70 max-w-sm mx-auto mt-1">
                  There are {outcomePosts.length} total publishing outcome records, but none match
                  status &ldquo;<span className="font-semibold text-[#0F172A]">{statusFilter}</span>&rdquo;
                  and platform &ldquo;
                  <span className="font-semibold text-[#0F172A]">{platformFilter}</span>&rdquo;.
                </p>
                <button
                  onClick={resetOutcomeFilters}
                  className="mt-4 px-3.5 py-1.5 rounded-xl bg-[#1F6D52] hover:bg-[#1F6D52]/90 text-white text-xs font-bold transition shadow-2xs cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              /* Case C: Render Real Outcomes */
              filteredPosts.map((post) => {
                const platformsList: PlatformType[] = ['tiktok', 'instagram', 'facebook'];
                const enabledPlatforms = platformsList.filter((p) => post.platforms[p]?.enabled);

                return (
                  <div
                    key={post.id}
                    className="bg-[#F4F1EB] border border-[#DDD7CD] rounded-2xl p-5 shadow-xs space-y-4 transition"
                  >
                    {/* Top Row: Video info, title, overall badge, delete action */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DDD7CD]">
                      <div className="flex items-center space-x-3.5 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-slate-900 border border-[#DDD7CD] flex items-center justify-center shrink-0 overflow-hidden relative shadow-2xs">
                          {post.video?.fileUrl ? (
                            post.video.thumbnailUrl ? (
                              <img
                                src={post.video.thumbnailUrl}
                                alt=""
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <video
                                src={post.video.fileUrl}
                                className="w-full h-full object-cover"
                                muted
                                preload="none"
                              />
                            )
                          ) : (
                            <Film className="w-5 h-5 text-slate-400" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-[#0F172A] truncate">
                            {post.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#0F172A]/60 mt-0.5">
                            {post.video?.originalName && (
                              <span className="font-mono text-[#0F172A]/70 truncate max-w-xs">
                                {post.video.originalName}
                              </span>
                            )}
                            {post.video?.originalName && <span>•</span>}
                            <span>Created {new Date(post.createdAt).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>{enabledPlatforms.length} destination platform(s)</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 self-end sm:self-auto">
                        {getStatusBadge(post.status)}
                        <button
                          onClick={() => setPostToDelete(post)}
                          className="p-1.5 text-[#0F172A]/40 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete Post Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Platform Execution Outcome Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {enabledPlatforms.map((plat) => {
                        const platConfig = post.platforms[plat];
                        const isPublished = platConfig.status === 'published';
                        const isFailed = platConfig.status === 'failed';
                        const isCancelled = platConfig.status === 'cancelled';
                        const isScheduled = platConfig.status === 'scheduled';
                        const isActionLoading = actionLoadingId === `${post.id}-${plat}`;

                        return (
                          <div
                            key={plat}
                            className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2 text-xs shadow-2xs ${
                              isPublished
                                ? 'bg-[#F8F6F1] border-emerald-300'
                                : isFailed
                                ? 'bg-rose-50/50 border-rose-200'
                                : isCancelled
                                ? 'bg-[#F8F6F1] border-[#DDD7CD] opacity-80'
                                : 'bg-[#F8F6F1] border-[#DDD7CD]'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-bold text-[#0F172A] uppercase text-[11px] tracking-wide">
                                  {getPlatformLabel(plat)}
                                </span>
                                {getStatusBadge(platConfig.status)}
                              </div>

                              {/* Caption / Content preview */}
                              {platConfig.caption && (
                                <p className="text-[11px] text-[#0F172A]/70 line-clamp-2 italic mb-2">
                                  &ldquo;{platConfig.caption}&rdquo;
                                </p>
                              )}

                              {/* Confirmed Output Details */}
                              {isPublished && (
                                <div className="space-y-1.5 pt-1 border-t border-[#DDD7CD]/60">
                                  {platConfig.publishedAt && (
                                    <div className="text-[11px] text-[#0F172A]/70 flex items-center space-x-1">
                                      <CheckCircle2 className="w-3 h-3 text-[#1F6D52]" />
                                      <span>
                                        Published{' '}
                                        {new Date(platConfig.publishedAt).toLocaleString([], {
                                          weekday: 'short',
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                    </div>
                                  )}
                                  {platConfig.externalPostId && (
                                    <div className="text-[10px] font-mono text-[#0F172A]/60 truncate bg-[#F4F1EB] px-2 py-0.5 rounded border border-[#DDD7CD]">
                                      ID: {platConfig.externalPostId}
                                    </div>
                                  )}
                                  {platConfig.externalPostUrl && (
                                    <a
                                      href={platConfig.externalPostUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center space-x-1 text-[11px] text-[#1F6D52] hover:underline font-semibold mt-1"
                                    >
                                      <span>View Live Post</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              )}

                              {/* Error response on failure */}
                              {isFailed && (
                                <div className="space-y-1.5 pt-1 border-t border-rose-200">
                                  <div className="text-xs text-rose-800 font-semibold flex items-start gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                                    <span className="line-clamp-2">
                                      {platConfig.errorMessage ||
                                        'Platform response: API error during publishing'}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-[#0F172A]/50 font-mono flex items-center justify-between">
                                    <span>Attempts: {platConfig.attemptCount || 1}</span>
                                    {platConfig.scheduledAt && (
                                      <span>
                                        {new Date(platConfig.scheduledAt).toLocaleTimeString([], {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Cancelled state */}
                              {isCancelled && (
                                <div className="text-[11px] text-[#0F172A]/60 pt-1 border-t border-[#DDD7CD]/60">
                                  Publishing job cancelled prior to dispatch.
                                </div>
                              )}

                              {/* Scheduled state indicator */}
                              {isScheduled && (
                                <div className="text-[11px] text-[#0F172A]/70 font-mono pt-1 border-t border-[#DDD7CD]/60">
                                  Scheduled for:{' '}
                                  {platConfig.scheduledAt
                                    ? new Date(platConfig.scheduledAt).toLocaleString([], {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : 'Pending'}
                                </div>
                              )}
                            </div>

                            {/* Safe Retry Action (Enabled ONLY on Failed status via real backend endpoint) */}
                            {isFailed && (
                              <button
                                onClick={() => handleRetry(post.id, plat)}
                                disabled={isActionLoading}
                                className="w-full mt-2 py-1.5 px-3 rounded-lg bg-white hover:bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                              >
                                <RotateCcw
                                  className={`w-3.5 h-3.5 ${
                                    isActionLoading ? 'animate-spin' : ''
                                  }`}
                                />
                                <span>{isActionLoading ? 'Retrying...' : 'Retry Publishing'}</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* VIEW 2: AUDIT TRAIL */}
      {!isLoading && !loadError && activeView === 'audit_trail' && (
        <div className="bg-[#F4F1EB] border border-[#DDD7CD] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DDD7CD]">
            <div className="flex items-center space-x-2.5">
              <Activity className="w-5 h-5 text-[#1F6D52]" />
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">Audit Trail &amp; Event Log</h2>
                <p className="text-xs text-[#0F172A]/70">
                  Immutable server-recorded events for publishing triggers, video asset uploads, and monthly target operations.
                </p>
              </div>
            </div>

            {/* Audit Category Filter */}
            <div className="flex items-center gap-1.5 text-xs bg-[#F8F6F1] p-1 rounded-xl border border-[#DDD7CD] self-start sm:self-auto">
              {(
                [
                  { key: 'all', label: 'All Events' },
                  { key: 'publishing', label: 'Publishing' },
                  { key: 'targets', label: 'Targets' },
                  { key: 'media', label: 'Media' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setAuditCategory(cat.key)}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-xs ${
                    auditCategory === cat.key
                      ? 'bg-[#F4F1EB] text-[#0F172A] font-bold shadow-2xs border border-[#DDD7CD]'
                      : 'text-[#0F172A]/70 hover:text-[#0F172A]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {filteredActivities.length === 0 ? (
              <div className="text-center py-12 px-4 bg-[#F8F6F1] border border-dashed border-[#DDD7CD] rounded-xl">
                <Activity className="w-6 h-6 text-[#0F172A]/40 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-[#0F172A]">No Audit Events Found</h4>
                <p className="text-xs text-[#0F172A]/60 max-w-sm mx-auto mt-1">
                  {auditCategory === 'all'
                    ? 'No system operations have been logged yet. Video uploads, scheduling jobs, and monthly target updates will be recorded here.'
                    : `No audit events logged in the "${auditCategory}" category.`}
                </p>
                {auditCategory !== 'all' && (
                  <button
                    onClick={() => setAuditCategory('all')}
                    className="mt-3 px-3 py-1 rounded-lg bg-[#F4F1EB] hover:bg-[#DDD7CD] text-xs font-semibold text-[#0F172A] transition border border-[#DDD7CD] cursor-pointer"
                  >
                    View All Events
                  </button>
                )}
              </div>
            ) : (
              filteredActivities.map((act) => {
                const videoName = getVideoNameForActivity(act);
                return (
                  <div
                    key={act.id}
                    className="flex items-start space-x-3.5 p-3.5 rounded-xl bg-[#F8F6F1] border border-[#DDD7CD] text-xs shadow-2xs transition hover:border-[#DDD7CD]"
                  >
                    <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-[#F4F1EB] border border-[#DDD7CD]">
                      {getActivityIcon(act.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-[#0F172A]">{act.title}</span>
                          {act.platform && (
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-[#DDD7CD]/40 text-[#0F172A]/80 font-semibold">
                              {getPlatformLabel(act.platform)}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-[#0F172A]/50">
                          {new Date(act.timestamp).toLocaleString([], {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>

                      <p className="text-[#0F172A]/70 mt-1">{act.description}</p>

                      {/* References context */}
                      {(videoName || act.videoId || act.postId) && (
                        <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-[#DDD7CD]/50 text-[10px] text-[#0F172A]/60 font-mono">
                          {videoName && (
                            <span className="inline-flex items-center space-x-1 bg-[#F4F1EB] px-2 py-0.5 rounded border border-[#DDD7CD]">
                              <Film className="w-3 h-3 text-[#1F6D52]" />
                              <span className="truncate max-w-xs">{videoName}</span>
                            </span>
                          )}
                          {act.postId && (
                            <span className="bg-[#F4F1EB] px-2 py-0.5 rounded border border-[#DDD7CD]">
                              Post: {act.postId}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {postToDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-[#F8F6F1] border border-[#DDD7CD] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-[#0F172A]">Delete Post Record?</h3>
            <p className="text-xs text-[#0F172A]/70 leading-relaxed">
              Are you sure you want to permanently delete the history record for &ldquo;
              <strong className="text-[#0F172A] font-semibold">{postToDelete.title}</strong>&rdquo;?
              This removes the publication record from the database.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#DDD7CD]">
              <button
                onClick={() => setPostToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0F172A] hover:bg-[#F4F1EB] transition border border-[#DDD7CD] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={actionLoadingId === postToDelete.id}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 transition shadow-xs cursor-pointer flex items-center space-x-1.5"
              >
                {actionLoadingId === postToDelete.id ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Record</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
