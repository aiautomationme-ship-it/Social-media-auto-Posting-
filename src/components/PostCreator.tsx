import React, { useState, useEffect } from 'react';
import {
  Send,
  Calendar,
  Clock,
  Film,
  AlertCircle,
  CheckCircle2,
  Eye,
  Info,
  RefreshCw,
  X,
  Play,
  HardDrive,
  Check,
  Globe,
  Sliders,
  Layers,
  Zap,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import type {
  VideoRecord,
  PlatformType,
  PlatformConnection,
  TikTokSettings,
} from '../types/index.ts';
import { api } from '../services/api.ts';

interface PostCreatorProps {
  videos: VideoRecord[];
  platforms: Record<PlatformType, PlatformConnection>;
  preselectedVideo?: VideoRecord | null;
  onPostCreated: (post: any) => void;
  onNavigateToUpload: () => void;
}

export const PostCreator: React.FC<PostCreatorProps> = ({
  videos,
  platforms: _platforms,
  preselectedVideo,
  onPostCreated,
  onNavigateToUpload,
}) => {
  // Video selection state - single authoritative source
  const [selectedVideoId, setSelectedVideoId] = useState<string>(
    preselectedVideo ? preselectedVideo.id : videos[0]?.id || ''
  );
  const [showVideoPickerModal, setShowVideoPickerModal] = useState<boolean>(false);
  const [videoSearchQuery, setVideoSearchQuery] = useState<string>('');

  // Keep selected video in sync when preselectedVideo changes (e.g. from Video Library "Use in Post")
  useEffect(() => {
    if (preselectedVideo) {
      setSelectedVideoId(preselectedVideo.id);
    } else if (!selectedVideoId && videos.length > 0) {
      setSelectedVideoId(videos[0].id);
    }
  }, [preselectedVideo, videos]);

  const selectedVideo = videos.find((v) => v.id === selectedVideoId);

  // Campaign / Internal Title
  const [postTitle, setPostTitle] = useState<string>('');

  // Explicit Platform Selection: Start with NO platform selected by default
  const [enabledPlatforms, setEnabledPlatforms] = useState<Record<PlatformType, boolean>>({
    tiktok: false,
    instagram: false,
    facebook: false,
  });

  // Scheduling and Timezone
  const userTimezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi';

  // Real-time Live Clock State (updates every second)
  const getLiveRealTime = () => {
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return {
      day: dayNames[now.getDay()],
      date: now.getDate(),
      month: monthNames[now.getMonth()],
      year: now.getFullYear(),
      time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
      isoString: now.toISOString(),
      formatted: `${dayNames[now.getDay()]}, ${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()} • ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`,
    };
  };

  const [realTime, setRealTime] = useState(getLiveRealTime());

  useEffect(() => {
    const timer = setInterval(() => {
      setRealTime(getLiveRealTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getDefaultScheduledTime = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    const pad = (n: number) => (n < 10 ? `0${n}` : n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  };

  const getMinScheduledTime = () => {
    const now = new Date(Date.now() + 60 * 1000);
    const pad = (n: number) => (n < 10 ? `0${n}` : n);
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
      now.getHours()
    )}:${pad(now.getMinutes())}`;
  };

  const [publishMode, setPublishMode] = useState<'immediate' | 'scheduled'>('scheduled');
  const [defaultScheduleTime, setDefaultScheduleTime] = useState<string>(getDefaultScheduledTime());
  const [useCustomPlatformTimes, setUseCustomPlatformTimes] = useState<boolean>(false);

  // Dynamic Real-time Shortcut Helper
  const applyScheduleShortcut = (type: '15m' | '1h' | 'tonight' | 'tomorrow_morning' | 'tomorrow_evening') => {
    const d = new Date();
    if (type === '15m') {
      d.setMinutes(d.getMinutes() + 15);
    } else if (type === '1h') {
      d.setHours(d.getHours() + 1);
    } else if (type === 'tonight') {
      d.setHours(20, 0, 0, 0);
      if (d.getTime() <= Date.now()) {
        d.setDate(d.getDate() + 1);
      }
    } else if (type === 'tomorrow_morning') {
      d.setDate(d.getDate() + 1);
      d.setHours(10, 0, 0, 0);
    } else if (type === 'tomorrow_evening') {
      d.setDate(d.getDate() + 1);
      d.setHours(18, 0, 0, 0);
    }
    const pad = (n: number) => (n < 10 ? `0${n}` : n);
    const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setDefaultScheduleTime(formatted);
    setPublishMode('scheduled');
  };

  // Webhook Configuration & Testing inside PostCreator
  const [webhookConfig, setWebhookConfig] = useState<{
    url: string;
    isConfigured: boolean;
    isTestUrl: boolean;
    source: string;
  }>({
    url: '',
    isConfigured: false,
    isTestUrl: false,
    source: 'none',
  });
  const [isEditingWebhook, setIsEditingWebhook] = useState<boolean>(false);
  const [webhookInputUrl, setWebhookInputUrl] = useState<string>('');
  const [isSavingWebhook, setIsSavingWebhook] = useState<boolean>(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState<boolean>(false);
  const [webhookTestFeedback, setWebhookTestFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Fetch active webhook configuration on mount
  useEffect(() => {
    api.getWebhookConfig().then((cfg) => {
      setWebhookConfig(cfg);
      setWebhookInputUrl(cfg.url || '');
    }).catch((err) => console.error('Failed to load webhook config:', err));
  }, []);

  const handleSaveInlineWebhook = async () => {
    if (!webhookInputUrl.trim()) {
      setWebhookTestFeedback({ type: 'error', text: 'Webhook URL cannot be empty.' });
      return;
    }
    setIsSavingWebhook(true);
    setWebhookTestFeedback(null);
    try {
      const res = await api.updateWebhookConfig(webhookInputUrl.trim());
      setWebhookConfig({
        url: res.url,
        isConfigured: res.isConfigured,
        isTestUrl: res.isTestUrl,
        source: res.source,
      });
      setIsEditingWebhook(false);
      setWebhookTestFeedback({
        type: 'success',
        text: `Webhook configured! (${res.isTestUrl ? 'n8n Test Mode' : 'Production Mode'})`,
      });
      setTimeout(() => setWebhookTestFeedback(null), 4000);
    } catch (err: any) {
      setWebhookTestFeedback({
        type: 'error',
        text: err?.message || 'Failed to update webhook URL.',
      });
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const handleTestInlineWebhook = async () => {
    const targetUrl = isEditingWebhook ? webhookInputUrl.trim() : webhookConfig.url;
    if (!targetUrl) {
      setWebhookTestFeedback({ type: 'error', text: 'Please enter a webhook URL first.' });
      return;
    }
    setIsTestingWebhook(true);
    setWebhookTestFeedback(null);
    try {
      const res = await api.sendTestWebhook(targetUrl);
      if (res.success) {
        setWebhookTestFeedback({
          type: 'success',
          text: `HTTP ${res.httpStatus || 200} OK: Delivered to n8n Webhook in ${res.durationMs}ms!`,
        });
      } else {
        setWebhookTestFeedback({
          type: 'error',
          text: res.errorMessage || `Failed with HTTP ${res.httpStatus}`,
        });
      }
    } catch (err: any) {
      setWebhookTestFeedback({
        type: 'error',
        text: err?.message || 'Network error reaching webhook.',
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  // Independent Text fields per platform
  const [activeTextTab, setActiveTextTab] = useState<PlatformType>('instagram');
  const [instagramCaption, setInstagramCaption] = useState<string>('');
  const [facebookDescription, setFacebookDescription] = useState<string>('');
  const [tiktokTitle, setTiktokTitle] = useState<string>('');

  // Independent custom schedule overrides
  const [tiktokScheduleTime, setTiktokScheduleTime] = useState<string>(getDefaultScheduledTime());
  const [instagramScheduleTime, setInstagramScheduleTime] = useState<string>(
    getDefaultScheduledTime()
  );
  const [facebookScheduleTime, setFacebookScheduleTime] = useState<string>(
    getDefaultScheduledTime()
  );

  // TikTok Specific Controls
  const [tiktokSettings, setTiktokSettings] = useState<TikTokSettings>({
    privacyLevel: 'PUBLIC_TO_EVERYONE',
    allowComment: true,
    allowDuet: true,
    allowStitch: true,
    brandDisclosure: false,
    brandOrganic: false,
  });

  // UI States
  const [previewPlatform, setPreviewPlatform] = useState<PlatformType>('instagram');
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Publish Failure Details Modal
  const [publishErrorModal, setPublishErrorModal] = useState<{
    title: string;
    message: string;
    httpStatus?: number;
    responseExcerpt?: string;
  } | null>(null);

  // Selected platforms list
  const selectedPlatformsList = (['instagram', 'facebook', 'tiktok'] as PlatformType[]).filter(
    (p) => enabledPlatforms[p]
  );

  // Synchronize active tabs when selected platforms change
  useEffect(() => {
    if (selectedPlatformsList.length > 0 && !enabledPlatforms[activeTextTab]) {
      setActiveTextTab(selectedPlatformsList[0]);
    }
  }, [enabledPlatforms, activeTextTab, selectedPlatformsList]);

  useEffect(() => {
    if (selectedPlatformsList.length > 0 && !enabledPlatforms[previewPlatform]) {
      setPreviewPlatform(selectedPlatformsList[0]);
    }
  }, [enabledPlatforms, previewPlatform, selectedPlatformsList]);

  const handleTogglePlatform = (plat: PlatformType) => {
    setEnabledPlatforms((prev) => {
      const nextVal = !prev[plat];
      const updated = { ...prev, [plat]: nextVal };
      if (nextVal && (!prev[activeTextTab] || activeTextTab !== plat)) {
        setActiveTextTab(plat);
      }
      return updated;
    });
    setValidationError(null);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || isNaN(seconds)) return null;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const validateForm = (): boolean => {
    if (!selectedVideoId || !selectedVideo) {
      setValidationError('Please select a video from your library.');
      return false;
    }
    const anyEnabled = Object.values(enabledPlatforms).some(Boolean);
    if (!anyEnabled) {
      setValidationError('Please select at least one destination platform (Instagram Reels, Facebook Page, or TikTok).');
      return false;
    }

    if (publishMode === 'immediate') {
      if (!webhookConfig.isConfigured || !webhookConfig.url.trim()) {
        setValidationError('⚠️ Webhook URL is not configured. Please enter your n8n Webhook URL in Step 4 before publishing immediately.');
        return false;
      }
    }

    if (publishMode === 'scheduled') {
      const now = Date.now();
      const defaultTimeMs = new Date(defaultScheduleTime).getTime();
      if (isNaN(defaultTimeMs) || defaultTimeMs <= now) {
        setValidationError('Scheduled publication time must be in the future.');
        return false;
      }

      if (useCustomPlatformTimes) {
        if (enabledPlatforms.tiktok) {
          const tTime = new Date(tiktokScheduleTime).getTime();
          if (isNaN(tTime) || tTime <= now) {
            setValidationError('TikTok scheduled time must be in the future.');
            return false;
          }
        }
        if (enabledPlatforms.instagram) {
          const iTime = new Date(instagramScheduleTime).getTime();
          if (isNaN(iTime) || iTime <= now) {
            setValidationError('Instagram Reels scheduled time must be in the future.');
            return false;
          }
        }
        if (enabledPlatforms.facebook) {
          const fTime = new Date(facebookScheduleTime).getTime();
          if (isNaN(fTime) || fTime <= now) {
            setValidationError('Facebook Page scheduled time must be in the future.');
            return false;
          }
        }
      }
    }

    if (enabledPlatforms.instagram && instagramCaption.length > 2200) {
      setValidationError('Instagram Reels caption exceeds the 2,200 character limit.');
      return false;
    }
    if (enabledPlatforms.tiktok && tiktokTitle.length > 2200) {
      setValidationError('TikTok caption exceeds the 2,200 character limit.');
      return false;
    }
    if (enabledPlatforms.facebook && facebookDescription.length > 5000) {
      setValidationError('Facebook Page description exceeds the 5,000 character limit.');
      return false;
    }

    setValidationError(null);
    return true;
  };

  const handleSubmitAttempt = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setShowConfirmModal(true);
    }
  };

  const handleExecuteCreation = async () => {
    try {
      setIsSubmitting(true);
      setValidationError(null);

      const platformsConfig: Record<string, any> = {};

      if (enabledPlatforms.tiktok) {
        platformsConfig.tiktok = {
          enabled: true,
          caption: tiktokTitle,
          scheduledAt:
            publishMode === 'scheduled'
              ? useCustomPlatformTimes
                ? new Date(tiktokScheduleTime).toISOString()
                : new Date(defaultScheduleTime).toISOString()
              : null,
          tiktokSettings,
        };
      }

      if (enabledPlatforms.instagram) {
        platformsConfig.instagram = {
          enabled: true,
          caption: instagramCaption,
          scheduledAt:
            publishMode === 'scheduled'
              ? useCustomPlatformTimes
                ? new Date(instagramScheduleTime).toISOString()
                : new Date(defaultScheduleTime).toISOString()
              : null,
        };
      }

      if (enabledPlatforms.facebook) {
        platformsConfig.facebook = {
          enabled: true,
          caption: facebookDescription,
          scheduledAt:
            publishMode === 'scheduled'
              ? useCustomPlatformTimes
                ? new Date(facebookScheduleTime).toISOString()
                : new Date(defaultScheduleTime).toISOString()
              : null,
        };
      }

      const postPayload = {
        videoId: selectedVideoId,
        title: postTitle.trim() || selectedVideo?.originalName || 'Social Video Post',
        defaultScheduledAt:
          publishMode === 'scheduled' ? new Date(defaultScheduleTime).toISOString() : null,
        platforms: platformsConfig,
      };

      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'user_default',
        },
        body: JSON.stringify(postPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create social post');
      }

      const { post } = await response.json();

      if (publishMode === 'immediate') {
        const publishRes = await fetch(`/api/posts/${post.id}/publish-now`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': 'user_default',
          },
          body: JSON.stringify({
            platformsToPublish: (['tiktok', 'instagram', 'facebook'] as PlatformType[]).filter(
              (p) => enabledPlatforms[p]
            ),
          }),
        });

        if (!publishRes.ok) {
          const err = await publishRes.json();
          throw new Error(err.error || 'Failed to publish post immediately');
        }

        const publishedData = await publishRes.json();
        const results = publishedData.results || {};
        const failedEntries = Object.entries(results).filter(
          ([_, r]: [string, any]) => r.status === 'failed'
        );

        if (failedEntries.length > 0) {
          const [failPlat, failInfo]: [string, any] = failedEntries[0];
          setShowConfirmModal(false);
          setPublishErrorModal({
            title: `Publishing to ${failPlat.toUpperCase()} Failed`,
            message: failInfo.errorMessage || 'n8n Webhook rejected the request or could not be contacted.',
            httpStatus: failInfo.httpStatus,
            responseExcerpt: failInfo.responseExcerpt,
          });
          return;
        }

        setShowConfirmModal(false);
        onPostCreated(publishedData.post);
      } else {
        setShowConfirmModal(false);
        onPostCreated(post);
      }
    } catch (err: any) {
      setValidationError(err?.message || 'Error processing post publishing workflow');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPickerVideos = videos.filter((v) =>
    v.originalName.toLowerCase().includes(videoSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#DDD7CD]">
        <div className="flex items-center space-x-2.5">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight">
            Create &amp; Schedule Post
          </h1>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
            Multi-Destination
          </span>
        </div>
        <p className="text-sm text-[#0F172A]/70 mt-1">
          Choose a library video, select target platforms, customize captions, preview, and publish immediately or schedule.
        </p>
      </div>

      {validationError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-700" />
          <span>{validationError}</span>
        </div>
      )}

      <form onSubmit={handleSubmitAttempt} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Post Form & Platform Fields (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* STEP 1: ONE Coherent Selected Video Component */}
          <div className="bg-[#F4F1EB] border border-[#DDD7CD] rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <Film className="w-4 h-4 text-[#1F6D52]" />
                <span>1. Selected Video</span>
              </label>
              {videos.length > 0 && (
                <button
                  type="button"
                  onClick={onNavigateToUpload}
                  className="text-xs text-[#1F6D52] hover:text-[#185741] font-semibold cursor-pointer"
                >
                  Go to Video Library
                </button>
              )}
            </div>

            {videos.length === 0 ? (
              <div className="p-6 bg-[#F8F6F1] border border-[#DDD7CD] rounded-xl text-center space-y-3">
                <Film className="w-8 h-8 text-[#0F172A]/40 mx-auto" />
                <p className="text-xs text-[#0F172A]/70 max-w-sm mx-auto">
                  No video assets are currently stored in your library. Upload videos in the Video Library before creating a post.
                </p>
                <button
                  type="button"
                  onClick={onNavigateToUpload}
                  className="px-4 py-2 bg-[#1F6D52] hover:bg-[#185741] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center space-x-1.5"
                >
                  <span>Open Video Library</span>
                </button>
              </div>
            ) : selectedVideo ? (
              /* Single coherent Selected Video component: thumbnail, filename, size, duration, status, and Change Video action */
              <div className="bg-[#F8F6F1] border border-[#DDD7CD] rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3.5 min-w-0 w-full sm:w-auto">
                  {/* Video Thumbnail Preview */}
                  <div className="relative w-24 h-16 sm:w-28 sm:h-20 bg-slate-950 rounded-lg overflow-hidden shrink-0 border border-[#DDD7CD] flex items-center justify-center">
                    {selectedVideo.thumbnailUrl ? (
                      <img
                        src={selectedVideo.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <video
                        src={selectedVideo.fileUrl}
                        className="w-full h-full object-cover"
                        preload="none"
                      />
                    )}
                    {formatDuration(selectedVideo.duration) && (
                      <span className="absolute bottom-1 right-1 text-[9px] font-mono font-bold bg-black/85 text-white px-1.5 py-0.5 rounded">
                        {formatDuration(selectedVideo.duration)}
                      </span>
                    )}
                  </div>

                  {/* Metadata info */}
                  <div className="min-w-0 flex-1">
                    <h4
                      className="font-bold text-xs sm:text-sm text-[#0F172A] truncate"
                      title={selectedVideo.originalName}
                    >
                      {selectedVideo.originalName}
                    </h4>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#0F172A]/65 mt-1 font-mono">
                      <span>{(selectedVideo.fileSize / (1024 * 1024)).toFixed(1)} MB</span>
                      {selectedVideo.width && selectedVideo.height && (
                        <>
                          <span>•</span>
                          <span>
                            {selectedVideo.width}×{selectedVideo.height}
                          </span>
                        </>
                      )}
                      <span>•</span>
                      <span>
                        {new Date(selectedVideo.uploadedAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-[#1F6D52]" />
                        <span>Ready to Publish</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Single Change Video Action */}
                <button
                  type="button"
                  onClick={() => setShowVideoPickerModal(true)}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-[#F4F1EB] hover:bg-white text-xs font-bold text-[#0F172A] border border-[#DDD7CD] transition shadow-2xs cursor-pointer flex items-center justify-center space-x-1.5 shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#1F6D52]" />
                  <span>Change Video</span>
                </button>
              </div>
            ) : null}
          </div>



          {/* STEP 2: Explicit Platform Selection (No automatic pre-selection) */}
          <div className="bg-[#F4F1EB] border border-[#DDD7CD] rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-sm font-bold text-[#0F172A]">2. Destination Platforms</h3>
              <span className="text-[11px] font-mono text-[#0F172A]/60">
                {selectedPlatformsList.length} of 3 selected
              </span>
            </div>
            <p className="text-xs text-[#0F172A]/70 mb-3.5">
              Select at least one destination platform. Each platform operates independently.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Instagram Reels */}
              <div
                onClick={() => handleTogglePlatform('instagram')}
                className={`p-3.5 rounded-xl border cursor-pointer transition shadow-2xs flex flex-col justify-between ${
                  enabledPlatforms.instagram
                    ? 'bg-[#F8F6F1] border-[#1F6D52] ring-1 ring-[#1F6D52]/40 text-[#0F172A]'
                    : 'bg-[#F8F6F1]/50 border-[#DDD7CD] text-[#0F172A]/70 hover:bg-[#F8F6F1] hover:border-[#BD7131]/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-[#0F172A]">Instagram Reels</span>
                    <input
                      type="checkbox"
                      checked={enabledPlatforms.instagram}
                      onChange={() => handleTogglePlatform('instagram')}
                      className="rounded text-[#1F6D52] cursor-pointer"
                    />
                  </div>
                  <p className="text-[11px] text-[#0F172A]/60">
                    Vertical short video (up to 90s)
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-[#DDD7CD]/70 flex items-center justify-between text-[10px]">
                  <span className={enabledPlatforms.instagram ? 'text-emerald-800 font-bold' : 'text-[#0F172A]/50'}>
                    {enabledPlatforms.instagram ? 'Selected' : 'Click to select'}
                  </span>
                  <span className="text-[10px] text-[#0F172A]/50 font-mono">Reels</span>
                </div>
              </div>

              {/* Facebook Page */}
              <div
                onClick={() => handleTogglePlatform('facebook')}
                className={`p-3.5 rounded-xl border cursor-pointer transition shadow-2xs flex flex-col justify-between ${
                  enabledPlatforms.facebook
                    ? 'bg-[#F8F6F1] border-[#1F6D52] ring-1 ring-[#1F6D52]/40 text-[#0F172A]'
                    : 'bg-[#F8F6F1]/50 border-[#DDD7CD] text-[#0F172A]/70 hover:bg-[#F8F6F1] hover:border-[#BD7131]/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-[#0F172A]">Facebook Page</span>
                    <input
                      type="checkbox"
                      checked={enabledPlatforms.facebook}
                      onChange={() => handleTogglePlatform('facebook')}
                      className="rounded text-[#1F6D52] cursor-pointer"
                    />
                  </div>
                  <p className="text-[11px] text-[#0F172A]/60">
                    Page video post &amp; Watch feed
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-[#DDD7CD]/70 flex items-center justify-between text-[10px]">
                  <span className={enabledPlatforms.facebook ? 'text-emerald-800 font-bold' : 'text-[#0F172A]/50'}>
                    {enabledPlatforms.facebook ? 'Selected' : 'Click to select'}
                  </span>
                  <span className="text-[10px] text-[#0F172A]/50 font-mono">Page</span>
                </div>
              </div>

              {/* TikTok */}
              <div
                onClick={() => handleTogglePlatform('tiktok')}
                className={`p-3.5 rounded-xl border cursor-pointer transition shadow-2xs flex flex-col justify-between ${
                  enabledPlatforms.tiktok
                    ? 'bg-[#F8F6F1] border-[#1F6D52] ring-1 ring-[#1F6D52]/40 text-[#0F172A]'
                    : 'bg-[#F8F6F1]/50 border-[#DDD7CD] text-[#0F172A]/70 hover:bg-[#F8F6F1] hover:border-[#BD7131]/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-[#0F172A]">TikTok</span>
                    <input
                      type="checkbox"
                      checked={enabledPlatforms.tiktok}
                      onChange={() => handleTogglePlatform('tiktok')}
                      className="rounded text-[#1F6D52] cursor-pointer"
                    />
                  </div>
                  <p className="text-[11px] text-[#0F172A]/60">
                    Short-form video for FYP feed
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-[#DDD7CD]/70 flex items-center justify-between text-[10px]">
                  <span className={enabledPlatforms.tiktok ? 'text-emerald-800 font-bold' : 'text-[#0F172A]/50'}>
                    {enabledPlatforms.tiktok ? 'Selected' : 'Click to select'}
                  </span>
                  <span className="text-[10px] text-[#0F172A]/50 font-mono">FYP</span>
                </div>
              </div>
            </div>

            {selectedPlatformsList.length === 0 && (
              <div className="mt-3 p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-center space-x-2">
                <Info className="w-4 h-4 text-amber-700 shrink-0" />
                <span>No destination selected. Please select at least one platform above to continue.</span>
              </div>
            )}
          </div>

          {/* STEP 3: Platform-Specific Publishing Details (Only shown for selected platforms) */}
          <div className="bg-[#F4F1EB] border border-[#DDD7CD] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0F172A]">
                3. Platform-Specific Captions &amp; Controls
              </h3>
            </div>

            {selectedPlatformsList.length === 0 ? (
              <div className="p-6 bg-[#F8F6F1] border border-[#DDD7CD] rounded-xl text-center space-y-2">
                <Sliders className="w-6 h-6 text-[#0F172A]/40 mx-auto" />
                <p className="text-xs font-semibold text-[#0F172A]">No Platforms Selected</p>
                <p className="text-xs text-[#0F172A]/65 max-w-sm mx-auto">
                  Select one or more destination platforms in step 2 to configure captions, hashtags, and interaction settings.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Platform Sub-tabs showing ONLY selected platforms */}
                <div className="flex space-x-2 border-b border-[#DDD7CD] pb-2 overflow-x-auto">
                  {selectedPlatformsList.map((plat) => {
                    const isActive = activeTextTab === plat;
                    const label =
                      plat === 'instagram'
                        ? 'Instagram Reels'
                        : plat === 'facebook'
                        ? 'Facebook Page'
                        : 'TikTok';

                    return (
                      <button
                        key={plat}
                        type="button"
                        onClick={() => setActiveTextTab(plat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                          isActive
                            ? 'bg-[#1F6D52] text-white shadow-2xs'
                            : 'bg-[#F8F6F1] text-[#0F172A] hover:bg-white border border-[#DDD7CD]'
                        }`}
                      >
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Tab: Instagram Reels */}
                {activeTextTab === 'instagram' && enabledPlatforms.instagram && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-[#0F172A]/70">
                      <label className="font-bold text-[#0F172A]">
                        Instagram Reels Caption &amp; Hashtags
                      </label>
                      <span className={`font-mono text-[11px] ${instagramCaption.length > 2200 ? 'text-rose-700 font-bold' : ''}`}>
                        {instagramCaption.length}/2200
                      </span>
                    </div>
                    <textarea
                      rows={4}
                      value={instagramCaption}
                      onChange={(e) => setInstagramCaption(e.target.value)}
                      placeholder="Write an engaging Instagram Reel caption, call to action, and hashtags (#reels #trending)..."
                      className="w-full bg-[#F8F6F1] border border-[#DDD7CD] rounded-xl p-3 text-xs text-[#0F172A] focus:outline-none focus:border-[#1F6D52] shadow-2xs"
                    />
                    <p className="text-[11px] text-[#0F172A]/60">
                      Supports up to 2,200 characters and 30 hashtags. Recommended format is 9:16 vertical video.
                    </p>
                  </div>
                )}

                {/* Tab: Facebook Page */}
                {activeTextTab === 'facebook' && enabledPlatforms.facebook && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-[#0F172A]/70">
                      <label className="font-bold text-[#0F172A]">
                        Facebook Page Video Description
                      </label>
                      <span className={`font-mono text-[11px] ${facebookDescription.length > 5000 ? 'text-rose-700 font-bold' : ''}`}>
                        {facebookDescription.length}/5000
                      </span>
                    </div>
                    <textarea
                      rows={4}
                      value={facebookDescription}
                      onChange={(e) => setFacebookDescription(e.target.value)}
                      placeholder="Detailed video description and commentary for your Facebook Page followers..."
                      className="w-full bg-[#F8F6F1] border border-[#DDD7CD] rounded-xl p-3 text-xs text-[#0F172A] focus:outline-none focus:border-[#1F6D52] shadow-2xs"
                    />
                    <p className="text-[11px] text-[#0F172A]/60">
                      This text appears as the post description on your Facebook Page feed and Watch.
                    </p>
                  </div>
                )}

                {/* Tab: TikTok */}
                {activeTextTab === 'tiktok' && enabledPlatforms.tiktok && (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-xs text-[#0F172A]/70 mb-1.5">
                        <label className="font-bold text-[#0F172A]">TikTok Caption &amp; Title</label>
                        <span className={`font-mono text-[11px] ${tiktokTitle.length > 2200 ? 'text-rose-700 font-bold' : ''}`}>
                          {tiktokTitle.length}/2200
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        value={tiktokTitle}
                        onChange={(e) => setTiktokTitle(e.target.value)}
                        placeholder="Engaging TikTok hook, audio description, and hashtags (#fyp #viral)..."
                        className="w-full bg-[#F8F6F1] border border-[#DDD7CD] rounded-xl p-3 text-xs text-[#0F172A] focus:outline-none focus:border-[#1F6D52] shadow-2xs"
                      />
                    </div>

                    {/* TikTok Specific Controls */}
                    <div className="bg-[#F8F6F1] p-3.5 rounded-xl border border-[#DDD7CD] space-y-3 text-xs shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="font-bold text-[#0F172A]">Audience Privacy</span>
                        <select
                          value={tiktokSettings.privacyLevel}
                          onChange={(e) =>
                            setTiktokSettings((prev) => ({
                              ...prev,
                              privacyLevel: e.target.value as any,
                            }))
                          }
                          className="bg-[#F4F1EB] border border-[#DDD7CD] rounded-lg px-2.5 py-1 text-xs text-[#0F172A] font-semibold"
                        >
                          <option value="PUBLIC_TO_EVERYONE">Public to Everyone</option>
                          <option value="MUTUAL_FOLLOW_FRIENDS">Friends Only</option>
                          <option value="SELF_ONLY">Private (Self Only)</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#DDD7CD]">
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={tiktokSettings.allowComment}
                            onChange={(e) =>
                              setTiktokSettings((p) => ({ ...p, allowComment: e.target.checked }))
                            }
                            className="rounded text-[#1F6D52] cursor-pointer"
                          />
                          <span>Comments</span>
                        </label>
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={tiktokSettings.allowDuet}
                            onChange={(e) =>
                              setTiktokSettings((p) => ({ ...p, allowDuet: e.target.checked }))
                            }
                            className="rounded text-[#1F6D52] cursor-pointer"
                          />
                          <span>Duet</span>
                        </label>
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={tiktokSettings.allowStitch}
                            onChange={(e) =>
                              setTiktokSettings((p) => ({ ...p, allowStitch: e.target.checked }))
                            }
                            className="rounded text-[#1F6D52] cursor-pointer"
                          />
                          <span>Stitch</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STEP 4: Publishing and Scheduling Controls */}
          <div className="bg-[#F4F1EB] border border-[#DDD7CD] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#DDD7CD]">
              <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <span>4. Publishing &amp; Scheduling Controls</span>
              </h3>
              <div className="flex items-center space-x-1.5 text-[11px] font-mono text-[#0F172A]/80 bg-[#F8F6F1] px-2.5 py-1 rounded-lg border border-[#DDD7CD]">
                <Clock className="w-3.5 h-3.5 text-[#1F6D52]" />
                <span className="font-semibold">{realTime.formatted}</span>
              </div>
            </div>

            {/* Mode Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPublishMode('scheduled')}
                className={`p-3.5 rounded-xl border text-left transition shadow-2xs cursor-pointer ${
                  publishMode === 'scheduled'
                    ? 'bg-[#F8F6F1] border-[#1F6D52] ring-1 ring-[#1F6D52]/40 text-[#0F172A]'
                    : 'bg-[#F8F6F1]/50 border-[#DDD7CD] text-[#0F172A]/70 hover:bg-[#F8F6F1]'
                }`}
              >
                <div className="flex items-center space-x-2 font-bold text-xs mb-1">
                  <Calendar className="w-4 h-4 text-[#1F6D52]" />
                  <span>Schedule for Future Date/Time</span>
                </div>
                <p className="text-[11px] text-[#0F172A]/60">
                  Automated background publishing via daemon at your appointed real-time slot.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPublishMode('immediate')}
                className={`p-3.5 rounded-xl border text-left transition shadow-2xs cursor-pointer ${
                  publishMode === 'immediate'
                    ? 'bg-[#F8F6F1] border-[#1F6D52] ring-1 ring-[#1F6D52]/40 text-[#0F172A]'
                    : 'bg-[#F8F6F1]/50 border-[#DDD7CD] text-[#0F172A]/70 hover:bg-[#F8F6F1]'
                }`}
              >
                <div className="flex items-center space-x-2 font-bold text-xs mb-1">
                  <Send className="w-4 h-4 text-[#1F6D52]" />
                  <span>Publish Immediately (Publish Now)</span>
                </div>
                <p className="text-[11px] text-[#0F172A]/60">
                  Instantly dispatches post &amp; video payload directly to your n8n Webhook right now.
                </p>
              </button>
            </div>

            {publishMode === 'immediate' && (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-1 text-emerald-950 font-medium">
                <div className="flex items-center space-x-1.5 font-bold text-[#1F6D52]">
                  <Zap className="w-4 h-4" />
                  <span>Immediate Publishing Ready</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Clicking <strong>&quot;Publish Now&quot;</strong> below will send the video metadata and direct video link to your configured webhook at real-time <strong>{realTime.time}</strong> ({realTime.day}, {realTime.date} {realTime.month} {realTime.year}).
                </p>
              </div>
            )}

            {publishMode === 'scheduled' && (
              <div className="space-y-4 pt-2">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-[#0F172A]">
                      Scheduled Date &amp; Time
                    </label>
                    <span className="text-[11px] text-[#1F6D52] font-mono font-medium">
                      Time Zone: {userTimezone}
                    </span>
                  </div>

                  {/* Dynamic Real-Time Shortcut Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                    <span className="text-[10px] text-[#0F172A]/60 font-semibold mr-1">Quick Presets:</span>
                    <button
                      type="button"
                      onClick={() => applyScheduleShortcut('15m')}
                      className="px-2 py-1 text-[10px] font-semibold bg-[#F8F6F1] hover:bg-[#DDD7CD]/50 border border-[#DDD7CD] rounded-md transition cursor-pointer"
                    >
                      +15 Mins
                    </button>
                    <button
                      type="button"
                      onClick={() => applyScheduleShortcut('1h')}
                      className="px-2 py-1 text-[10px] font-semibold bg-[#F8F6F1] hover:bg-[#DDD7CD]/50 border border-[#DDD7CD] rounded-md transition cursor-pointer"
                    >
                      +1 Hour
                    </button>
                    <button
                      type="button"
                      onClick={() => applyScheduleShortcut('tonight')}
                      className="px-2 py-1 text-[10px] font-semibold bg-[#F8F6F1] hover:bg-[#DDD7CD]/50 border border-[#DDD7CD] rounded-md transition cursor-pointer"
                    >
                      Tonight (8 PM)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyScheduleShortcut('tomorrow_morning')}
                      className="px-2 py-1 text-[10px] font-semibold bg-[#F8F6F1] hover:bg-[#DDD7CD]/50 border border-[#DDD7CD] rounded-md transition cursor-pointer"
                    >
                      Tomorrow (10 AM)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyScheduleShortcut('tomorrow_evening')}
                      className="px-2 py-1 text-[10px] font-semibold bg-[#F8F6F1] hover:bg-[#DDD7CD]/50 border border-[#DDD7CD] rounded-md transition cursor-pointer"
                    >
                      Tomorrow (6 PM)
                    </button>
                  </div>

                  <input
                    type="datetime-local"
                    value={defaultScheduleTime}
                    min={getMinScheduledTime()}
                    onChange={(e) => setDefaultScheduleTime(e.target.value)}
                    className="w-full bg-[#F8F6F1] border border-[#DDD7CD] rounded-xl px-3 py-2 text-[#0F172A] text-xs font-mono font-medium focus:outline-none focus:border-[#1F6D52] shadow-2xs"
                  />
                  <p className="text-[11px] text-[#0F172A]/60 mt-1">
                    Dates and times are calculated using the live system clock in your local timezone ({userTimezone}).
                  </p>
                </div>

                {/* Independent Time Overrides */}
                <div className="pt-2">
                  <label className="flex items-center space-x-2 text-xs text-[#0F172A] cursor-pointer mb-3">
                    <input
                      type="checkbox"
                      checked={useCustomPlatformTimes}
                      onChange={(e) => setUseCustomPlatformTimes(e.target.checked)}
                      className="rounded text-[#1F6D52] cursor-pointer"
                    />
                    <span className="font-medium">Set independent date/time override for each platform</span>
                  </label>

                  {useCustomPlatformTimes && (
                    <div className="space-y-3 bg-[#F8F6F1] p-3.5 rounded-xl border border-[#DDD7CD] shadow-2xs">
                      {enabledPlatforms.instagram && (
                        <div>
                          <label className="block text-[11px] text-pink-800 font-bold mb-1">
                            Instagram Reels Publish Time
                          </label>
                          <input
                            type="datetime-local"
                            value={instagramScheduleTime}
                            min={getMinScheduledTime()}
                            onChange={(e) => setInstagramScheduleTime(e.target.value)}
                            className="w-full bg-[#F4F1EB] border border-[#DDD7CD] rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] font-mono focus:outline-none focus:border-[#1F6D52]"
                          />
                        </div>
                      )}

                      {enabledPlatforms.facebook && (
                        <div>
                          <label className="block text-[11px] text-blue-800 font-bold mb-1">
                            Facebook Page Publish Time
                          </label>
                          <input
                            type="datetime-local"
                            value={facebookScheduleTime}
                            min={getMinScheduledTime()}
                            onChange={(e) => setFacebookScheduleTime(e.target.value)}
                            className="w-full bg-[#F4F1EB] border border-[#DDD7CD] rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] font-mono focus:outline-none focus:border-[#1F6D52]"
                          />
                        </div>
                      )}

                      {enabledPlatforms.tiktok && (
                        <div>
                          <label className="block text-[11px] text-cyan-800 font-bold mb-1">
                            TikTok Publish Time
                          </label>
                          <input
                            type="datetime-local"
                            value={tiktokScheduleTime}
                            min={getMinScheduledTime()}
                            onChange={(e) => setTiktokScheduleTime(e.target.value)}
                            className="w-full bg-[#F4F1EB] border border-[#DDD7CD] rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] font-mono focus:outline-none focus:border-[#1F6D52]"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Clear Primary Action Button: Publish Now or Schedule Post */}
            <button
              type="submit"
              disabled={isSubmitting || selectedPlatformsList.length === 0}
              className="w-full py-3 bg-[#1F6D52] hover:bg-[#185741] text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
            >
              {publishMode === 'immediate' ? (
                <>
                  <Send className="w-4 h-4" />
                  <span>Publish Now</span>
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4" />
                  <span>Schedule Post</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Accurate Draft Preview (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#F4F1EB] border border-[#DDD7CD] rounded-2xl p-5 sticky top-20 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDD7CD]">
              <div className="flex items-center space-x-2">
                <Eye className="w-4 h-4 text-[#1F6D52]" />
                <h3 className="text-sm font-bold text-[#0F172A]">Draft Preview</h3>
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#F8F6F1] text-[#0F172A]/70 border border-[#DDD7CD]">
                Live Draft
              </span>
            </div>

            {/* Platform Selector: Shows ONLY selected platforms */}
            {selectedPlatformsList.length > 0 ? (
              <div className="flex space-x-2 my-3 bg-[#F8F6F1] p-1 rounded-xl border border-[#DDD7CD] overflow-x-auto">
                {selectedPlatformsList.map((plat) => (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => setPreviewPlatform(plat)}
                    className={`flex-1 py-1.5 text-center rounded-lg text-xs font-semibold capitalize transition cursor-pointer min-w-[70px] ${
                      previewPlatform === plat
                        ? 'bg-[#1F6D52] text-white shadow-2xs'
                        : 'text-[#0F172A]/70 hover:text-[#0F172A]'
                    }`}
                  >
                    {plat === 'instagram' ? 'Reels' : plat === 'facebook' ? 'Facebook' : 'TikTok'}
                  </button>
                ))}
              </div>
            ) : (
              <div className="my-3 p-2.5 bg-[#F8F6F1] rounded-xl border border-[#DDD7CD] text-center text-xs text-[#0F172A]/60">
                Select a platform in step 2 to preview platform layout
              </div>
            )}

            {/* Preview Frame */}
            <div className="border border-[#DDD7CD] rounded-xl bg-slate-950 overflow-hidden flex flex-col shadow-inner">
              {/* Preview Bar Header */}
              <div className="p-2.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                <span className="font-semibold text-white">
                  {selectedPlatformsList.length === 0
                    ? 'Video Player'
                    : previewPlatform === 'instagram'
                    ? 'Instagram Reels Viewer'
                    : previewPlatform === 'tiktok'
                    ? 'TikTok FYP Feed'
                    : 'Facebook Page Watch'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {previewPlatform === 'facebook' ? '16:9 / Video' : '9:16 Vertical'}
                </span>
              </div>

              {/* Video Player Display */}
              <div className="relative aspect-[9/16] max-h-[380px] bg-black flex items-center justify-center overflow-hidden">
                {selectedVideo ? (
                  <video
                    key={selectedVideo.id}
                    src={selectedVideo.fileUrl}
                    controls
                    preload="metadata"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-6 text-slate-500 text-xs space-y-2">
                    <Film className="w-8 h-8 mx-auto opacity-50" />
                    <p>No video selected.</p>
                    <button
                      type="button"
                      onClick={onNavigateToUpload}
                      className="text-[#1F6D52] hover:underline font-semibold"
                    >
                      Open Video Library
                    </button>
                  </div>
                )}

                {/* Overlaid real-time caption (NO fake likes or fake comments) */}
                {selectedPlatformsList.length > 0 && (
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-4 text-white text-left pointer-events-none">
                    <div className="flex items-center space-x-1.5 text-xs font-bold mb-1 text-white">
                      <span>@socialflow</span>
                      {previewPlatform === 'tiktok' && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 bg-white/20 rounded font-normal text-slate-200">
                          {tiktokSettings.privacyLevel === 'PUBLIC_TO_EVERYONE'
                            ? 'Public'
                            : tiktokSettings.privacyLevel === 'MUTUAL_FOLLOW_FRIENDS'
                            ? 'Friends'
                            : 'Private'}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-200 line-clamp-3">
                      {previewPlatform === 'instagram'
                        ? instagramCaption || '(No caption entered yet)'
                        : previewPlatform === 'facebook'
                        ? facebookDescription || '(No description entered yet)'
                        : tiktokTitle || '(No title/caption entered yet)'}
                    </p>

                    {previewPlatform === 'tiktok' && (
                      <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-1 font-mono">
                        <span>Comments: {tiktokSettings.allowComment ? 'On' : 'Off'}</span>
                        <span>•</span>
                        <span>Duet: {tiktokSettings.allowDuet ? 'On' : 'Off'}</span>
                        <span>•</span>
                        <span>Stitch: {tiktokSettings.allowStitch ? 'On' : 'Off'}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <p className="text-[11px] text-[#0F172A]/60 mt-3 text-center">
              Accurate live draft preview reflecting selected video and real-time caption.
            </p>
          </div>
        </div>
      </form>

      {/* Video Picker Modal (Opened from Change Video action) */}
      {showVideoPickerModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-[#F8F6F1] border border-[#DDD7CD] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDD7CD]">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">Select Source Video</h3>
                <p className="text-xs text-[#0F172A]/70">
                  Choose a video from your stored library to use for this post.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowVideoPickerModal(false)}
                className="p-1 rounded-lg hover:bg-[#F4F1EB] text-[#0F172A]/70 hover:text-[#0F172A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video search input */}
            {videos.length > 3 && (
              <input
                type="text"
                value={videoSearchQuery}
                onChange={(e) => setVideoSearchQuery(e.target.value)}
                placeholder="Search videos by name..."
                className="w-full bg-[#F4F1EB] border border-[#DDD7CD] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:border-[#1F6D52]"
              />
            )}

            {/* Video List */}
            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
              {filteredPickerVideos.length === 0 ? (
                <div className="text-center py-6 text-xs text-[#0F172A]/60">
                  No matching videos found in your library.
                </div>
              ) : (
                filteredPickerVideos.map((vid) => {
                  const isSelected = vid.id === selectedVideoId;
                  return (
                    <div
                      key={vid.id}
                      onClick={() => {
                        setSelectedVideoId(vid.id);
                        setShowVideoPickerModal(false);
                      }}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition ${
                        isSelected
                          ? 'bg-[#F4F1EB] border-[#1F6D52] ring-1 ring-[#1F6D52]/40'
                          : 'bg-[#F4F1EB]/50 border-[#DDD7CD] hover:bg-[#F4F1EB] hover:border-[#BD7131]/40'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-16 h-12 bg-black rounded-lg overflow-hidden shrink-0 border border-[#DDD7CD] flex items-center justify-center">
                          {vid.thumbnailUrl ? (
                            <img
                              src={vid.thumbnailUrl}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <video
                              src={vid.fileUrl}
                              className="w-full h-full object-cover"
                              preload="none"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#0F172A] truncate" title={vid.originalName}>
                            {vid.originalName}
                          </p>
                          <div className="flex items-center space-x-2 text-[10px] text-[#0F172A]/60 font-mono mt-0.5">
                            <span>{(vid.fileSize / (1024 * 1024)).toFixed(1)} MB</span>
                            {formatDuration(vid.duration) && (
                              <>
                                <span>•</span>
                                <span>{formatDuration(vid.duration)}</span>
                              </>
                            )}
                            <span>•</span>
                            <span>{new Date(vid.uploadedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {isSelected ? (
                        <span className="text-[11px] font-bold text-[#1F6D52] flex items-center gap-1 shrink-0">
                          <Check className="w-4 h-4" /> Selected
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-[#0F172A]/60 hover:text-[#0F172A] shrink-0">
                          Select
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-[#DDD7CD] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowVideoPickerModal(false);
                  onNavigateToUpload();
                }}
                className="text-xs font-semibold text-[#1F6D52] hover:underline cursor-pointer"
              >
                Upload new videos in Video Library
              </button>
              <button
                type="button"
                onClick={() => setShowVideoPickerModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#0F172A] hover:bg-[#F4F1EB] rounded-xl transition border border-[#DDD7CD] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal before Submit */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-[#F8F6F1] border border-[#DDD7CD] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#0F172A]">
              {publishMode === 'immediate'
                ? 'Confirm Immediate Social Media Publishing'
                : 'Confirm Scheduled Social Media Publishing'}
            </h3>
            <p className="text-xs text-[#0F172A]/70">
              Please review the destination platforms, publication timing, and post configuration before continuing.
            </p>

            <div className="space-y-3 bg-[#F4F1EB] p-4 rounded-xl border border-[#DDD7CD] text-xs shadow-2xs">
              <div className="flex justify-between items-start">
                <span className="text-[#0F172A]/60">Post Title:</span>
                <span className="text-[#0F172A] font-bold text-right truncate max-w-[240px]">
                  {postTitle || selectedVideo?.originalName}
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-[#0F172A]/60">Source Video:</span>
                <span className="text-[#0F172A] font-mono text-right truncate max-w-[240px]">
                  {selectedVideo?.originalName} ({(selectedVideo ? selectedVideo.fileSize / (1024 * 1024) : 0).toFixed(1)} MB)
                </span>
              </div>

              <div className="flex justify-between items-start">
                <span className="text-[#0F172A]/60">Real-time Timestamp:</span>
                <span className="text-[#0F172A] font-mono text-[11px] text-right">
                  {realTime.formatted}
                </span>
              </div>

              <div className="flex justify-between items-start">
                <span className="text-[#0F172A]/60">Publishing Mode:</span>
                <span className="text-[#1F6D52] font-bold text-right">
                  {publishMode === 'immediate'
                    ? 'Publish Immediately (Instant Webhook Dispatch)'
                    : `Scheduled for ${new Date(defaultScheduleTime).toLocaleString([], {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })} (${userTimezone})`}
                </span>
              </div>

              <div className="pt-2 border-t border-[#DDD7CD]">
                <span className="text-[#0F172A]/60 block mb-1.5 font-medium">Selected Destinations:</span>
                <div className="space-y-1.5">
                  {selectedPlatformsList.map((plat) => {
                    const label =
                      plat === 'instagram'
                        ? 'Instagram Reels'
                        : plat === 'facebook'
                        ? 'Facebook Page'
                        : 'TikTok';
                    const customTime =
                      plat === 'instagram'
                        ? instagramScheduleTime
                        : plat === 'facebook'
                        ? facebookScheduleTime
                        : tiktokScheduleTime;

                    return (
                      <div key={plat} className="flex items-center justify-between text-[11px] bg-[#F8F6F1] p-2 rounded-lg border border-[#DDD7CD]">
                        <span className="font-bold text-[#0F172A]">{label}</span>
                        <span className="text-[#1F6D52] font-semibold">
                          {publishMode === 'immediate'
                            ? 'Immediate'
                            : useCustomPlatformTimes
                            ? new Date(customTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'Default time'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-[#DDD7CD]">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-[#0F172A] hover:bg-[#F4F1EB] rounded-xl transition border border-[#DDD7CD] cursor-pointer"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={handleExecuteCreation}
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold text-white bg-[#1F6D52] hover:bg-[#185741] rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting
                  ? 'Processing...'
                  : publishMode === 'immediate'
                  ? 'Confirm & Publish Now'
                  : 'Confirm & Schedule Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publish Error Diagnostic Modal */}
      {publishErrorModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-[#F8F6F1] border border-rose-300 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-700">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">{publishErrorModal.title}</h3>
                <p className="text-xs text-rose-700 font-medium">The post was created as draft, but could not be delivered to n8n.</p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2 text-xs text-rose-950 font-mono">
              <div className="font-semibold text-rose-800 break-words">
                {publishErrorModal.message}
              </div>
              {publishErrorModal.httpStatus && (
                <div className="text-[11px] text-[#0F172A]/70">
                  HTTP Status: <span className="font-bold">{publishErrorModal.httpStatus}</span>
                </div>
              )}
              {publishErrorModal.responseExcerpt && (
                <div className="bg-white/70 p-2 rounded border border-rose-200 text-[10px] overflow-x-auto max-h-20">
                  {publishErrorModal.responseExcerpt}
                </div>
              )}
            </div>

            <div className="bg-[#F4F1EB] p-3 rounded-xl border border-[#DDD7CD] text-xs text-[#0F172A]/80 space-y-1.5">
              <span className="font-bold block text-[#0F172A]">Why did this happen?</span>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-[#0F172A]/70">
                <li>If using the n8n Test URL, ensure you clicked <strong>&quot;Listen for test event&quot;</strong> in your n8n Webhook node.</li>
                <li>Verify your Webhook URL in Step 4 is correct and starts with <code>https://</code>.</li>
                <li>Check that your n8n instance is publicly accessible and running.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#DDD7CD]">
              <button
                type="button"
                onClick={() => {
                  setPublishErrorModal(null);
                  setIsEditingWebhook(true);
                }}
                className="px-4 py-2 text-xs font-bold text-[#1F6D52] hover:bg-[#F4F1EB] rounded-xl transition border border-[#1F6D52]/30 cursor-pointer"
              >
                Change Webhook URL
              </button>
              <button
                type="button"
                onClick={() => setPublishErrorModal(null)}
                className="px-5 py-2 text-xs font-bold text-white bg-[#1F6D52] hover:bg-[#185741] rounded-xl shadow-xs transition cursor-pointer"
              >
                Dismiss &amp; Review Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
