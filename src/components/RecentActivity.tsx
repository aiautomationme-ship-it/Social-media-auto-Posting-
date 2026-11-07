import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Video,
  Target,
  Share2,
  Calendar,
  XCircle,
  History,
} from 'lucide-react';
import type { ActivityLog } from '../types/index.ts';

interface RecentActivityProps {
  activities: ActivityLog[];
}

export const RecentActivity: React.FC<RecentActivityProps> = ({ activities }) => {
  const [filterType, setFilterType] = useState<'all' | 'posts' | 'targets' | 'videos'>('all');

  const getActivityIcon = (type: ActivityLog['type']) => {
    switch (type) {
      case 'post_published':
        return <CheckCircle2 className="w-4 h-4 text-emerald-700" />;
      case 'post_failed':
        return <AlertCircle className="w-4 h-4 text-rose-600" />;
      case 'post_scheduled':
      case 'post_created':
        return <Calendar className="w-4 h-4 text-[#1F6D52]" />;
      case 'post_cancelled':
        return <XCircle className="w-4 h-4 text-slate-400" />;
      case 'video_uploaded':
      case 'video_deleted':
        return <Video className="w-4 h-4 text-slate-700" />;
      case 'target_created':
      case 'target_updated':
      case 'target_deleted':
        return <Target className="w-4 h-4 text-amber-600" />;
      case 'platform_connected':
      case 'platform_disconnected':
        return <Share2 className="w-4 h-4 text-purple-600" />;
      default:
        return <Activity className="w-4 h-4 text-slate-500" />;
    }
  };

  const filtered = activities.filter((act) => {
    if (filterType === 'posts') return act.type.startsWith('post_');
    if (filterType === 'targets') return act.type.startsWith('target_');
    if (filterType === 'videos') return act.type.startsWith('video_');
    return true;
  });

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-7 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E5E7EB]">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#1F6D52]/10 border border-[#1F6D52]/20 flex items-center justify-center text-[#1F6D52] shadow-2xs">
            <History className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Audit Trail</h2>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] text-slate-700">
                {activities.length} logs
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Immutable timeline of real targets, video uploads, and publishing actions.
            </p>
          </div>
        </div>

        {/* Quick Category Filters */}
        {activities.length > 0 && (
          <div className="flex items-center bg-[#F9FAFB] p-1 rounded-xl border border-[#E5E7EB] self-start sm:self-auto shadow-2xs">
            {(['all', 'posts', 'targets', 'videos'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterType(cat)}
                className={`px-2.5 py-1 text-xs font-semibold capitalize rounded-lg transition cursor-pointer ${
                  filterType === cat
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pt-5">
        {activities.length === 0 ? (
          <div className="text-center py-10 px-4 bg-[#F9FAFB] border border-dashed border-[#D1D5DB] rounded-2xl">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mx-auto text-slate-400 mb-2.5 border border-[#E5E7EB] shadow-2xs">
              <Activity className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Recorded Events Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Events will be recorded automatically as you configure monthly targets, upload
              content, and schedule posts.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 px-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-xs text-slate-500">
            No activities matching the selected filter.
          </div>
        ) : (
          <div className="flow-root">
            <ul className="-mb-6">
              {filtered.map((act, idx) => {
                const isLast = idx === filtered.length - 1;
                const formattedTime = new Date(act.timestamp).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <li key={act.id}>
                    <div className="relative pb-5">
                      {!isLast && (
                        <span
                          className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-[#E5E7EB]"
                          aria-hidden="true"
                        />
                      )}
                      <div className="relative flex items-start space-x-3.5 group">
                        <div className="w-8 h-8 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                          {getActivityIcon(act.type)}
                        </div>
                        <div className="min-w-0 flex-1 bg-[#F9FAFB] border border-[#E5E7EB] p-3.5 rounded-xl group-hover:bg-slate-50 transition shadow-2xs">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {act.title}
                            </p>
                            <span className="text-[11px] text-slate-600 whitespace-nowrap ml-2 font-mono">
                              {formattedTime}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                            {act.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
