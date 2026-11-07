import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import {
  TrendingUp,
  Calendar,
  Layers,
  BarChart2,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import type { SocialPost, ActivityLog, PlatformType } from '../types/index.ts';

interface PublishingTrendChartProps {
  posts: SocialPost[];
  activities?: ActivityLog[];
}

type ChartViewMode = 'area' | 'bar';
type PlatformFilter = 'all' | 'breakdown';

export const PublishingTrendChart: React.FC<PublishingTrendChartProps> = ({
  posts,
  activities = [],
}) => {
  const [viewMode, setViewMode] = useState<ChartViewMode>('area');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');

  // Generate 30-day chronological rolling timeline (29 days ago up to today)
  const chartData = useMemo(() => {
    const dataMap: Record<
      string,
      {
        dateKey: string;
        label: string;
        fullDate: string;
        total: number;
        tiktok: number;
        instagram: number;
        facebook: number;
        postsList: string[];
      }
    > = {};

    const now = new Date();
    // Build array of last 30 days
    const dayKeys: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      dayKeys.push(dateKey);

      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const fullDate = d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      dataMap[dateKey] = {
        dateKey,
        label,
        fullDate,
        total: 0,
        tiktok: 0,
        instagram: 0,
        facebook: 0,
        postsList: [],
      };
    }

    // Tally published posts
    const talliedPostIds = new Set<string>();

    posts.forEach((post) => {
      const platforms: PlatformType[] = ['tiktok', 'instagram', 'facebook'];
      let countedForDate: string | null = null;

      platforms.forEach((plat) => {
        const platConfig = post.platforms[plat];
        if (platConfig && platConfig.enabled && platConfig.status === 'published') {
          const timestamp = platConfig.publishedAt || post.updatedAt || post.createdAt;
          if (timestamp) {
            const pubDate = new Date(timestamp);
            const pubYear = pubDate.getFullYear();
            const pubMonth = String(pubDate.getMonth() + 1).padStart(2, '0');
            const pubDay = String(pubDate.getDate()).padStart(2, '0');
            const key = `${pubYear}-${pubMonth}-${pubDay}`;

            if (dataMap[key]) {
              dataMap[key][plat]++;
              if (countedForDate !== key) {
                dataMap[key].total++;
                countedForDate = key;
                if (!talliedPostIds.has(post.id)) {
                  dataMap[key].postsList.push(post.title || 'Untitled Post');
                  talliedPostIds.add(post.id);
                }
              }
            }
          }
        }
      });

      // Fallback: If post is marked published overall without per-platform publishedAt
      if (!countedForDate && post.status === 'published') {
        const timestamp = post.updatedAt || post.createdAt;
        if (timestamp) {
          const pubDate = new Date(timestamp);
          const pubYear = pubDate.getFullYear();
          const pubMonth = String(pubDate.getMonth() + 1).padStart(2, '0');
          const pubDay = String(pubDate.getDate()).padStart(2, '0');
          const key = `${pubYear}-${pubMonth}-${pubDay}`;

          if (dataMap[key]) {
            dataMap[key].total++;
            dataMap[key].postsList.push(post.title || 'Untitled Post');
          }
        }
      }
    });

    // Also reconcile with activity logs for any recorded publish triggers
    activities.forEach((act) => {
      if (act.type === 'post_published' && act.timestamp) {
        const actDate = new Date(act.timestamp);
        const actYear = actDate.getFullYear();
        const actMonth = String(actDate.getMonth() + 1).padStart(2, '0');
        const actDay = String(actDate.getDate()).padStart(2, '0');
        const key = `${actYear}-${actMonth}-${actDay}`;

        if (dataMap[key] && dataMap[key].total === 0) {
          dataMap[key].total = 1;
          if (act.platform && dataMap[key][act.platform] === 0) {
            dataMap[key][act.platform] = 1;
          }
        }
      }
    });

    return dayKeys.map((key) => dataMap[key]);
  }, [posts, activities]);

  // Aggregate high-level stats over the 30-day window
  const totalPublished30Days = useMemo(
    () => chartData.reduce((acc, curr) => acc + curr.total, 0),
    [chartData]
  );

  const activeDaysCount = useMemo(
    () => chartData.filter((d) => d.total > 0).length,
    [chartData]
  );

  const peakDay = useMemo(() => {
    let peak = chartData[0];
    for (const d of chartData) {
      if (d.total > peak.total) {
        peak = d;
      }
    }
    return peak;
  }, [chartData]);

  const dailyAverage = useMemo(
    () => (totalPublished30Days / 30).toFixed(1),
    [totalPublished30Days]
  );

  // Custom high-contrast tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-white border border-[#D1D5DB] rounded-xl p-3 shadow-lg text-xs space-y-2 min-w-[180px] pointer-events-none">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-1.5 font-medium">
            <span className="font-bold text-[#111827]">{dataPoint.fullDate}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-[#4B5563]">Total Published:</span>
            <span className="font-bold text-[#1F6D52] font-mono text-base">
              {dataPoint.total} {dataPoint.total === 1 ? 'post' : 'posts'}
            </span>
          </div>

          {(dataPoint.tiktok > 0 || dataPoint.instagram > 0 || dataPoint.facebook > 0) && (
            <div className="pt-1.5 border-t border-[#E5E7EB] space-y-1 font-mono text-xs">
              {dataPoint.tiktok > 0 && (
                <div className="flex items-center justify-between text-[#111827]">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-[#111827]"></span>
                    TikTok
                  </span>
                  <span className="font-semibold">{dataPoint.tiktok}</span>
                </div>
              )}
              {dataPoint.instagram > 0 && (
                <div className="flex items-center justify-between text-[#BE185D]">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-[#E11D48]"></span>
                    Instagram
                  </span>
                  <span className="font-semibold">{dataPoint.instagram}</span>
                </div>
              )}
              {dataPoint.facebook > 0 && (
                <div className="flex items-center justify-between text-[#1D4ED8]">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-[#2563EB]"></span>
                    Facebook
                  </span>
                  <span className="font-semibold">{dataPoint.facebook}</span>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[#F4F1EB] border border-[#DDD7CD] rounded-2xl p-6 sm:p-7 shadow-xs space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#DDD7CD]">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#1F6D52]/10 border border-[#1F6D52]/20 flex items-center justify-center text-[#1F6D52] shadow-2xs">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#0F172A] tracking-tight">
                Publishing Velocity &amp; Trend
              </h2>
              <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                Last 30 Days
              </span>
            </div>
            <p className="text-xs text-[#0F172A]/70 mt-0.5 font-medium">
              Daily volume of confirmed published videos across TikTok, Instagram Reels, and Facebook Pages.
            </p>
          </div>
        </div>

        {/* View Switchers */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Platform breakdown toggle */}
          <div className="flex items-center bg-[#F8F6F1] p-1 rounded-xl border border-[#DDD7CD] text-xs">
            <button
              type="button"
              onClick={() => setPlatformFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                platformFilter === 'all'
                  ? 'bg-white text-[#111827] shadow-2xs'
                  : 'text-[#0F172A]/70 hover:text-[#0F172A]'
              }`}
            >
              Total
            </button>
            <button
              type="button"
              onClick={() => setPlatformFilter('breakdown')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1 ${
                platformFilter === 'breakdown'
                  ? 'bg-white text-[#111827] shadow-2xs'
                  : 'text-[#0F172A]/70 hover:text-[#0F172A]'
              }`}
            >
              <Layers className="w-3 h-3 text-[#1F6D52]" />
              <span>By Platform</span>
            </button>
          </div>

          {/* Chart format switch: Area curve vs Bar columns */}
          <div className="flex items-center bg-[#F8F6F1] p-1 rounded-xl border border-[#DDD7CD] text-xs">
            <button
              type="button"
              onClick={() => setViewMode('area')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'area'
                  ? 'bg-white text-[#1F6D52] shadow-2xs'
                  : 'text-[#0F172A]/60 hover:text-[#0F172A]'
              }`}
              title="Smooth Area Trend"
            >
              <TrendingUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('bar')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'bar'
                  ? 'bg-white text-[#1F6D52] shadow-2xs'
                  : 'text-[#0F172A]/60 hover:text-[#0F172A]'
              }`}
              title="Daily Bar Volume"
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#F8F6F1] border border-[#DDD7CD] p-3.5 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-[#0F172A]/70 text-xs mb-1 font-medium">
            <span>30-Day Volume</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#1F6D52]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#0F172A]">
            {totalPublished30Days}
          </div>
          <p className="text-xs text-[#0F172A]/60 font-medium mt-0.5">Confirmed published</p>
        </div>

        <div className="bg-[#F8F6F1] border border-[#DDD7CD] p-3.5 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-[#0F172A]/70 text-xs mb-1 font-medium">
            <span>Daily Average</span>
            <TrendingUp className="w-3.5 h-3.5 text-[#BD7131]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#0F172A]">
            {dailyAverage}
          </div>
          <p className="text-xs text-[#0F172A]/60 font-medium mt-0.5">Posts per day</p>
        </div>

        <div className="bg-[#F8F6F1] border border-[#DDD7CD] p-3.5 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-[#0F172A]/70 text-xs mb-1 font-medium">
            <span>Active Days</span>
            <Calendar className="w-3.5 h-3.5 text-[#1F6D52]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#0F172A]">
            {activeDaysCount} <span className="text-xs font-medium text-[#0F172A]/60">/ 30</span>
          </div>
          <p className="text-xs text-[#0F172A]/60 font-medium mt-0.5">Days with publications</p>
        </div>

        <div className="bg-[#F8F6F1] border border-[#DDD7CD] p-3.5 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-[#0F172A]/70 text-xs mb-1 font-medium">
            <span>Peak Day</span>
            <Share2 className="w-3.5 h-3.5 text-[#BD7131]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#0F172A]">
            {peakDay.total > 0 ? `${peakDay.total} posts` : '0'}
          </div>
          <p className="text-xs text-[#0F172A]/60 font-medium mt-0.5 truncate">
            {peakDay.total > 0 ? peakDay.label : 'None recorded'}
          </p>
        </div>
      </div>

      {/* Main Visual Trend Chart using Recharts */}
      <div className="bg-[#F8F6F1] p-4 sm:p-5 rounded-2xl border border-[#DDD7CD] shadow-2xs">
        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'area' ? (
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1F6D52" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#1F6D52" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorTiktok" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#111827" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#111827" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorInstagram" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E11D48" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#E11D48" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorFacebook" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: '#D1D5DB' }}
                  tick={{ fill: '#6B7280', fontSize: 11, fontWeight: 500 }}
                  interval={4}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#6B7280', fontSize: 11, fontWeight: 500 }}
                />
                <Tooltip content={<CustomTooltip />} />
                {platformFilter === 'all' ? (
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#1F6D52"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorTotal)"
                    dot={{ fill: '#1F6D52', r: 2 }}
                    activeDot={{ r: 5, fill: '#1F6D52', stroke: '#FFFFFF', strokeWidth: 2 }}
                  />
                ) : (
                  <>
                    <Area
                      type="monotone"
                      dataKey="tiktok"
                      stackId="1"
                      stroke="#111827"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorTiktok)"
                    />
                    <Area
                      type="monotone"
                      dataKey="instagram"
                      stackId="1"
                      stroke="#E11D48"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorInstagram)"
                    />
                    <Area
                      type="monotone"
                      dataKey="facebook"
                      stackId="1"
                      stroke="#2563EB"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorFacebook)"
                    />
                  </>
                )}
              </AreaChart>
            ) : (
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: '#D1D5DB' }}
                  tick={{ fill: '#6B7280', fontSize: 11, fontWeight: 500 }}
                  interval={4}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#6B7280', fontSize: 11, fontWeight: 500 }}
                />
                <Tooltip content={<CustomTooltip />} />
                {platformFilter === 'all' ? (
                  <Bar
                    dataKey="total"
                    fill="#1F6D52"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={22}
                  />
                ) : (
                  <>
                    <Bar
                      dataKey="tiktok"
                      stackId="a"
                      fill="#111827"
                      maxBarSize={22}
                    />
                    <Bar
                      dataKey="instagram"
                      stackId="a"
                      fill="#E11D48"
                      maxBarSize={22}
                    />
                    <Bar
                      dataKey="facebook"
                      stackId="a"
                      fill="#2563EB"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={22}
                    />
                  </>
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Legend / Guidance footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-2 border-t border-[#DDD7CD] text-xs">
          <div className="flex items-center gap-4">
            {platformFilter === 'all' ? (
              <div className="flex items-center gap-1.5 font-medium text-[#0F172A]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1F6D52]"></span>
                <span>All Published Posts</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 font-medium text-[#111827]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#111827]"></span>
                  <span>TikTok</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium text-[#E11D48]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E11D48]"></span>
                  <span>Instagram Reels</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium text-[#2563EB]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]"></span>
                  <span>Facebook Page</span>
                </div>
              </>
            )}
          </div>

          <div className="font-mono text-xs text-[#0F172A]/60 font-medium">
            {chartData[0]?.label} — {chartData[chartData.length - 1]?.label} (30 Days)
          </div>
        </div>
      </div>
    </div>
  );
};
