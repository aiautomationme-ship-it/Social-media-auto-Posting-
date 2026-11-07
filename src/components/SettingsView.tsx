import React, { useState, useEffect } from 'react';
import {
  Settings,
  ShieldCheck,
  Server,
  FileCode,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Globe,
  Sliders,
  Bell,
  Clock,
  Send,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  XCircle,
  Play,
  Zap,
} from 'lucide-react';
import { api } from '../services/api.ts';
import type { PlatformType } from '../types/index.ts';

interface SystemStatus {
  backendSchedulerActive: boolean;
  schedulerIntervalSeconds: number;
  workflowIntegration: {
    configured: boolean;
    webhookUrl: string | null;
    mode: string;
    isTestUrl: boolean;
    source: string;
    supportedPlatforms: string[];
  };
}

interface SettingsViewProps {
  userEmail: string;
  videoCount: number;
  postCount: number;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  userEmail,
  videoCount,
  postCount,
}) => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [copiedContract, setCopiedContract] = useState(false);

  // Webhook Configuration State
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [isTestUrl, setIsTestUrl] = useState<boolean>(false);
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [webhookSource, setWebhookSource] = useState<string>('none');
  const [isSavingWebhook, setIsSavingWebhook] = useState<boolean>(false);
  const [webhookSaveMessage, setWebhookSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Per-Platform Webhook URLs
  const [platformWebhooks, setPlatformWebhooks] = useState<{
    tiktok: string;
    instagram: string;
    facebook: string;
  }>({ tiktok: '', instagram: '', facebook: '' });
  const [showPlatformWebhooks, setShowPlatformWebhooks] = useState<boolean>(false);
  const [testPlatform, setTestPlatform] = useState<PlatformType>('instagram');

  // Diagnostic Test State
  const [isTestingWebhook, setIsTestingWebhook] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    httpStatus?: number;
    statusText?: string;
    durationMs: number;
    url: string;
    responseBody?: string;
    dispatchedPayload: any;
    confirmationMessage?: string;
    errorMessage?: string;
  } | null>(null);
  const [showPayloadDetails, setShowPayloadDetails] = useState<boolean>(false);

  // Webhook Logs
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);

  // General App Preferences & Timezone state
  const [timeZone, setTimeZone] = useState<string>(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi'
  );
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h');
  const [autoPreviewVideos, setAutoPreviewVideos] = useState<boolean>(true);
  const [showToasts, setShowToasts] = useState<boolean>(true);
  const [defaultAdvanceHours, setDefaultAdvanceHours] = useState<number>(2);
  const [savedPreferencesToast, setSavedPreferencesToast] = useState<boolean>(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState<boolean>(false);

  // Fetch all settings & webhook configuration on mount
  const loadConfiguration = async () => {
    try {
      const [sysStatus, whConfig, logs, appSettings] = await Promise.all([
        fetch('/api/system/status').then((r) => r.json()).catch(() => null),
        api.getWebhookConfig().catch(() => null),
        api.getWebhookLogs(15).catch(() => []),
        api.getSettings().catch(() => null),
      ]);

      if (sysStatus) setStatus(sysStatus);
      if (whConfig) {
        setWebhookUrl(whConfig.url || '');
        setIsTestUrl(whConfig.isTestUrl);
        setIsConfigured(whConfig.isConfigured);
        setWebhookSource(whConfig.source);
        if (whConfig.timeZone) setTimeZone(whConfig.timeZone);
        if (whConfig.platformWebhooks) {
          setPlatformWebhooks({
            tiktok: whConfig.platformWebhooks.tiktok || '',
            instagram: whConfig.platformWebhooks.instagram || '',
            facebook: whConfig.platformWebhooks.facebook || '',
          });
          if (
            whConfig.platformWebhooks.tiktok ||
            whConfig.platformWebhooks.instagram ||
            whConfig.platformWebhooks.facebook
          ) {
            setShowPlatformWebhooks(true);
          }
        }
      }
      if (logs) setWebhookLogs(logs);
      if (appSettings) {
        if (appSettings.timeZone) setTimeZone(appSettings.timeZone);
        if (appSettings.timeFormat) setTimeFormat(appSettings.timeFormat);
        if (appSettings.defaultAdvanceHours) setDefaultAdvanceHours(appSettings.defaultAdvanceHours);
        if (typeof appSettings.autoPreviewVideos === 'boolean') setAutoPreviewVideos(appSettings.autoPreviewVideos);
        if (typeof appSettings.showToasts === 'boolean') setShowToasts(appSettings.showToasts);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  };

  useEffect(() => {
    loadConfiguration();
  }, []);

  const handleSwitchToProduction = (plat?: PlatformType) => {
    if (plat) {
      const cur = platformWebhooks[plat];
      if (cur && cur.includes('/webhook-test/')) {
        const prod = cur.replace('/webhook-test/', '/webhook/');
        setPlatformWebhooks((prev: { tiktok: string; instagram: string; facebook: string }) => ({ ...prev, [plat]: prod }));
      }
    } else {
      if (webhookUrl && webhookUrl.includes('/webhook-test/')) {
        const prod = webhookUrl.replace('/webhook-test/', '/webhook/');
        setWebhookUrl(prod);
      }
    }
  };

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingWebhook(true);
    setWebhookSaveMessage(null);
    try {
      const res = await api.updateWebhookConfig({
        webhookUrl: webhookUrl.trim(),
        platformWebhooks,
        timeZone,
      });
      setIsConfigured(res.isConfigured);
      setIsTestUrl(res.isTestUrl);
      setWebhookSource(res.source);
      if (res.platformWebhooks) {
        setPlatformWebhooks({
          tiktok: res.platformWebhooks.tiktok || '',
          instagram: res.platformWebhooks.instagram || '',
          facebook: res.platformWebhooks.facebook || '',
        });
      }
      setWebhookSaveMessage({
        type: 'success',
        text: `Webhook settings saved successfully! (${res.isTestUrl ? 'n8n Test Mode' : 'Production Mode'})`,
      });
      // Refresh system status & logs
      const sysStatus = await fetch('/api/system/status').then((r) => r.json()).catch(() => null);
      if (sysStatus) setStatus(sysStatus);
    } catch (err: any) {
      setWebhookSaveMessage({
        type: 'error',
        text: err?.message || 'Failed to save webhook configuration.',
      });
    } finally {
      setIsSavingWebhook(false);
      setTimeout(() => setWebhookSaveMessage(null), 5000);
    }
  };

  const handleRunDiagnosticTest = async (overrideUrl?: string, overridePlat?: PlatformType) => {
    const platToUse = overridePlat || testPlatform;
    const urlToUse = overrideUrl || (showPlatformWebhooks && platformWebhooks[platToUse] ? platformWebhooks[platToUse] : webhookUrl);

    if (!urlToUse || !urlToUse.trim()) {
      setWebhookSaveMessage({
        type: 'error',
        text: `Please enter a webhook URL for ${platToUse} or a global URL first.`,
      });
      return;
    }

    setIsTestingWebhook(true);
    setTestResult(null);
    try {
      const res = await api.sendTestWebhook(urlToUse.trim(), platToUse);
      setTestResult(res);
      // Refresh logs
      const freshLogs = await api.getWebhookLogs(15).catch(() => []);
      setWebhookLogs(freshLogs);
    } catch (err: any) {
      setTestResult({
        success: false,
        durationMs: 0,
        url: urlToUse.trim(),
        dispatchedPayload: null,
        errorMessage: err?.message || 'Failed to execute test webhook call.',
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleRefreshLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const freshLogs = await api.getWebhookLogs(20);
      setWebhookLogs(freshLogs);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPreferences(true);
    try {
      await api.updateSettings({
        timeZone,
        timeFormat,
        defaultAdvanceHours,
        autoPreviewVideos,
        showToasts,
        webhookUrl: webhookUrl.trim(),
      });
      setSavedPreferencesToast(true);
      setTimeout(() => setSavedPreferencesToast(false), 3000);
    } catch (err: any) {
      alert(err?.message || 'Failed to save preferences');
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const contractExample = JSON.stringify(
    {
      _note: 'Direct uncompressed video file delivered via multipart/form-data (No URL download required)',
      binary_properties: {
        data: 'Direct binary video file (n8n standard default for Google Drive / S3 / YouTube)',
        video: 'Direct binary video file',
        file: 'Direct binary video file',
      },
      body_fields: {
        event: 'socialflow.publish',
        platform: 'instagram',
        platformName: 'Instagram',
        platformDisplayName: 'Instagram',
        targetPlatform: 'instagram',
        sourcePlatform: 'instagram',
        videoTitle: 'Screen_Recording_2025-12-04_221035.mp4',
        fileName: 'Screen_Recording_2025-12-04_221035.mp4',
        caption: 'Exciting announcement! Watch until the end. #reels #viral',
        description: 'Exciting announcement! Watch until the end. #reels #viral',
        fileSize: '3625218',
        mimeType: 'video/mp4',
        day: 'Monday',
        date: '2026-10-19',
        month: 'October',
        year: '2026',
        time: '9:27:47 AM',
        formattedTime: 'Monday, 19 October 2026 at 9:27:47 AM',
        timestamp: '2026-10-19T09:27:47.269Z',
        realtime: {
          timestamp: '2026-10-19T09:27:47.269Z',
          date: '2026-10-19',
          day: 'Monday',
          month: 'October',
          year: 2026,
          time: '9:27:47 AM',
          formatted: 'Monday, 19 October 2026 at 9:27:47 AM',
        },
      },
    },
    null,
    2
  );

  const handleCopyContract = () => {
    navigator.clipboard.writeText(contractExample);
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DDD7CD]">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight">
              Settings &amp; Webhook Integration
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1F6D52]/10 text-[#1F6D52] font-semibold border border-[#1F6D52]/20 font-mono">
              n8n Ready
            </span>
          </div>
          <p className="text-sm text-[#0F172A]/70 mt-1">
            Configure your n8n publishing webhook URL, verify connections with diagnostic test events, and customize time zone preferences.
          </p>
        </div>

        {savedPreferencesToast && (
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold animate-in fade-in duration-150">
            <Check className="w-3.5 h-3.5 text-[#1F6D52]" />
            <span>Preferences saved successfully</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: n8n Webhook Integration & Diagnostic Tester (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: n8n Webhook Publishing Endpoint */}
          <div className="bg-[#F4F1EB] border border-[#DDD7CD] rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-[#DDD7CD]">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#1F6D52]/10 border border-[#1F6D52]/20 flex items-center justify-center text-[#1F6D52] shadow-2xs">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#0F172A]">n8n Webhook Publishing Endpoint</h2>
                  <p className="text-xs text-[#0F172A]/70">
                    Dispatches direct raw video files (multipart/form-data) with zero compression &amp; post metadata when you click &quot;Publish Now&quot; or when scheduled time arrives.
                  </p>
                </div>
              </div>

              {/* Status Pill */}
              <span
                className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-full border flex items-center space-x-1.5 ${
                  isConfigured
                    ? isTestUrl
                      ? 'bg-amber-50 text-amber-900 border-amber-200'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {isConfigured ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-[#1F6D52]" />
                    <span>{isTestUrl ? 'n8n Test Webhook' : 'Production Webhook'}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                    <span>Unconfigured</span>
                  </>
                )}
              </span>
            </div>

            {/* Test Mode Alert with 1-Click Production Converter */}
            {isTestUrl && (
              <div className="mt-4 p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-950 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-start space-x-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">n8n Test Webhook Active (/webhook-test/)</span>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      In n8n, <code>/webhook-test/</code> only listens for ONE single request after you click <em>&quot;Execute workflow&quot;</em>. For continuous scheduled &amp; automated publishing, switch to the <strong>Production URL</strong> and toggle your workflow <strong>Active: ON</strong> in n8n.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSwitchToProduction()}
                  className="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-bold shrink-0 transition cursor-pointer shadow-xs"
                >
                  ⚡ Convert to Production URL
                </button>
              </div>
            )}

            {webhookSaveMessage && (
              <div
                className={`mt-4 p-3.5 rounded-xl border text-xs font-medium flex items-start space-x-2 ${
                  webhookSaveMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {webhookSaveMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-[#1F6D52] shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{webhookSaveMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveWebhook} className="pt-5 space-y-5">
              {/* Global / Fallback Webhook URL */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#0F172A] flex items-center justify-between">
                  <span>Global Webhook URL (Default Fallback)</span>
                  <span className="text-[11px] text-[#0F172A]/60 font-mono">
                    Used for all platforms unless overridden below
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-n8n.example.com/webhook/socialmedia"
                    className="w-full bg-[#F8F6F1] border border-[#DDD7CD] rounded-xl px-3.5 py-2.5 text-xs font-mono font-medium text-[#0F172A] focus:outline-none focus:border-[#1F6D52] shadow-2xs"
                  />
                </div>
              </div>

              {/* Collapsible Dedicated Webhooks per Platform */}
              <div className="border border-[#DDD7CD] rounded-xl bg-[#F8F6F1] p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-[#1F6D52]" />
                      <span>Dedicated Webhooks per Platform (Optional)</span>
                    </h4>
                    <p className="text-[11px] text-[#0F172A]/70 mt-0.5">
                      Configure separate n8n webhook URLs if you have different workflows for Instagram, TikTok, or Facebook.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPlatformWebhooks(!showPlatformWebhooks)}
                    className="px-2.5 py-1 text-xs font-semibold text-[#1F6D52] hover:bg-[#F4F1EB] rounded-lg border border-[#DDD7CD] transition cursor-pointer"
                  >
                    {showPlatformWebhooks ? 'Hide Platform URLs' : 'Show Platform URLs'}
                  </button>
                </div>

                {showPlatformWebhooks && (
                  <div className="space-y-3 pt-2 border-t border-[#DDD7CD]">
                    {/* Instagram Webhook */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#0F172A] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-pink-500" />
                          Instagram Reels Webhook URL
                        </span>
                        {platformWebhooks.instagram && platformWebhooks.instagram.includes('/webhook-test/') && (
                          <button
                            type="button"
                            onClick={() => handleSwitchToProduction('instagram')}
                            className="text-[10px] text-amber-700 font-semibold hover:underline"
                          >
                            ⚡ Switch to /webhook/
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={platformWebhooks.instagram}
                          onChange={(e) => setPlatformWebhooks({ ...platformWebhooks, instagram: e.target.value })}
                          placeholder="Leave empty to use Global Webhook"
                          className="flex-1 bg-white border border-[#DDD7CD] rounded-lg px-3 py-1.5 text-xs font-mono text-[#0F172A] focus:outline-none focus:border-[#1F6D52]"
                        />
                        <button
                          type="button"
                          onClick={() => handleRunDiagnosticTest(platformWebhooks.instagram, 'instagram')}
                          disabled={isTestingWebhook || !platformWebhooks.instagram}
                          className="px-3 py-1.5 bg-[#BD7131] hover:bg-[#A86128] text-white rounded-lg text-[11px] font-bold disabled:opacity-40 cursor-pointer shadow-2xs"
                        >
                          Test
                        </button>
                      </div>
                    </div>

                    {/* TikTok Webhook */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#0F172A] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-cyan-500" />
                          TikTok Webhook URL
                        </span>
                        {platformWebhooks.tiktok && platformWebhooks.tiktok.includes('/webhook-test/') && (
                          <button
                            type="button"
                            onClick={() => handleSwitchToProduction('tiktok')}
                            className="text-[10px] text-amber-700 font-semibold hover:underline"
                          >
                            ⚡ Switch to /webhook/
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={platformWebhooks.tiktok}
                          onChange={(e) => setPlatformWebhooks({ ...platformWebhooks, tiktok: e.target.value })}
                          placeholder="Leave empty to use Global Webhook"
                          className="flex-1 bg-white border border-[#DDD7CD] rounded-lg px-3 py-1.5 text-xs font-mono text-[#0F172A] focus:outline-none focus:border-[#1F6D52]"
                        />
                        <button
                          type="button"
                          onClick={() => handleRunDiagnosticTest(platformWebhooks.tiktok, 'tiktok')}
                          disabled={isTestingWebhook || !platformWebhooks.tiktok}
                          className="px-3 py-1.5 bg-[#BD7131] hover:bg-[#A86128] text-white rounded-lg text-[11px] font-bold disabled:opacity-40 cursor-pointer shadow-2xs"
                        >
                          Test
                        </button>
                      </div>
                    </div>

                    {/* Facebook Webhook */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#0F172A] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-600" />
                          Facebook Page Webhook URL
                        </span>
                        {platformWebhooks.facebook && platformWebhooks.facebook.includes('/webhook-test/') && (
                          <button
                            type="button"
                            onClick={() => handleSwitchToProduction('facebook')}
                            className="text-[10px] text-amber-700 font-semibold hover:underline"
                          >
                            ⚡ Switch to /webhook/
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={platformWebhooks.facebook}
                          onChange={(e) => setPlatformWebhooks({ ...platformWebhooks, facebook: e.target.value })}
                          placeholder="Leave empty to use Global Webhook"
                          className="flex-1 bg-white border border-[#DDD7CD] rounded-lg px-3 py-1.5 text-xs font-mono text-[#0F172A] focus:outline-none focus:border-[#1F6D52]"
                        />
                        <button
                          type="button"
                          onClick={() => handleRunDiagnosticTest(platformWebhooks.facebook, 'facebook')}
                          disabled={isTestingWebhook || !platformWebhooks.facebook}
                          className="px-3 py-1.5 bg-[#BD7131] hover:bg-[#A86128] text-white rounded-lg text-[11px] font-bold disabled:opacity-40 cursor-pointer shadow-2xs"
                        >
                          Test
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center space-x-2">
                  <button
                    type="submit"
                    disabled={isSavingWebhook}
                    className="px-4 py-2 bg-[#1F6D52] hover:bg-[#185741] text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
                  >
                    {isSavingWebhook ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save All Webhook URLs</span>
                      </>
                    )}
                  </button>

                  {(webhookUrl || Object.values(platformWebhooks).some(Boolean)) && (
                    <button
                      type="button"
                      onClick={() => {
                        setWebhookUrl('');
                        setPlatformWebhooks({ tiktok: '', instagram: '', facebook: '' });
                      }}
                      className="px-3 py-2 bg-[#F8F6F1] hover:bg-[#F4F1EB] text-[#0F172A]/80 border border-[#DDD7CD] rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Global Test button */}
                <button
                  type="button"
                  onClick={() => handleRunDiagnosticTest()}
                  disabled={isTestingWebhook || (!webhookUrl.trim() && !Object.values(platformWebhooks).some(Boolean))}
                  className="px-4 py-2 bg-[#BD7131] hover:bg-[#A86128] text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
                >
                  {isTestingWebhook ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Test Event...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Test Global Webhook</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Diagnostic Result Banner */}
            {testResult && (
              <div
                className={`mt-5 p-4 rounded-xl border text-xs space-y-2 animate-in fade-in duration-200 ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 font-bold">
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-[#1F6D52]" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>
                      {testResult.success
                        ? `HTTP ${testResult.httpStatus || 200} OK — Webhook Responded Successfully!`
                        : `HTTP ${testResult.httpStatus || 'Error'} — Webhook Request Failed`}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] bg-white/70 px-2 py-0.5 rounded-md border border-current">
                    {testResult.durationMs}ms
                  </span>
                </div>

                <p className="text-[11px] leading-relaxed">
                  {testResult.confirmationMessage || testResult.errorMessage}
                </p>

                {testResult.responseBody && (
                  <div className="bg-white/80 p-2.5 rounded-lg border border-[#DDD7CD] font-mono text-[11px] overflow-x-auto max-h-24">
                    <strong>n8n Response:</strong> {testResult.responseBody}
                  </div>
                )}

                <div className="pt-1 flex items-center justify-between">
                  <span className="text-[10px] text-[#0F172A]/70">
                    If n8n was listening, check your n8n workflow canvas for the trigger output.
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPayloadDetails(!showPayloadDetails)}
                    className="text-[11px] font-bold underline cursor-pointer hover:opacity-80 flex items-center gap-1"
                  >
                    <span>{showPayloadDetails ? 'Hide Dispatched Payload' : 'Inspect Dispatched Payload'}</span>
                    {showPayloadDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {showPayloadDetails && testResult.dispatchedPayload && (
                  <pre className="mt-2 p-3 bg-[#F8F6F1] rounded-lg border border-[#DDD7CD] text-[10px] font-mono text-[#0F172A] overflow-x-auto max-h-48">
                    {JSON.stringify(testResult.dispatchedPayload, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>

          {/* Card 2: Recent Webhook Outbound Delivery Logs */}
          <div className="bg-[#F4F1EB] border border-[#DDD7CD] rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDD7CD]">
              <div className="flex items-center space-x-2.5">
                <Clock className="w-4 h-4 text-[#1F6D52]" />
                <h3 className="text-sm font-bold text-[#0F172A]">Recent Outbound Webhook Logs</h3>
              </div>
              <button
                type="button"
                onClick={handleRefreshLogs}
                disabled={isLoadingLogs}
                className="flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#F8F6F1] hover:bg-[#F4F1EB] border border-[#DDD7CD] text-[#0F172A] transition cursor-pointer shadow-2xs"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingLogs ? 'animate-spin text-[#1F6D52]' : ''}`} />
                <span>Refresh Logs</span>
              </button>
            </div>

            <p className="text-xs text-[#0F172A]/70 mt-2 mb-3">
              Actual network requests dispatched by SocialFlow to your configured webhook endpoint:
            </p>

            {webhookLogs.length === 0 ? (
              <div className="p-6 text-center bg-[#F8F6F1] rounded-xl border border-dashed border-[#DDD7CD] text-xs text-[#0F172A]/60">
                No webhook calls logged yet. Click &quot;Test Webhook Connection&quot; above or publish a video post.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#DDD7CD] text-[11px] text-[#0F172A]/60 font-semibold">
                      <th className="py-2 pr-3">Timestamp</th>
                      <th className="py-2 px-2">Event</th>
                      <th className="py-2 px-2">Platform</th>
                      <th className="py-2 px-2">Status</th>
                      <th className="py-2 pl-2 text-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDD7CD]/50">
                    {webhookLogs.map((log: any, idx: number) => (
                      <tr key={log.id || idx} className="hover:bg-[#F8F6F1]/60 font-mono text-[11px]">
                        <td className="py-2 pr-3 text-[#0F172A]/80 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="py-2 px-2">
                          <span className="font-semibold text-[#0F172A]">
                            {log.event === 'socialflow.webhook_test' ? 'webhook_test' : 'publish'}
                          </span>
                        </td>
                        <td className="py-2 px-2 capitalize text-[#0F172A]/70">
                          {log.platform || 'all'}
                        </td>
                        <td className="py-2 px-2">
                          <span
                            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.success
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}
                          >
                            <span>{log.httpStatus ? `HTTP ${log.httpStatus}` : log.success ? 'OK' : 'FAIL'}</span>
                          </span>
                        </td>
                        <td className="py-2 pl-2 text-right text-[#0F172A]/70">
                          {log.durationMs ? `${log.durationMs}ms` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Timezone, App Preferences, Contract Spec & Storage Health (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 3: App & Publishing Preferences */}
          <div className="bg-[#F4F1EB] border border-[#DDD7CD] rounded-2xl p-6 shadow-xs">
            <div className="flex items-center space-x-3 pb-4 border-b border-[#DDD7CD]">
              <div className="w-10 h-10 rounded-xl bg-[#1F6D52]/10 border border-[#1F6D52]/20 flex items-center justify-center text-[#1F6D52] shadow-2xs">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">App &amp; Time Zone Settings</h2>
                <p className="text-xs text-[#0F172A]/70">
                  Timezone, scheduling advance, and interface options.
                </p>
              </div>
            </div>

            <form onSubmit={handleSavePreferences} className="pt-5 space-y-4">
              {/* Time Zone Selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#1F6D52]" />
                  <span>Publishing Time Zone</span>
                </label>
                <select
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  className="w-full bg-[#F8F6F1] border border-[#DDD7CD] rounded-xl px-3.5 py-2 text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#1F6D52] shadow-2xs"
                >
                  <option value="Asia/Karachi">Asia/Karachi (PKT - Pakistan Standard Time)</option>
                  <option value="UTC">UTC (Universal Coordinated Time)</option>
                  <option value="America/New_York">America/New_York (Eastern Time)</option>
                  <option value="America/Chicago">America/Chicago (Central Time)</option>
                  <option value="America/Denver">America/Denver (Mountain Time)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (Pacific Time)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Europe/Paris">Europe/Paris (CET)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                </select>
                <p className="text-[11px] text-[#0F172A]/60 font-mono">
                  Browser detected: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </p>
              </div>

              {/* Time Format */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#1F6D52]" />
                    <span>Clock Format</span>
                  </label>
                  <select
                    value={timeFormat}
                    onChange={(e) => setTimeFormat(e.target.value as '12h' | '24h')}
                    className="w-full bg-[#F8F6F1] border border-[#DDD7CD] rounded-xl px-3 py-2 text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#1F6D52] shadow-2xs"
                  >
                    <option value="12h">12-hour (02:30 PM)</option>
                    <option value="24h">24-hour (14:30)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#0F172A]">
                    Default Lead (Hours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={defaultAdvanceHours}
                    onChange={(e) => setDefaultAdvanceHours(Number(e.target.value))}
                    className="w-full bg-[#F8F6F1] border border-[#DDD7CD] rounded-xl px-3 py-2 text-xs font-mono font-medium text-[#0F172A] focus:outline-none focus:border-[#1F6D52] shadow-2xs"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2.5 pt-1 border-t border-[#DDD7CD]">
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8F6F1] border border-[#DDD7CD] cursor-pointer shadow-2xs">
                  <div>
                    <span className="text-xs font-bold text-[#0F172A] block">
                      Autoplay Video Hover
                    </span>
                    <span className="text-[10px] text-[#0F172A]/60">
                      Preview video cards on hover in library
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoPreviewVideos}
                    onChange={(e) => setAutoPreviewVideos(e.target.checked)}
                    className="w-4 h-4 rounded text-[#1F6D52] focus:ring-[#1F6D52] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8F6F1] border border-[#DDD7CD] cursor-pointer shadow-2xs">
                  <div>
                    <span className="text-xs font-bold text-[#0F172A] block flex items-center gap-1">
                      <Bell className="w-3 h-3 text-[#1F6D52]" />
                      <span>Live Toast Notifications</span>
                    </span>
                    <span className="text-[10px] text-[#0F172A]/60">
                      Show toasts on schedule and publish events
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={showToasts}
                    onChange={(e) => setShowToasts(e.target.checked)}
                    className="w-4 h-4 rounded text-[#1F6D52] focus:ring-[#1F6D52] cursor-pointer"
                  />
                </label>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingPreferences}
                  className="px-4 py-2 bg-[#1F6D52] hover:bg-[#185741] text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {isSavingPreferences ? 'Saving...' : 'Save App Preferences'}
                </button>
              </div>
            </form>
          </div>

          {/* Card 4: Backend Contract Specification */}
          <div className="bg-[#F4F1EB] border border-[#DDD7CD] rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDD7CD]">
              <div className="flex items-center space-x-2.5">
                <FileCode className="w-4 h-4 text-[#1F6D52]" />
                <h3 className="text-sm font-bold text-[#0F172A]">
                  Outbound JSON Payload Schema
                </h3>
              </div>
              <button
                onClick={handleCopyContract}
                className="flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#F8F6F1] hover:bg-[#F4F1EB] border border-[#DDD7CD] text-[#0F172A] transition cursor-pointer shadow-2xs"
              >
                {copiedContract ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#1F6D52]" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-[#0F172A]/70 mt-2 mb-2 leading-relaxed">
              Dispatched with real-time day, date, month, year, video download link, and metadata:
            </p>

            <pre className="p-3 bg-[#F8F6F1] rounded-xl border border-[#DDD7CD] text-[10px] font-mono text-[#0F172A] overflow-x-auto max-h-[180px]">
              {contractExample}
            </pre>
          </div>

          {/* Card 5: Account & Daemon Storage Health */}
          <div className="bg-[#F4F1EB] border border-[#DDD7CD] rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center space-x-2.5 pb-2 border-b border-[#DDD7CD]">
              <HardDrive className="w-4 h-4 text-[#1F6D52]" />
              <h3 className="text-xs font-bold text-[#0F172A]">System &amp; Storage Health</h3>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-[#F8F6F1] rounded-xl border border-[#DDD7CD]">
                <div className="text-[10px] text-[#0F172A]/60">Stored Videos</div>
                <div className="text-sm font-bold font-mono text-[#1F6D52]">{videoCount}</div>
              </div>

              <div className="p-2.5 bg-[#F8F6F1] rounded-xl border border-[#DDD7CD]">
                <div className="text-[10px] text-[#0F172A]/60">Total Posts</div>
                <div className="text-sm font-bold font-mono text-[#1F6D52]">{postCount}</div>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-[#F8F6F1] rounded-xl border border-[#DDD7CD] text-[11px]">
              <span className="text-[#0F172A]/70 font-medium">Scheduler Daemon:</span>
              <span className="font-semibold text-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-[#1F6D52]" />
                <span>Active (5s cycle)</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
