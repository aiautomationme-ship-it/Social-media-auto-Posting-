import React, { useState } from 'react';
import {
  CalendarClock,
  Clock,
  Film,
  ArrowRight,
  XCircle,
  LayoutList,
  CalendarDays,
  PlusCircle,
} from 'lucide-react';
import type { SocialPost, PlatformType } from '../types/index.ts';

interface UpcomingContentProps {
  upcomingPosts: SocialPost[];
  onCancelPost?: (postId: string) => Promise<void>;
  onNavigateToPosts?: () => void;
  onCreatePost?: () => void;
}

export const UpcomingContent: React.FC<UpcomingContentProps> = ({
  upcomingPosts,
  onCancelPost,
  onNavigateToPosts,
  onCreatePost,
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'week'>('list');
  const [filterPlatform, setFilterPlatform] = useState<'all' | PlatformType>('all');

  // Filter posts
  const filteredUpcoming = upcomingPosts.filter((post) => {
    if (filterPlatform === 'all') return true;
    return post.platforms[filterPlatform]?.enabled && post.platforms[filterPlatform]?.status === 'scheduled';
  });

  // Generate 7-day strip (current week Monday through Sunday)
  const today = new Date();
  const currentDayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday
  const distanceToMonday = (currentDayOfWeek + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - distanceToMonday);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-7 shadow-xs">
      {/* Header with View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E5E7EB]">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#1F6D52]/10 border border-[#1F6D52]/20 flex items-center justify-center text-[#1F6D52] shadow-2xs">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Upcoming Queue</h2>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] text-slate-700">
                {upcomingPosts.length} queued
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Scheduled tasks processed autonomously by the background server daemon.
            </p>
          </div>
        </div>

        {/* View Switcher & Action */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          {upcomingPosts.length > 0 && (
            <div className="flex items-center bg-[#F9FAFB] p-1 rounded-xl border border-[#E5E7EB] shadow-2xs">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1 ${
                  viewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="List View"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`p-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1 ${
                  viewMode === 'week'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Week Horizon View"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Week</span>
              </button>
            </div>
          )}

          {upcomingPosts.length > 0 && onNavigateToPosts && (
            <button
              onClick={onNavigateToPosts}
              className="text-xs font-semibold text-[#1F6D52] hover:text-[#185741] flex items-center space-x-1 px-2.5 py-1.5 rounded-xl hover:bg-[#F9FAFB] transition cursor-pointer"
            >
              <span>Manage All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Week Horizon Strip (When in Week Mode) */}
      {viewMode === 'week' && upcomingPosts.length > 0 && (
        <div className="pt-5 pb-2">
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {weekDays.map((day, idx) => {
              const isToday = day.toDateString() === today.toDateString();
              const dayStr = day.toLocaleDateString(undefined, { weekday: 'short' });
              const dateNum = day.getDate();

              // Posts scheduled on this day
              const dayPosts = upcomingPosts.filter((p) => {
                const pDate = p.defaultScheduledAt ? new Date(p.defaultScheduledAt) : null;
                return pDate && pDate.toDateString() === day.toDateString();
              });

              return (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl border text-center transition flex flex-col justify-between min-h-[92px] ${
                    isToday
                      ? 'bg-emerald-50/70 border-emerald-300 shadow-2xs'
                      : dayPosts.length > 0
                      ? 'bg-[#F9FAFB] border-[#D1D5DB]'
                      : 'bg-[#F9FAFB] border-[#E5E7EB]'
                  }`}
                >
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-600 block">
                      {dayStr}
                    </span>
                    <span
                      className={`text-sm font-bold font-mono mt-0.5 inline-block ${
                        isToday ? 'text-[#1F6D52]' : 'text-slate-800'
                      }`}
                    >
                      {dateNum}
                    </span>
                  </div>

                  <div className="pt-1">
                    {dayPosts.length > 0 ? (
                      <span className="inline-block text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white text-[#1F6D52] border border-emerald-200 shadow-2xs">
                        {dayPosts.length} post{dayPosts.length > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-600">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Content Queue List */}
      <div className="pt-5">
        {upcomingPosts.length === 0 ? (
          <div className="text-center py-10 px-4 bg-[#F9FAFB] border border-dashed border-[#D1D5DB] rounded-2xl">
            <div className="w-13 h-13 rounded-2xl bg-white flex items-center justify-center mx-auto text-slate-400 mb-3 border border-[#E5E7EB] shadow-2xs">
              <Clock className="w-6 h-6 text-[#1F6D52]" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Queue is Clear</h3>
            <p className="text-xs text-slate-600 max-w-sm mx-auto mt-1 mb-5">
              There is currently no content scheduled for automatic publishing. Create and schedule a
              post to populate the queue.
            </p>
            {onCreatePost && (
              <button
                onClick={onCreatePost}
                className="px-4 py-2.5 bg-[#1F6D52] hover:bg-[#185741] text-white rounded-xl text-xs font-bold transition shadow-xs inline-flex items-center space-x-2 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Schedule Next Post</span>
              </button>
            )}
          </div>
        ) : filteredUpcoming.length === 0 ? (
          <div className="text-center py-8 px-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-xs text-slate-500">
            No scheduled posts for the selected platform filter.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredUpcoming.map((post) => {
              const activePlatforms = (['tiktok', 'instagram', 'facebook'] as PlatformType[]).filter(
                (plat) => post.platforms[plat]?.enabled && post.platforms[plat]?.status === 'scheduled'
              );

              const firstScheduled =
                post.defaultScheduledAt ||
                activePlatforms.map((p) => post.platforms[p]?.scheduledAt).find(Boolean);

              const d = firstScheduled ? new Date(firstScheduled) : null;
              const formattedTime = d
                ? d.toLocaleString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Pending trigger';

              return (
                <div
                  key={post.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#D1D5DB] hover:bg-slate-50/80 gap-3.5 transition shadow-2xs"
                >
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <div className="w-13 h-13 rounded-xl bg-slate-950 border border-[#E5E7EB] flex items-center justify-center shrink-0 overflow-hidden relative shadow-2xs">
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
                            muted
                            preload="none"
                          />
                        )
                      ) : (
                        <Film className="w-5 h-5 text-slate-400" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 truncate">
                        {post.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {activePlatforms.map((plat) => (
                          <span
                            key={plat}
                            className="text-[10px] uppercase font-mono font-semibold px-2 py-0.5 rounded bg-white text-slate-700 border border-[#E5E7EB]"
                          >
                            {plat}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end space-x-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E5E7EB]">
                    <div className="text-right">
                      <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
                        <Clock className="w-3.5 h-3.5 text-[#1F6D52]" />
                        <span>{formattedTime}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">Scheduled trigger</span>
                    </div>

                    {onCancelPost && (
                      <button
                        onClick={() => onCancelPost(post.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Cancel Scheduled Post"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
