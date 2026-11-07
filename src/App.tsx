import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { MonthlyTargetCard } from './components/MonthlyTargetCard.tsx';
import { VideoLibrary } from './components/VideoLibrary.tsx';
import { PublishingCalendar } from './components/PublishingCalendar.tsx';
import { PublishingHistory } from './components/PublishingHistory.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { PostCreator } from './components/PostCreator.tsx';
import { FlowingGradientBackground } from './components/FlowingGradientBackground.tsx';
import type { AppTab } from './components/Navbar.tsx';
import { api } from './services/api.ts';
import type {
  DashboardStats,
  VideoRecord,
  SocialPost,
  PlatformConnection,
  PlatformType,
  ActivityLog,
} from './types/index.ts';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  PlusCircle,
} from 'lucide-react';

export default function App() {
  const now = new Date();
  const [currentTab, setCurrentTab] = useState<AppTab>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  const [userEmail, setUserEmail] = useState<string>('aiautomationme@gmail.com');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [platforms, setPlatforms] = useState<Record<PlatformType, PlatformConnection> | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  const [preselectedVideoForPost, setPreselectedVideoForPost] = useState<VideoRecord | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch all initial data via single consolidated bootstrap endpoint
  const loadData = useCallback(
    async (isBackground = false) => {
      try {
        setLoadError(null);
        if (!isBackground) setIsLoading(true);
        else setRefreshing(true);

        const data = await api.getBootstrapData(selectedMonth, selectedYear);

        if (data.user?.email) setUserEmail(data.user.email);
        setStats(data.stats);
        setVideos(data.videos || []);
        setPosts(data.posts || []);
        setPlatforms(data.platforms || ({} as any));
        setActivities(data.activities || []);
      } catch (err: any) {
        console.error('Failed to load SocialFlow data:', err);
        // Only set blocking load error if initial load failed without data
        if (!isBackground) {
          setLoadError(err?.message || 'Failed to load data from server');
        }
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [selectedMonth, selectedYear]
  );

  useEffect(() => {
    loadData();
    // Auto-refresh periodically to reflect background scheduler publishing (15s cadence prevents 429s)
    const interval = setInterval(() => {
      // Only refresh if tab is active and visible
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadData(true);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Target Actions
  const handleSaveTarget = async (targetCount: number) => {
    if (stats?.target) {
      await api.updateTarget(stats.target.id, targetCount);
      showToast(`Updated monthly target to ${targetCount} posts.`);
    } else {
      await api.createTarget(selectedMonth, selectedYear, targetCount);
      showToast(`Created target of ${targetCount} posts for this month.`);
    }
    await loadData(true);
  };

  const handleDeleteTarget = async (targetId: string) => {
    await api.deleteTarget(targetId);
    showToast('Monthly target deleted.');
    await loadData(true);
  };

  // Video Upload & Actions
  const handleUploadVideos = async (
    files: File[],
    onProgress?: (info: any) => void
  ) => {
    const res = await api.uploadVideosWithProgress(files, undefined, onProgress);
    showToast(`Successfully uploaded ${res.count} video file(s) to server storage.`);
    // Fast lightweight update: fetch fresh videos directly without heavy full-data reload
    const freshVideos = await api.getVideos();
    setVideos(freshVideos);
    // Update stats lightly in background
    api.getDashboardStats(selectedMonth, selectedYear).then(setStats).catch(() => {});
  };

  const handleDeleteVideo = async (videoId: string) => {
    try {
      await api.deleteVideo(videoId);
      showToast('Video permanently deleted from server.');
      await loadData(true);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete video', 'error');
      throw err;
    }
  };

  const handleUpdateVideo = async (videoId: string, originalName: string) => {
    try {
      await api.updateVideo(videoId, { originalName });
      showToast('Video title updated.');
      await loadData(true);
    } catch (err: any) {
      showToast(err.message || 'Failed to update video title', 'error');
      throw err;
    }
  };

  const handleReplaceVideo = async (videoId: string, file: File) => {
    try {
      await api.replaceVideo(videoId, file);
      showToast(`Video asset "${file.name}" replaced successfully.`);
      await loadData(true);
    } catch (err: any) {
      showToast(err.message || 'Failed to replace video file', 'error');
      throw err;
    }
  };

  const handleSelectVideoForPost = (video: VideoRecord) => {
    setPreselectedVideoForPost(video);
    setCurrentTab('create');
  };

  // Post Actions
  const handlePostCreated = async (newPost: SocialPost) => {
    showToast(
      newPost.status === 'published'
        ? `Post "${newPost.title}" was published successfully!`
        : `Post "${newPost.title}" scheduled across selected platforms.`
    );
    setPreselectedVideoForPost(null);
    await loadData(true);
    if (newPost.status === 'published') {
      setCurrentTab('history');
    } else {
      setCurrentTab('calendar');
    }
  };

  const handleCancelPost = async (postId: string) => {
    await api.cancelPost(postId);
    showToast('Scheduled post was cancelled.');
    await loadData(true);
  };

  const handleReschedulePost = async (postId: string, newScheduledAt: string) => {
    const existingPost = posts.find((p) => p.id === postId);
    if (!existingPost) return;

    const updatedPlatforms = { ...existingPost.platforms };
    for (const plat of ['tiktok', 'instagram', 'facebook'] as PlatformType[]) {
      if (updatedPlatforms[plat]?.enabled) {
        updatedPlatforms[plat] = {
          ...updatedPlatforms[plat],
          scheduledAt: newScheduledAt,
          status: 'scheduled',
        };
      }
    }

    await api.updatePost(postId, {
      defaultScheduledAt: newScheduledAt,
      platforms: updatedPlatforms,
      status: 'scheduled',
    });
    showToast(
      `Post rescheduled to ${new Date(newScheduledAt).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}.`
    );
    await loadData(true);
  };

  const handleDeletePost = async (postId: string) => {
    await api.deletePost(postId);
    showToast('Post record deleted.');
    await loadData(true);
  };

  const handleRetryPlatform = async (postId: string, platform: PlatformType) => {
    await api.publishNow(postId, [platform]);
    showToast(`Retried publishing to ${platform}.`);
    await loadData(true);
  };

  return (
    <div className="min-h-screen bg-transparent text-[#111827] flex flex-col font-sans selection:bg-[#111827] selection:text-white relative">
      {/* Flowing liquid gradient with interactive cursor ripple waves & silver-smoke ambiance */}
      <FlowingGradientBackground />

      {/* Top Persistent Navigation with single global Create & Schedule action */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onOpenCreatePost={() => setCurrentTab('create')}
        userEmail={userEmail}
      />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center space-x-2 px-4 py-3 rounded-xl bg-[#F4F1EB] border border-[#DDD7CD] text-[#0F172A] shadow-lg animate-in fade-in slide-in-from-bottom-3 duration-200">
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#1F6D52]" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-700" />
          )}
          <span className="text-xs font-semibold">{toastMessage.text}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* SCREEN 1: DASHBOARD (Overview Screen) */}
        {currentTab === 'dashboard' && stats && (
          <div className="space-y-8 animate-in fade-in duration-150">
            {/* Dashboard Overview Heading - Clean, with single refresh action (no duplicate create button) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DDD7CD]">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight">
                  Social Media Publishing Dashboard
                </h1>
                <p className="text-sm text-[#0F172A]/70 mt-1">
                  Track confirmed published posts against monthly goals and monitor platform publishing progress.
                </p>
              </div>

              {/* Dashboard Actions */}
              <div className="flex items-center space-x-2.5 self-start sm:self-auto">
                <button
                  onClick={() => setCurrentTab('create')}
                  className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-[#1F6D52] hover:bg-[#185741] text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
                  title="Create new post & schedule publication"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Create &amp; Schedule Post</span>
                </button>

                {/* Simple Data Refresh control */}
                <button
                  onClick={() => loadData(true)}
                  disabled={refreshing}
                  className="p-2.5 rounded-xl bg-[#F4F1EB] hover:bg-[#F8F6F1] border border-[#DDD7CD] text-[#0F172A] transition shadow-2xs cursor-pointer"
                  title="Refresh Stored Data"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#1F6D52]' : ''}`} />
                </button>
              </div>
            </div>

            {/* Monthly Target & Progress Card */}
            <MonthlyTargetCard
              target={stats.target}
              targetCount={stats.targetCount}
              confirmedPublishedCount={stats.confirmedPublishedCount}
              remainingPostsNeeded={stats.remainingPostsNeeded}
              progressPercentage={stats.progressPercentage}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onSelectDate={(month, year) => {
                setSelectedMonth(month);
                setSelectedYear(year);
              }}
              onSaveTarget={handleSaveTarget}
              onDeleteTarget={handleDeleteTarget}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* SCREEN 2: VIDEO ASSET LIBRARY */}
        {currentTab === 'videos' && (
          <div className="animate-in fade-in duration-150">
            <VideoLibrary
              videos={videos}
              onUploadVideos={handleUploadVideos}
              onDeleteVideo={handleDeleteVideo}
              onUpdateVideo={handleUpdateVideo}
              onReplaceVideo={handleReplaceVideo}
              onSelectVideoForPost={handleSelectVideoForPost}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* SCREEN 3: PUBLISHING CALENDAR */}
        {currentTab === 'calendar' && (
          <div className="animate-in fade-in duration-150">
            <PublishingCalendar
              posts={posts}
              onCancelPost={handleCancelPost}
              onReschedulePost={handleReschedulePost}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* SCREEN 4: PUBLISHING HISTORY */}
        {currentTab === 'history' && (
          <div className="animate-in fade-in duration-150">
            <PublishingHistory
              posts={posts}
              activities={activities}
              videos={videos}
              onDeletePost={handleDeletePost}
              onRetryPlatformPublish={handleRetryPlatform}
              isLoading={isLoading}
              loadError={loadError}
              onRefresh={() => loadData()}
            />
          </div>
        )}

        {/* SCREEN 5: SETTINGS */}
        {currentTab === 'settings' && (
          <div className="animate-in fade-in duration-150">
            <SettingsView
              userEmail={userEmail}
              videoCount={videos.length}
              postCount={posts.length}
            />
          </div>
        )}

        {/* POST CREATION & SCHEDULING WORKFLOW */}
        {currentTab === 'create' && platforms && (
          <div className="animate-in fade-in duration-150">
            <PostCreator
              videos={videos}
              platforms={platforms}
              preselectedVideo={preselectedVideoForPost}
              onPostCreated={handlePostCreated}
              onNavigateToUpload={() => setCurrentTab('videos')}
            />
          </div>
        )}
      </main>

      {/* Account Footer Band */}
      <footer className="border-t border-[#DDD7CD] bg-[#F4F1EB] text-[#0F172A]/70 py-4 mt-12 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-[#0F172A] tracking-tight">SocialFlow</span>
            <span className="text-[#DDD7CD]">—</span>
            <span>Multi-platform Social Publishing Engine</span>
          </div>
          <div className="flex items-center space-x-2 font-mono text-[11px] bg-[#F8F6F1] px-3 py-1 rounded-lg text-[#0F172A] border border-[#DDD7CD]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#1F6D52]" />
            <span>Persistent Backend Daemon Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
