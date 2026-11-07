import React from 'react';
import {
  Share2,
  CheckCircle2,
  Calendar,
  Send,
  ShieldCheck,
} from 'lucide-react';
import type { PlatformType, DashboardStats } from '../types/index.ts';

interface PlatformOverviewProps {
  overview: DashboardStats['platformOverview'];
}

const PLATFORMS_META: Record<
  PlatformType,
  { name: string; tag: string; description: string; badgeColor: string }
> = {
  tiktok: {
    name: 'TikTok',
    tag: 'Direct Post API',
    description: 'Autonomous short video publishing with interaction & privacy controls',
    badgeColor: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  },
  instagram: {
    name: 'Instagram Reels',
    tag: 'Meta Reels API',
    description: 'High-definition Reels publishing to feed with hashtags and container validation',
    badgeColor: 'bg-pink-50 text-pink-800 border-pink-200',
  },
  facebook: {
    name: 'Facebook Page',
    tag: 'Page Videos API',
    description: 'Direct distribution to Facebook Page timeline and video streams',
    badgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
  },
};

export const PlatformOverview: React.FC<PlatformOverviewProps> = ({ overview }) => {
  const platforms: PlatformType[] = ['tiktok', 'instagram', 'facebook'];

  return (
    <div className="bg-[#F4F1EB] border border-[#DDD7CD] rounded-2xl p-6 sm:p-7 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#DDD7CD]">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#1F6D52]/10 border border-[#1F6D52]/20 flex items-center justify-center text-[#1F6D52] shadow-2xs">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-[#0F172A] tracking-tight">
                Publishing Platforms Overview
              </h2>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                Backend Managed
              </span>
            </div>
            <p className="text-xs text-[#0F172A]/70 mt-0.5">
              Target destinations executed directly via backend services and n8n workflows.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#F8F6F1] border border-[#DDD7CD] text-xs font-semibold text-[#0F172A] shadow-2xs">
          <ShieldCheck className="w-4 h-4 text-[#1F6D52]" />
          <span>Automated Publishing Daemon Active</span>
        </div>
      </div>

      {/* 3 Columns: TikTok, Instagram Reels, Facebook Page */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-6">
        {platforms.map((plat: PlatformType) => {
          const meta = PLATFORMS_META[plat];
          const info = overview[plat];

          return (
            <div
              key={plat}
              className="rounded-xl p-5 border border-[#DDD7CD] bg-[#F8F6F1] flex flex-col justify-between shadow-2xs"
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-bold text-sm text-[#0F172A]">{meta.name}</span>
                  <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-[#1F6D52]" />
                    <span>Ready</span>
                  </span>
                </div>

                <p className="text-xs text-[#0F172A]/70 line-clamp-2 mb-4">
                  {meta.description}
                </p>

                <div className="space-y-3">
                  <div className="text-xs font-mono text-[#0F172A]/80 font-semibold bg-[#F4F1EB] px-2.5 py-1.5 rounded-lg border border-[#DDD7CD] truncate">
                    {info?.accountName || 'Backend Workflow Destination'}
                  </div>

                  {/* Summary Metric Wells */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="bg-[#F4F1EB] border border-[#DDD7CD] p-2.5 rounded-xl shadow-2xs text-left">
                      <div className="flex items-center space-x-1 text-xs text-[#0F172A]/70 mb-0.5 font-medium">
                        <Send className="w-3 h-3 text-[#1F6D52]" />
                        <span>Published</span>
                      </div>
                      <div className="text-lg font-bold font-mono text-[#0F172A]">
                        {info?.publishedCount ?? 0}
                      </div>
                    </div>

                    <div className="bg-[#F4F1EB] border border-[#DDD7CD] p-2.5 rounded-xl shadow-2xs text-left">
                      <div className="flex items-center space-x-1 text-xs text-[#0F172A]/70 mb-0.5 font-medium">
                        <Calendar className="w-3 h-3 text-[#BD7131]" />
                        <span>Scheduled</span>
                      </div>
                      <div className="text-lg font-bold font-mono text-[#0F172A]">
                        {info?.scheduledCount ?? 0}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
