import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  Clock,
  Film,
  XCircle,
  Calendar,
  LayoutList,
  AlertCircle,
  Share2,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  X,
  RotateCcw,
} from 'lucide-react';
import type { SocialPost, PlatformType } from '../types/index.ts';

interface PublishingCalendarProps {
  posts: SocialPost[];
  onCancelPost: (postId: string) => Promise<void>;
  onReschedulePost: (postId: string, newScheduledAt: string) => Promise<void>;
  isLoading?: boolean;
}

// 2-hour interval slots for 24-hour coverage
const TIME_SLOTS = [
  { hour: 0, label: '12:00 AM' },
  { hour: 2, label: '02:00 AM' },
  { hour: 4, label: '04:00 AM' },
  { hour: 6, label: '06:00 AM' },
  { hour: 8, label: '08:00 AM' },
  { hour: 10, label: '10:00 AM' },
  { hour: 12, label: '12:00 PM' },
  { hour: 14, label: '02:00 PM' },
  { hour: 16, label: '04:00 PM' },
  { hour: 18, label: '06:00 PM' },
  { hour: 20, label: '08:00 PM' },
  { hour: 22, label: '10:00 PM' },
];

export const PublishingCalendar: React.FC<PublishingCalendarProps> = ({
  posts,
  onCancelPost,
  onReschedulePost,
  isLoading = false,
}) => {
  const [viewMode, setViewMode] = useState<'week' | 'list'>('week');
  const [filterPlatform, setFilterPlatform] = useState<'all' | PlatformType>('all');
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [selectedMobileDayIndex, setSelectedMobileDayIndex] = useState<number>(0);

  // Sorting in list view
  const [listSortBy, setListSortBy] = useState<'soonest' | 'latest' | 'title'>('soonest');

  // Modals
  const [inspectingPost, setInspectingPost] = useState<SocialPost | null>(null);
  const [reschedulingPost, setReschedulingPost] = useState<SocialPost | null>(null);
  const [cancellingPost, setCancellingPost] = useState<SocialPost | null>(null);
  const [newScheduleDate, setNewScheduleDate] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  const userTimezone = useMemo(() => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }, []);

  // Helper to extract effective scheduled timestamp from a post
  const getPostScheduledDate = (post: SocialPost): Date | null => {
    if (filterPlatform !== 'all') {
      const platConfig = post.platforms[filterPlatform];
      if (platConfig?.enabled && platConfig.scheduledAt) {
        return new Date(platConfig.scheduledAt);
      }
    }
    const raw =
      post.defaultScheduledAt ||
      Object.values(post.platforms)
        .filter((p) => p.enabled && p.status === 'scheduled')
        .map((p) => p.scheduledAt)
        .find(Boolean);
    return raw ? new Date(raw) : null;
  };

  // 1. Filter posts down to strictly scheduled items
  const allScheduledPosts = useMemo(() => {
    return posts.filter((p) => {
      return (
        p.status === 'scheduled' ||
        Object.values(p.platforms).some((plat) => plat.enabled && plat.status === 'scheduled')
      );
    });
  }, [posts]);

  // 2. Filter by platform
  const filteredScheduledPosts = useMemo(() => {
    return allScheduledPosts.filter((p) => {
      if (filterPlatform === 'all') return true;
      return (
        p.platforms[filterPlatform]?.enabled &&
        p.platforms[filterPlatform]?.status === 'scheduled'
      );
    });
  }, [allScheduledPosts, filterPlatform]);

  // 3. Week date navigation math
  const currentWeekDays = useMemo(() => {
    const now = new Date();
    const currentDayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday
    const distanceToMonday = (currentDayOfWeek + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - distanceToMonday + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [weekOffset]);

  const weekStart = currentWeekDays[0];
  const weekEnd = currentWeekDays[6];

  const todayStr = useMemo(() => new Date().toDateString(), []);

  // Calculate posts occurring in the current week window
  const postsInCurrentWeek = useMemo(() => {
    const startMs = weekStart.getTime();
    const endMs = new Date(weekEnd).setHours(23, 59, 59, 999);

    return filteredScheduledPosts.filter((post) => {
      const d = getPostScheduledDate(post);
      if (!d) return false;
      const t = d.getTime();
      return t >= startMs && t <= endMs;
    });
  }, [filteredScheduledPosts, weekStart, weekEnd]);

  // Sorted list posts
  const sortedListPosts = useMemo(() => {
    return [...filteredScheduledPosts].sort((a, b) => {
      const dateA = getPostScheduledDate(a)?.getTime() || 0;
      const dateB = getPostScheduledDate(b)?.getTime() || 0;

      if (listSortBy === 'soonest') return dateA - dateB;
      if (listSortBy === 'latest') return dateB - dateA;
      if (listSortBy === 'title') return a.title.localeCompare(b.title);
      return 0;
    });
  }, [filteredScheduledPosts, listSortBy]);

  // Reschedule Handlers
  const handleOpenReschedule = (post: SocialPost) => {
    const d = getPostScheduledDate(post) || new Date(Date.now() + 3600000);
    const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setNewScheduleDate(localIso);
    setRescheduleError(null);
    setReschedulingPost(post);
  };

  const handleSaveReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingPost || !newScheduleDate) return;

    const parsedDate = new Date(newScheduleDate);
    if (isNaN(parsedDate.getTime()) || parsedDate.getTime() <= Date.now()) {
      setRescheduleError('Please choose a valid future date and time for publication.');
      return;
    }

    try {
      setActionLoading(true);
      setRescheduleError(null);
      await onReschedulePost(reschedulingPost.id, parsedDate.toISOString());
      setReschedulingPost(null);
      if (inspectingPost?.id === reschedulingPost.id) {
        setInspectingPost(null);
      }
    } catch (err: any) {
      setRescheduleError(err?.message || 'Failed to reschedule post.');
    } finally {
      setActionLoading(false);
    }
  };

  // Cancellation Handlers
  const confirmCancel = async () => {
    if (!cancellingPost) return;
    try {
      setActionLoading(true);
      await onCancelPost(cancellingPost.id);
      setCancellingPost(null);
      if (inspectingPost?.id === cancellingPost.id) {
        setInspectingPost(null);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to cancel scheduled post');
    } finally {
      setActionLoading(false);
    }
  };

  // Format relative countdown
  const getRelativeCountdown = (date: Date) => {
    const diffMs = date.getTime() - Date.now();
    if (diffMs <= 0) return 'Triggering soon';
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `In ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    if (diffHours > 0) return `In ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    return `In ${diffMins} min${diffMins > 1 ? 's' : ''}`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DDD7CD]">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
              Publishing Calendar
            </h1>
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-[#F4F1EB] text-[#1F6D52] border border-[#DDD7CD]">
              {filteredScheduledPosts.length} queued
            </span>
            <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1F6D52]"></span>
              </span>
              <span>Today: {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </span>
          </div>
          <p className="text-sm text-[#0F172A]/70 mt-1">
            Weekly calendar grid and scheduled queue for TikTok, Instagram Reels, and Facebook Pages.
          </p>
        </div>

        {/* View Switcher & Platform Filters */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-[#F4F1EB] p-1 rounded-xl border border-[#DDD7CD] shadow-2xs">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'week'
                  ? 'bg-[#F8F6F1] text-[#0F172A] shadow-2xs font-bold'
                  : 'text-[#0F172A]/70 hover:text-[#0F172A]'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 text-[#1F6D52]" />
              <span>Week View</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'list'
                  ? 'bg-[#F8F6F1] text-[#0F172A] shadow-2xs font-bold'
                  : 'text-[#0F172A]/70 hover:text-[#0F172A]'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5 text-[#1F6D52]" />
              <span>List View</span>
            </button>
          </div>

          {/* Platform Filter Buttons */}
          <div className="flex items-center bg-[#F4F1EB] p-1 rounded-xl border border-[#DDD7CD] text-xs">
            {(['all', 'tiktok', 'instagram', 'facebook'] as const).map((plat) => (
              <button
                key={plat}
                onClick={() => setFilterPlatform(plat)}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer capitalize ${
                  filterPlatform === plat
                    ? 'bg-[#F8F6F1] text-[#0F172A] font-bold shadow-2xs border border-[#DDD7CD]'
                    : 'text-[#0F172A]/60 hover:text-[#0F172A]'
                }`}
              >
                {plat === 'all' ? 'All' : plat === 'instagram' ? 'Instagram' : plat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Week Navigation Header (When in Week View) */}
      {viewMode === 'week' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-[#F4F1EB] border border-[#DDD7CD] rounded-2xl shadow-2xs">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className="p-1.5 rounded-lg bg-[#F8F6F1] hover:bg-white border border-[#DDD7CD] text-[#0F172A] transition shadow-2xs cursor-pointer"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => setWeekOffset(0)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                weekOffset === 0
                  ? 'bg-[#1F6D52] text-white border-[#1F6D52]'
                  : 'bg-[#F8F6F1] hover:bg-white text-[#0F172A] border-[#DDD7CD]'
              }`}
            >
              Today
            </button>

            <button
              onClick={() => setWeekOffset((prev) => prev + 1)}
              className="p-1.5 rounded-lg bg-[#F8F6F1] hover:bg-white border border-[#DDD7CD] text-[#0F172A] transition shadow-2xs cursor-pointer"
              title="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <span className="font-bold text-xs sm:text-sm text-[#0F172A] ml-2">
              {weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} –{' '}
              {weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          <div className="flex items-center space-x-2 text-xs text-[#0F172A]/70 font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-[#F8F6F1] border border-[#DDD7CD]">
              Timezone: {userTimezone}
            </span>
            <span className="text-emerald-800 font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200">
              {postsInCurrentWeek.length} scheduled this week
            </span>
          </div>
        </div>
      )}

      {/* Filter Mismatch Notice Banner (Distinguished from genuinely empty schedule) */}
      {filterPlatform !== 'all' && filteredScheduledPosts.length === 0 && allScheduledPosts.length > 0 && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900 shadow-2xs animate-in fade-in duration-150">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              No scheduled posts match the filter &ldquo;
              <strong className="capitalize">{filterPlatform}</strong>&rdquo;, though posts exist on other platforms.
            </span>
          </div>
          <button
            onClick={() => setFilterPlatform('all')}
            className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 font-semibold hover:bg-amber-100 transition cursor-pointer text-xs"
          >
            Reset Filter
          </button>
        </div>
      )}



      {/* =========================================================================
          VIEW 1: REAL WEEKLY CALENDAR (TIME AXIS + 7-DAY GRID)
          ========================================================================= */}
      {viewMode === 'week' && (
        <div className="space-y-4">
          {/* Mobile Day Selector Tabs (< md screens) */}
          <div className="md:hidden flex items-center space-x-1 overflow-x-auto pb-2">
            {currentWeekDays.map((day, idx) => {
              const isToday = day.toDateString() === todayStr;
              const isSelected = selectedMobileDayIndex === idx;
              const dayStr = day.toLocaleDateString(undefined, { weekday: 'short' });
              const dateNum = day.getDate();

              const dayPostsCount = filteredScheduledPosts.filter((post) => {
                const d = getPostScheduledDate(post);
                return d && d.toDateString() === day.toDateString();
              }).length;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedMobileDayIndex(idx)}
                  className={`flex-1 min-w-[48px] py-2 px-1 rounded-xl text-center border transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#1F6D52] text-white border-[#1F6D52] font-bold shadow-2xs'
                      : isToday
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-semibold'
                      : 'bg-[#F4F1EB] text-[#0F172A] border-[#DDD7CD]'
                  }`}
                >
                  <span className="text-xs uppercase block">{dayStr}</span>
                  <span className="text-xs font-mono font-bold block">{dateNum}</span>
                  {dayPostsCount > 0 && (
                    <span
                      className={`text-xs font-mono px-1 rounded-full ${
                        isSelected ? 'bg-white text-[#1F6D52]' : 'bg-[#1F6D52] text-white'
                      }`}
                    >
                      {dayPostsCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Desktop Full 7-Day Time Grid Container */}
          <div className="bg-[#F4F1EB] border border-[#DDD7CD] rounded-2xl overflow-hidden shadow-xs">
            {/* 7-Day Header Row */}
            <div className="grid grid-cols-8 border-b border-[#DDD7CD] bg-[#F8F6F1] divide-x divide-[#DDD7CD]">
              {/* Corner Timezone Cell */}
              <div className="p-3 text-center flex items-center justify-center font-mono text-xs text-[#0F172A]/60">
                TIME
              </div>

              {/* 7 Days Columns */}
              {currentWeekDays.map((day, idx) => {
                const isToday = day.toDateString() === todayStr;
                const dayStr = day.toLocaleDateString(undefined, { weekday: 'short' });
                const dateNum = day.getDate();
                const monthStr = day.toLocaleDateString(undefined, { month: 'short' });

                const dayPostsCount = filteredScheduledPosts.filter((post) => {
                  const d = getPostScheduledDate(post);
                  return d && d.toDateString() === day.toDateString();
                }).length;

                return (
                  <div
                    key={idx}
                    className={`p-2.5 sm:p-3 text-center transition ${
                      isToday
                        ? 'bg-emerald-50/70 border-b-2 border-b-[#1F6D52]'
                        : ''
                    }`}
                  >
                    <span className="text-xs uppercase font-bold text-[#0F172A]/60 block tracking-wider">
                      {dayStr}
                    </span>
                    <div className="flex items-center justify-center space-x-1 mt-0.5">
                      <span
                        className={`text-sm sm:text-base font-bold font-mono ${
                          isToday ? 'text-[#1F6D52]' : 'text-[#0F172A]'
                        }`}
                      >
                        {dateNum}
                      </span>
                      <span className="text-xs text-[#0F172A]/60 hidden sm:inline">
                        {monthStr}
                      </span>
                    </div>

                    {dayPostsCount > 0 ? (
                      <span className="inline-block text-xs font-mono font-bold px-1.5 py-0.2 rounded-full bg-[#1F6D52] text-white mt-1 shadow-2xs">
                        {dayPostsCount} {dayPostsCount === 1 ? 'post' : 'posts'}
                      </span>
                    ) : (
                      <span className="inline-block text-xs text-transparent mt-1 select-none">
                        -
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Time Slots Grid Rows (Desktop) */}
            <div className="hidden md:block divide-y divide-[#DDD7CD]/70 max-h-[650px] overflow-y-auto">
              {TIME_SLOTS.map((slot) => {
                return (
                  <div key={slot.hour} className="grid grid-cols-8 divide-x divide-[#DDD7CD]/70 min-h-[76px]">
                    {/* Time Axis Column */}
                    <div className="p-2.5 bg-[#F8F6F1]/70 font-mono text-xs text-[#0F172A]/60 flex items-start justify-center pt-2">
                      {slot.label}
                    </div>

                    {/* 7 Days Cells for this 2-hour slot */}
                    {currentWeekDays.map((day, dayIdx) => {
                      const isToday = day.toDateString() === todayStr;

                      // Find posts scheduled for this day in this 2-hour window [slot.hour, slot.hour + 2)
                      const cellPosts = filteredScheduledPosts.filter((post) => {
                        const d = getPostScheduledDate(post);
                        if (!d) return false;
                        if (d.toDateString() !== day.toDateString()) return false;
                        const h = d.getHours();
                        return h >= slot.hour && h < slot.hour + 2;
                      });

                      return (
                        <div
                          key={dayIdx}
                          className={`p-1.5 transition ${
                            isToday ? 'bg-emerald-50/20' : 'bg-transparent'
                          } hover:bg-[#F8F6F1]/50`}
                        >
                          {cellPosts.map((post) => {
                            const postDate = getPostScheduledDate(post);
                            const timeStr = postDate
                              ? postDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : '';

                            const activePlatforms = (['tiktok', 'instagram', 'facebook'] as PlatformType[]).filter(
                              (p) => post.platforms[p]?.enabled && post.platforms[p]?.status === 'scheduled'
                            );

                            return (
                              <div
                                key={post.id}
                                onClick={() => setInspectingPost(post)}
                                className="mb-1.5 p-2 rounded-xl bg-[#F8F6F1] border border-[#DDD7CD] hover:border-[#1F6D52] shadow-2xs transition-all cursor-pointer group"
                                title="Click to view details and manage"
                              >
                                <div className="flex items-center space-x-1.5 mb-1">
                                  <Clock className="w-3 h-3 text-[#1F6D52] shrink-0" />
                                  <span className="text-xs font-mono font-bold text-[#0F172A]">
                                    {timeStr}
                                  </span>
                                </div>

                                <h4 className="text-xs font-bold text-[#0F172A] truncate group-hover:text-[#1F6D52] transition">
                                  {post.title}
                                </h4>

                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {activePlatforms.map((plat) => (
                                    <span
                                      key={plat}
                                      className="text-xs uppercase font-mono px-1 py-0.2 rounded bg-[#F4F1EB] border border-[#DDD7CD] text-[#0F172A]"
                                    >
                                      {plat === 'instagram' ? 'IG' : plat === 'facebook' ? 'FB' : 'TT'}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Mobile View: Selected Day Time Slots Timeline (< md screens) */}
            <div className="md:hidden divide-y divide-[#DDD7CD]/70">
              {(() => {
                const currentMobileDay = currentWeekDays[selectedMobileDayIndex];
                const dayPosts = filteredScheduledPosts.filter((post) => {
                  const d = getPostScheduledDate(post);
                  return d && d.toDateString() === currentMobileDay.toDateString();
                });

                if (dayPosts.length === 0) {
                  return (
                    <div className="p-8 text-center text-xs text-[#0F172A]/60">
                      No posts scheduled for{' '}
                      <strong>{currentMobileDay.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</strong>.
                    </div>
                  );
                }

                return dayPosts.map((post) => {
                  const postDate = getPostScheduledDate(post);
                  const timeStr = postDate
                    ? postDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';
                  const activePlatforms = (['tiktok', 'instagram', 'facebook'] as PlatformType[]).filter(
                    (p) => post.platforms[p]?.enabled && post.platforms[p]?.status === 'scheduled'
                  );

                  return (
                    <div
                      key={post.id}
                      onClick={() => setInspectingPost(post)}
                      className="p-3.5 bg-[#F8F6F1] flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center shrink-0 text-white">
                          <Film className="w-4 h-4 text-slate-300" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-[#0F172A] truncate">{post.title}</h4>
                          <div className="flex items-center space-x-1.5 mt-0.5">
                            <span className="text-xs font-mono text-[#1F6D52] font-semibold">{timeStr}</span>
                            <span>•</span>
                            <div className="flex gap-1">
                              {activePlatforms.map((plat) => (
                                <span key={plat} className="text-xs uppercase font-mono px-1 rounded bg-[#F4F1EB] border border-[#DDD7CD]">
                                  {plat}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <Eye className="w-4 h-4 text-[#0F172A]/60 shrink-0" />
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: REAL SCHEDULED-POST LIST (DATA-DRIVEN STRUCTURED LIST)
          ========================================================================= */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {/* List Toolbar with Sorting */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-[#F4F1EB] border border-[#DDD7CD] rounded-2xl shadow-2xs">
            <span className="text-xs font-bold text-[#0F172A]">
              Showing {sortedListPosts.length} Scheduled Post{sortedListPosts.length === 1 ? '' : 's'}
            </span>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-[#0F172A]/60">Sort by:</span>
              <select
                value={listSortBy}
                onChange={(e) => setListSortBy(e.target.value as any)}
                className="bg-[#F8F6F1] border border-[#DDD7CD] rounded-xl px-3 py-1.5 text-xs text-[#0F172A] font-semibold focus:outline-none focus:border-[#1F6D52] shadow-2xs cursor-pointer"
              >
                <option value="soonest">Release Date (Soonest First)</option>
                <option value="latest">Release Date (Latest First)</option>
                <option value="title">Post Title (A - Z)</option>
              </select>
            </div>
          </div>

          {/* List Cards */}
          {sortedListPosts.length === 0 ? (
            <div className="bg-[#F4F1EB] border border-dashed border-[#DDD7CD] rounded-2xl p-12 text-center shadow-xs">
              <Calendar className="w-8 h-8 text-[#0F172A]/60 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-[#0F172A]">No Scheduled Posts in Queue</h3>
              <p className="text-xs text-[#0F172A]/70 max-w-sm mx-auto mt-1">
                There are currently no scheduled posts matching your selection.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedListPosts.map((post) => {
                const postDate = getPostScheduledDate(post);
                const activePlatforms = (['tiktok', 'instagram', 'facebook'] as PlatformType[]).filter(
                  (p) => post.platforms[p]?.enabled && post.platforms[p]?.status === 'scheduled'
                );

                const formattedTime = postDate
                  ? postDate.toLocaleString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Pending schedule';

                const countdown = postDate ? getRelativeCountdown(postDate) : '';

                return (
                  <div
                    key={post.id}
                    className="bg-[#F4F1EB] border border-[#DDD7CD] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition hover:border-[#BD7131]/40"
                  >
                    {/* Video and metadata */}
                    <div className="flex items-start space-x-4 min-w-0">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-950 border border-[#DDD7CD] flex items-center justify-center shrink-0 overflow-hidden relative shadow-2xs">
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
                          <Film className="w-6 h-6 text-slate-400" />
                        )}
                      </div>

                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-[#0F172A] truncate">
                            {post.title}
                          </h3>
                          <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3 text-[#BD7131]" />
                            <span>Scheduled</span>
                          </span>
                        </div>

                        {/* Platforms Badges */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-[#0F172A]/60 flex items-center gap-1">
                            <Share2 className="w-3 h-3" />
                            <span>Destinations:</span>
                          </span>
                          {activePlatforms.map((plat) => (
                            <span
                              key={plat}
                              className="text-xs uppercase font-mono font-semibold px-2 py-0.5 rounded-md bg-[#F8F6F1] text-[#0F172A] border border-[#DDD7CD]"
                            >
                              {plat === 'instagram' ? 'Instagram Reels' : plat === 'facebook' ? 'Facebook Page' : 'TikTok'}
                            </span>
                          ))}
                        </div>

                        {/* Caption preview */}
                        {post.platforms.instagram?.caption || post.platforms.facebook?.caption || post.platforms.tiktok?.caption ? (
                          <p className="text-xs text-[#0F172A]/70 line-clamp-1 italic max-w-xl">
                            &quot;{post.platforms.instagram?.caption || post.platforms.facebook?.caption || post.platforms.tiktok?.caption}&quot;
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {/* Right column: Timing & Management Actions */}
                    <div className="flex items-center justify-between lg:justify-end space-x-4 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-[#DDD7CD]">
                      <div className="text-left lg:text-right">
                        <div className="flex items-center space-x-1.5 text-xs font-bold text-[#0F172A]">
                          <Clock className="w-3.5 h-3.5 text-[#1F6D52]" />
                          <span>{formattedTime}</span>
                        </div>
                        <span className="text-xs text-emerald-800 font-mono font-semibold">
                          {countdown}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setInspectingPost(post)}
                          className="px-3 py-1.5 rounded-xl bg-[#F8F6F1] hover:bg-white border border-[#DDD7CD] text-[#0F172A] text-xs font-semibold transition cursor-pointer shadow-2xs flex items-center space-x-1"
                          title="Inspect Post Details"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#1F6D52]" />
                          <span>Details</span>
                        </button>

                        <button
                          onClick={() => handleOpenReschedule(post)}
                          className="px-3 py-1.5 rounded-xl bg-[#F8F6F1] hover:bg-white border border-[#DDD7CD] text-[#0F172A] text-xs font-semibold transition cursor-pointer shadow-2xs flex items-center space-x-1"
                          title="Reschedule release time"
                        >
                          <Calendar className="w-3.5 h-3.5 text-[#BD7131]" />
                          <span>Reschedule</span>
                        </button>

                        <button
                          onClick={() => setCancellingPost(post)}
                          className="p-1.5 rounded-xl text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer"
                          title="Cancel Scheduled Post"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODAL 1: INSPECT POST DETAILS
          ========================================================================= */}
      {inspectingPost && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-[#F8F6F1] border border-[#DDD7CD] rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDD7CD]">
              <div className="flex items-center space-x-2">
                <CalendarDays className="w-5 h-5 text-[#1F6D52]" />
                <h3 className="text-base font-bold text-[#0F172A]">Scheduled Post Details</h3>
              </div>
              <button
                onClick={() => setInspectingPost(null)}
                className="text-[#0F172A]/60 hover:text-[#0F172A] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video preview & Title */}
            <div className="flex items-start space-x-4 bg-[#F4F1EB] p-3.5 rounded-xl border border-[#DDD7CD]">
              <div className="w-20 h-20 rounded-lg bg-slate-950 flex items-center justify-center shrink-0 overflow-hidden relative shadow-2xs">
                {inspectingPost.video ? (
                  <video
                    src={inspectingPost.video.fileUrl}
                    className="w-full h-full object-cover"
                    controls
                    preload="none"
                  />
                ) : (
                  <Film className="w-6 h-6 text-slate-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-[#0F172A] truncate">{inspectingPost.title}</h4>
                <div className="text-xs text-[#0F172A]/70 font-mono mt-1">
                  File: {inspectingPost.video?.originalName || 'video_asset.mp4'}
                </div>
                <div className="text-xs text-[#1F6D52] font-mono mt-1 font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {getPostScheduledDate(inspectingPost)?.toLocaleString() || 'Pending schedule'} ({userTimezone})
                  </span>
                </div>
              </div>
            </div>

            {/* Destination Platforms Configuration */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-[#0F172A] block uppercase tracking-wider">
                Destination Platforms Content
              </span>

              {(['tiktok', 'instagram', 'facebook'] as PlatformType[]).map((plat) => {
                const config = inspectingPost.platforms[plat];
                if (!config?.enabled) return null;

                return (
                  <div key={plat} className="p-3 bg-[#F4F1EB] rounded-xl border border-[#DDD7CD] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0F172A] uppercase text-xs">
                        {plat === 'instagram' ? 'Instagram Reels' : plat === 'facebook' ? 'Facebook Page' : 'TikTok'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                        {config.status}
                      </span>
                    </div>

                    {config.caption && (
                      <p className="text-[#0F172A]/80 italic bg-[#F8F6F1] p-2 rounded-lg border border-[#DDD7CD]/70 whitespace-pre-wrap">
                        {config.caption}
                      </p>
                    )}

                    {plat === 'tiktok' && config.tiktokSettings && (
                      <div className="flex flex-wrap gap-2 text-xs text-[#0F172A]/60 font-mono pt-1">
                        <span>Privacy: {config.tiktokSettings.privacyLevel}</span>
                        <span>•</span>
                        <span>Comments: {config.tiktokSettings.allowComment ? 'On' : 'Off'}</span>
                        <span>•</span>
                        <span>Duet: {config.tiktokSettings.allowDuet ? 'On' : 'Off'}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[#DDD7CD]">
              <button
                onClick={() => {
                  const p = inspectingPost;
                  setInspectingPost(null);
                  setCancellingPost(p);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-xl transition border border-rose-200 cursor-pointer"
              >
                Cancel This Post
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    const p = inspectingPost;
                    setInspectingPost(null);
                    handleOpenReschedule(p);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1F6D52] hover:bg-[#185741] rounded-xl shadow-xs transition cursor-pointer flex items-center space-x-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Reschedule</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: RESCHEDULE POST
          ========================================================================= */}
      {reschedulingPost && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-[#F8F6F1] border border-[#DDD7CD] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDD7CD]">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-[#1F6D52]" />
                <h3 className="text-base font-bold text-[#0F172A]">Reschedule Post</h3>
              </div>
              <button
                onClick={() => setReschedulingPost(null)}
                className="text-[#0F172A]/60 hover:text-[#0F172A] p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#0F172A]/70 leading-relaxed">
              Update the scheduled release date and time for &quot;
              <strong className="text-[#0F172A] font-semibold">{reschedulingPost.title}</strong>&quot;.
            </p>

            <form onSubmit={handleSaveReschedule} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#0F172A]">
                    New Publishing Date &amp; Time
                  </label>
                  <span className="text-xs text-[#0F172A]/60 font-mono">{userTimezone}</span>
                </div>
                <input
                  type="datetime-local"
                  value={newScheduleDate}
                  onChange={(e) => setNewScheduleDate(e.target.value)}
                  className="w-full bg-[#F4F1EB] border border-[#DDD7CD] rounded-xl px-3.5 py-2 text-xs font-mono font-medium text-[#0F172A] focus:outline-none focus:border-[#1F6D52] shadow-2xs"
                  required
                />
              </div>

              {rescheduleError && (
                <p className="text-xs text-rose-700 flex items-center gap-1 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {rescheduleError}
                </p>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#DDD7CD]">
                <button
                  type="button"
                  onClick={() => setReschedulingPost(null)}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0F172A] hover:bg-[#F4F1EB] transition border border-[#DDD7CD] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#1F6D52] hover:bg-[#185741] transition shadow-xs cursor-pointer"
                >
                  {actionLoading ? 'Updating...' : 'Save New Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: CANCEL POST CONFIRMATION
          ========================================================================= */}
      {cancellingPost && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-[#F8F6F1] border border-[#DDD7CD] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#0F172A]">Cancel Scheduled Post?</h3>
            <p className="text-xs text-[#0F172A]/70 leading-relaxed">
              Are you sure you want to cancel the scheduled publication of &ldquo;
              <strong className="text-[#0F172A] font-semibold">{cancellingPost.title}</strong>
              &rdquo;? The background daemon will not execute this job.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#DDD7CD]">
              <button
                onClick={() => setCancellingPost(null)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0F172A] hover:bg-[#F4F1EB] transition border border-[#DDD7CD] cursor-pointer"
              >
                Keep Scheduled
              </button>
              <button
                onClick={confirmCancel}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 transition shadow-xs cursor-pointer"
              >
                {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
