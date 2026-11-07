import React, { useState } from 'react';
import {
  Target,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  Compass,
} from 'lucide-react';
import type { MonthlyTarget } from '../types/index.ts';

interface MonthlyTargetCardProps {
  target: MonthlyTarget | null;
  targetCount: number;
  confirmedPublishedCount: number;
  remainingPostsNeeded: number;
  progressPercentage: number;
  selectedMonth: number;
  selectedYear: number;
  onSelectDate: (month: number, year: number) => void;
  onSaveTarget: (targetCount: number) => Promise<void>;
  onDeleteTarget: (targetId: string) => Promise<void>;
  isLoading?: boolean;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const MonthlyTargetCard: React.FC<MonthlyTargetCardProps> = ({
  target,
  targetCount,
  confirmedPublishedCount,
  remainingPostsNeeded,
  progressPercentage,
  selectedMonth,
  selectedYear,
  onSelectDate,
  onSaveTarget,
  onDeleteTarget,
  isLoading = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Date and pacing math
  const now = new Date();
  const isCurrentMonth =
    now.getMonth() + 1 === selectedMonth && now.getFullYear() === selectedYear;
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const currentDay = isCurrentMonth ? now.getDate() : selectedMonth < now.getMonth() + 1 ? daysInMonth : 1;
  const daysRemaining = isCurrentMonth ? Math.max(0, daysInMonth - currentDay) : daysInMonth;

  // Pace calculations
  const expectedPaceCount = Math.round((currentDay / daysInMonth) * (targetCount || 1));
  const isAheadOrOnTrack = confirmedPublishedCount >= expectedPaceCount;
  const postsPerWeekNeeded =
    daysRemaining > 0 ? ((remainingPostsNeeded / daysRemaining) * 7).toFixed(1) : '0';

  // Month navigation
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      onSelectDate(12, selectedYear - 1);
    } else {
      onSelectDate(selectedMonth - 1, selectedYear);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      onSelectDate(1, selectedYear + 1);
    } else {
      onSelectDate(selectedMonth + 1, selectedYear);
    }
  };

  const handleStartCreateOrEdit = () => {
    setInputValue(target ? String(target.targetCount) : '20');
    setInputError(null);
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const count = parseInt(inputValue.trim(), 10);
    if (isNaN(count) || count <= 0) {
      setInputError('Target must be a positive number greater than 0.');
      return;
    }
    if (count > 1000) {
      setInputError('Target cannot exceed 1,000 posts for a single month.');
      return;
    }

    try {
      setActionLoading(true);
      setInputError(null);
      await onSaveTarget(count);
      setIsEditing(false);
    } catch (err: any) {
      setInputError(err?.message || 'Failed to save monthly target.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!target) return;
    try {
      setActionLoading(true);
      await onDeleteTarget(target.id);
      setShowDeleteConfirm(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete target');
    } finally {
      setActionLoading(false);
    }
  };

  const monthName = MONTH_NAMES[selectedMonth - 1];

  return (
    <div className="bg-[#F4F1EB] border border-[#DDD7CD] rounded-2xl p-6 sm:p-7 shadow-xs">
      {/* Month & Year Navigation Header with Executive Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#DDD7CD]">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#1F6D52]/10 border border-[#1F6D52]/20 flex items-center justify-center text-[#1F6D52] shadow-2xs">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-[#0F172A] tracking-tight">
                Monthly Publishing Target
              </h2>
              {target ? (
                <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {remainingPostsNeeded === 0 ? 'Goal Achieved' : 'Active Goal'}
                </span>
              ) : (
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-[#F8F6F1] text-[#0F172A]/60 border border-[#DDD7CD]">
                  Unset
                </span>
              )}
            </div>
            <p className="text-xs text-[#0F172A]/70 mt-0.5">
              Strictly tracks confirmed, published posts. Scheduled or draft content is excluded.
            </p>
          </div>
        </div>

        {/* Real-time Indicator & Date Selector Navigation Well */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {!isCurrentMonth && (
            <button
              onClick={() => onSelectDate(now.getMonth() + 1, now.getFullYear())}
              className="text-[11px] font-bold text-[#1F6D52] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-xl transition cursor-pointer"
            >
              Jump to Current Month ({MONTH_NAMES[now.getMonth()]} {now.getFullYear()})
            </button>
          )}

          <div className="flex items-center space-x-1.5 bg-[#F8F6F1] p-1.5 rounded-xl border border-[#DDD7CD] shadow-2xs">
            <button
              onClick={handlePrevMonth}
              disabled={isLoading}
              className="p-1.5 rounded-lg hover:bg-[#F4F1EB] text-[#0F172A] transition disabled:opacity-50 cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-3 py-1 flex items-center space-x-1.5 font-semibold text-xs sm:text-sm text-[#0F172A]">
              <Calendar className="w-3.5 h-3.5 text-[#1F6D52]" />
              <span>{monthName}</span>
              <span className="text-[#0F172A]/60 font-normal">{selectedYear}</span>
            </div>

            <button
              onClick={handleNextMonth}
              disabled={isLoading}
              className="p-1.5 rounded-lg hover:bg-[#F4F1EB] text-[#0F172A] transition disabled:opacity-50 cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Target Content Body */}
      <div className="pt-6">
        {isEditing ? (
          /* Create / Edit Form in interior well */
          <form
            onSubmit={handleSave}
            className="space-y-4 max-w-lg bg-[#F8F6F1] p-5 sm:p-6 rounded-2xl border border-[#DDD7CD] shadow-2xs"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-[#0F172A]">
                  Target publishing goal for {monthName} {selectedYear}
                </label>
                <span className="text-[11px] text-[#0F172A]/60 font-mono">Positive integer</span>
              </div>

              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="e.g. 24"
                  className="w-full bg-[#F4F1EB] border border-[#DDD7CD] rounded-xl px-4 py-2.5 text-[#0F172A] font-mono text-base font-semibold focus:outline-none focus:border-[#1F6D52] focus:ring-1 focus:ring-[#1F6D52] shadow-2xs"
                  autoFocus
                />
                <span className="absolute right-4 top-3 text-xs font-medium text-[#0F172A]/50">
                  posts
                </span>
              </div>

              {/* Quick Preset Chips */}
              <div className="flex items-center space-x-2 mt-2.5">
                <span className="text-[11px] text-[#0F172A]/60">Presets:</span>
                {[12, 20, 30, 45].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setInputValue(String(preset))}
                    className="px-2.5 py-1 text-xs rounded-lg bg-[#F4F1EB] border border-[#DDD7CD] text-[#0F172A] hover:border-[#1F6D52] hover:text-[#1F6D52] transition cursor-pointer font-mono"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {inputError && (
                <p className="mt-2 text-xs text-rose-700 flex items-center gap-1 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {inputError}
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2.5 pt-1">
              <button
                type="submit"
                disabled={actionLoading}
                className="px-5 py-2.5 bg-[#1F6D52] hover:bg-[#185741] text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? 'Saving...' : target ? 'Save Target' : 'Create Target'}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={actionLoading}
                className="px-4 py-2.5 bg-[#F4F1EB] hover:bg-[#F8F6F1] border border-[#DDD7CD] text-[#0F172A] rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : target ? (
          /* Active Target Progress Display */
          <div className="space-y-6">
            {/* 3 Metric Cards with layered interior wells */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Target Goal */}
              <div className="bg-[#F8F6F1] border border-[#DDD7CD] hover:border-[#BD7131]/40 transition-all rounded-xl p-4.5 shadow-2xs">
                <div className="flex items-center justify-between text-[#0F172A]/70 text-xs mb-1.5">
                  <span className="font-semibold text-[#0F172A]">Monthly Goal</span>
                  <div className="w-6 h-6 rounded-lg bg-[#F4F1EB] border border-[#DDD7CD] flex items-center justify-center text-[#1F6D52]">
                    <Target className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-[#0F172A] font-mono tracking-tight">
                  {targetCount}
                </div>
                <p className="text-[11px] text-[#0F172A]/60 mt-1 font-medium">Confirmed posts goal</p>
              </div>

              {/* Confirmed Published */}
              <div className="bg-[#F8F6F1] border border-[#DDD7CD] hover:border-[#1F6D52]/40 transition-all rounded-xl p-4.5 shadow-2xs">
                <div className="flex items-center justify-between text-[#0F172A]/70 text-xs mb-1.5">
                  <span className="font-semibold text-[#0F172A]">Confirmed Published</span>
                  <div className="w-6 h-6 rounded-lg bg-[#F4F1EB] border border-[#DDD7CD] flex items-center justify-center text-[#1F6D52]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-[#1F6D52] font-mono tracking-tight">
                  {confirmedPublishedCount}
                </div>
                <p className="text-[11px] text-[#0F172A]/60 mt-1 font-medium">
                  {confirmedPublishedCount === 0
                    ? 'No posts published yet'
                    : `${progressPercentage}% of monthly target`}
                </p>
              </div>

              {/* Remaining Needed */}
              <div className="bg-[#F8F6F1] border border-[#DDD7CD] hover:border-[#BD7131]/40 transition-all rounded-xl p-4.5 shadow-2xs">
                <div className="flex items-center justify-between text-[#0F172A]/70 text-xs mb-1.5">
                  <span className="font-semibold text-[#0F172A]">Remaining to Target</span>
                  <div className="w-6 h-6 rounded-lg bg-[#F4F1EB] border border-[#DDD7CD] flex items-center justify-center text-[#BD7131]">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-[#0F172A] font-mono tracking-tight">
                  {remainingPostsNeeded}
                </div>
                <p className="text-[11px] text-[#0F172A]/60 mt-1 font-medium">
                  {remainingPostsNeeded === 0
                    ? 'Target accomplished!'
                    : `Needs ~${postsPerWeekNeeded} posts/week`}
                </p>
              </div>
            </div>

            {/* Smart Pacing Bar & Progress Visualizer */}
            <div className="bg-[#F8F6F1] p-5 rounded-2xl border border-[#DDD7CD] space-y-3.5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-[#1F6D52]" />
                  <span className="text-xs font-bold text-[#0F172A]">Publishing Trajectory</span>
                  {remainingPostsNeeded === 0 ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Completed 100%
                    </span>
                  ) : isAheadOrOnTrack ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      On Track
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                      Pacing behind
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-3 text-xs font-mono">
                  <span className="text-[#0F172A]/70 font-medium">
                    {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left in {monthName}
                  </span>
                  <span className="text-[#D1D5DB]">|</span>
                  <span
                    className="font-black text-[#111827] text-xl sm:text-2xl tracking-tight"
                    style={{
                      textShadow: '0 0 16px rgba(17, 24, 39, 0.22), 0 0 4px rgba(17, 24, 39, 0.12)',
                    }}
                  >
                    {progressPercentage}%
                  </span>
                </div>
              </div>

              {/* Enhanced Progress Track with Milestones */}
              <div className="space-y-1.5">
                <div className="relative w-full h-3.5 bg-[#DDD7CD]/70 rounded-full overflow-hidden p-0.5 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-[#1F6D52] to-emerald-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, progressPercentage))}%` }}
                  />
                </div>
                {/* Milestone Indicators */}
                <div className="flex justify-between text-[10px] text-[#0F172A]/60 font-mono font-medium px-1">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100% ({targetCount} posts)</span>
                </div>
              </div>
            </div>

            {/* Target Actions & Metadata Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#DDD7CD]">
              <div className="flex items-center space-x-2 text-[11px] text-[#0F172A]/60">
                <Compass className="w-3.5 h-3.5 text-[#0F172A]/40" />
                <span className="font-mono">
                  Target created {new Date(target.createdAt).toLocaleDateString()}
                  {target.updatedAt !== target.createdAt &&
                    ` • Updated ${new Date(target.updatedAt).toLocaleDateString()}`}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleStartCreateOrEdit}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-[#F8F6F1] hover:bg-[#F4F1EB] border border-[#DDD7CD] text-[#0F172A] text-xs font-semibold transition cursor-pointer shadow-2xs"
                >
                  <Pencil className="w-3.5 h-3.5 text-[#1F6D52]" />
                  <span>Edit Target</span>
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold transition cursor-pointer shadow-2xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Empty State when no target exists for month */
          <div className="text-center py-10 px-4 bg-[#F8F6F1] border border-dashed border-[#DDD7CD] rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-[#F4F1EB] flex items-center justify-center mx-auto text-[#1F6D52] mb-3 border border-[#DDD7CD] shadow-2xs">
              <Target className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#0F172A]">
              No target configured for {monthName} {selectedYear}
            </h3>
            <p className="text-xs text-[#0F172A]/70 max-w-md mx-auto mt-1 mb-5">
              Set a monthly publishing target to track confirmed live posts across TikTok,
              Instagram Reels, and Facebook Pages.
            </p>
            <button
              onClick={handleStartCreateOrEdit}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[#1F6D52] hover:bg-[#185741] text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Set Target for {monthName}</span>
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-[#F8F6F1] border border-[#DDD7CD] rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-[#0F172A] mb-2">Delete Monthly Target?</h3>
            <p className="text-xs text-[#0F172A]/70 mb-6">
              Are you sure you want to delete the target of {target?.targetCount} posts for{' '}
              {monthName} {selectedYear}? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0F172A] hover:bg-[#F4F1EB] transition border border-[#DDD7CD] cursor-pointer"
              >
                Keep Target
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 transition shadow-xs cursor-pointer"
              >
                {actionLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
