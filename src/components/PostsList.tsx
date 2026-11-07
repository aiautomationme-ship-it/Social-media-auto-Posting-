import React, { useState } from 'react';
import {
  CalendarClock,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  ExternalLink,
  RotateCcw,
  Trash2,
  Film,
  Filter,
} from 'lucide-react';
import type { SocialPost, PlatformType, PostStatus } from '../types/index.ts';

interface PostsListProps {
  posts: SocialPost[];
  onCancelPost: (postId: string) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
  onRetryPlatformPublish: (postId: string, platform: PlatformType) => Promise<void>;
  onCreateNewPost: () => void;
  isLoading?: boolean;
}

export const PostsList: React.FC<PostsListProps> = ({
  posts,
  onCancelPost,
  onDeletePost,
  onRetryPlatformPublish,
  onCreateNewPost,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | PostStatus>('all');
  const [platformFilter, setPlatformFilter] = useState<'all' | PlatformType>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const filteredPosts = posts.filter((post) => {
    if (statusFilter !== 'all' && post.status !== statusFilter) return false;
    if (platformFilter !== 'all' && !post.platforms[platformFilter]?.enabled) return false;
    return true;
  });

  const getStatusBadge = (status: PostStatus) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            <span>Published</span>
          </span>
        );
      case 'publishing':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
            <Send className="w-3 h-3" />
            <span>Publishing...</span>
          </span>
        );
      case 'scheduled':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" />
            <span>Scheduled</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3" />
            <span>Failed</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <XCircle className="w-3 h-3" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <span>Draft</span>
          </span>
        );
    }
  };

  const handleRetry = async (postId: string, platform: PlatformType) => {
    try {
      setActionLoadingId(`${postId}-${platform}`);
      await onRetryPlatformPublish(postId, platform);
    } catch (err: any) {
      alert(err?.message || 'Retry failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancel = async (postId: string) => {
    try {
      setActionLoadingId(postId);
      await onCancelPost(postId);
    } catch (err: any) {
      alert(err?.message || 'Cancellation failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post record?')) return;
    try {
      setActionLoadingId(postId);
      await onDeletePost(postId);
    } catch (err: any) {
      alert(err?.message || 'Delete failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Social Media Posts &amp; Jobs
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-white text-slate-700 font-mono font-medium border border-[#E5E7EB] shadow-2xs">
              {posts.length} Total
            </span>
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Monitor publishing lifecycle across TikTok, Instagram Reels, and Facebook Pages.
          </p>
        </div>

        <button
          onClick={onCreateNewPost}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-[#1F6D52] hover:bg-[#185741] text-white rounded-xl text-sm font-semibold shadow-xs transition self-start sm:self-auto cursor-pointer"
        >
          <CalendarClock className="w-4 h-4" />
          <span>New Scheduled Post</span>
        </button>
      </div>

      {/* Filter Bar Well */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-700">Filter Status:</span>
          {(['all', 'scheduled', 'published', 'failed', 'cancelled'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#1F6D52] text-white shadow-2xs font-semibold'
                  : 'bg-[#F9FAFB] text-slate-600 hover:text-slate-900 border border-[#E5E7EB]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-700">Platform:</span>
          {(['all', 'tiktok', 'instagram', 'facebook'] as const).map((pl) => (
            <button
              key={pl}
              onClick={() => setPlatformFilter(pl)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition cursor-pointer ${
                platformFilter === pl
                  ? 'bg-slate-800 text-white font-semibold shadow-2xs'
                  : 'bg-[#F9FAFB] text-slate-600 hover:text-slate-900 border border-[#E5E7EB]'
              }`}
            >
              {pl}
            </button>
          ))}
        </div>
      </div>

      {/* Posts List */}
      {filteredPosts.length === 0 ? (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[#F9FAFB] flex items-center justify-center mx-auto text-slate-400 mb-3 border border-[#E5E7EB]">
            <CalendarClock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">No Posts Matching Criteria</h3>
          <p className="text-xs text-slate-600 max-w-sm mx-auto mt-1 mb-5">
            {posts.length === 0
              ? 'No posts created yet. Create a post and schedule it across your social accounts.'
              : 'Try adjusting the filters above to view posts.'}
          </p>
          <button
            onClick={onCreateNewPost}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#1F6D52] hover:bg-[#185741] text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <span>Create a Post</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => {
            const platforms: PlatformType[] = ['tiktok', 'instagram', 'facebook'];
            const activePlatforms = platforms.filter((p) => post.platforms[p]?.enabled);

            return (
              <div
                key={post.id}
                className="bg-white border border-[#E5E7EB] rounded-2xl p-5 hover:border-[#D1D5DB] transition-all shadow-xs space-y-4"
              >
                {/* Top Post Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-slate-950 border border-[#E5E7EB] overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                      {post.video ? (
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
                            preload="none"
                          />
                        )
                      ) : (
                        <Film className="w-5 h-5 text-slate-400" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base font-semibold text-slate-900 truncate max-w-md">
                          {post.title}
                        </h3>
                        {getStatusBadge(post.status)}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Created {new Date(post.createdAt).toLocaleDateString()} •{' '}
                        {activePlatforms.length} platform destinations
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-start sm:self-auto">
                    {post.status === 'scheduled' && (
                      <button
                        onClick={() => handleCancel(post.id)}
                        disabled={actionLoadingId === post.id}
                        className="px-3 py-1.5 rounded-lg bg-[#F9FAFB] hover:bg-slate-100 border border-[#D1D5DB] text-slate-700 text-xs font-medium transition cursor-pointer"
                      >
                        Cancel Schedule
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(post.id)}
                      disabled={actionLoadingId === post.id}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="Delete Post Record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Per-Platform Cards Grid (Layered 30% Interior Cards) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-[#E5E7EB]">
                  {platforms.map((plat) => {
                    const config = post.platforms[plat];
                    if (!config || !config.enabled) {
                      return (
                        <div
                          key={plat}
                          className="p-3.5 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] text-slate-400 text-xs italic"
                        >
                          <span className="capitalize font-medium text-slate-600">{plat}</span>: Not included
                        </div>
                      );
                    }

                    const platScheduledAt = config.scheduledAt || post.defaultScheduledAt;

                    return (
                      <div
                        key={plat}
                        className="p-3.5 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#D1D5DB] transition-all flex flex-col justify-between space-y-2.5 shadow-2xs"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold capitalize text-slate-900">
                              {plat === 'instagram'
                                ? 'Instagram Reels'
                                : plat === 'facebook'
                                ? 'Facebook Page'
                                : 'TikTok'}
                            </span>
                            {getStatusBadge(config.status)}
                          </div>

                          {/* Caption Snippet in differentiated sub-well */}
                          <p className="text-xs text-slate-700 line-clamp-2 italic bg-white border border-[#E5E7EB] p-2.5 rounded-lg">
                            &ldquo;{config.caption || '(No caption text provided)'}&rdquo;
                          </p>

                          {/* Error Banner if failed */}
                          {config.status === 'failed' && config.errorMessage && (
                            <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-700 font-medium">
                              Error: {config.errorMessage}
                            </div>
                          )}

                          {/* Scheduled Time */}
                          {config.status === 'scheduled' && platScheduledAt && (
                            <div className="mt-2 text-[11px] text-amber-700 flex items-center space-x-1 font-medium">
                              <Clock className="w-3 h-3 shrink-0 text-amber-600" />
                              <span>Due {new Date(platScheduledAt).toLocaleString()}</span>
                            </div>
                          )}

                          {/* Published Info */}
                          {config.status === 'published' && config.publishedAt && (
                            <div className="mt-2 text-[11px] text-emerald-700 flex items-center space-x-1 font-medium">
                              <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-600" />
                              <span>Published {new Date(config.publishedAt).toLocaleString()}</span>
                            </div>
                          )}
                        </div>

                        {/* Actions for this platform */}
                        <div className="flex items-center justify-between pt-2 border-t border-[#E5E7EB] text-xs">
                          {config.status === 'published' && config.externalPostUrl ? (
                            <a
                              href={config.externalPostUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#1F6D52] hover:text-[#185741] flex items-center space-x-1 font-semibold"
                            >
                              <span>View live post</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : config.status === 'failed' ? (
                            <button
                              onClick={() => handleRetry(post.id, plat)}
                              disabled={actionLoadingId === `${post.id}-${plat}`}
                              className="text-amber-700 hover:text-amber-800 flex items-center space-x-1 font-semibold cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Safe Retry</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-500 font-mono">
                              Attempts: {config.attemptCount}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
