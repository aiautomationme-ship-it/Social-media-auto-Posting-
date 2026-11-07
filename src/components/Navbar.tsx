import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Video,
  CalendarDays,
  History,
  Settings,
  Sparkles,
  Clock,
} from 'lucide-react';

export type AppTab = 'dashboard' | 'videos' | 'calendar' | 'history' | 'settings' | 'create';

interface NavbarProps {
  currentTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onOpenCreatePost?: () => void;
  userEmail?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
}) => {
  const getFormattedRealTime = () => {
    const now = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return {
      day: dayNames[now.getDay()],
      date: now.getDate(),
      month: monthNames[now.getMonth()],
      year: now.getFullYear(),
      time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
    };
  };

  const [realTime, setRealTime] = useState(getFormattedRealTime());

  useEffect(() => {
    const timer = setInterval(() => {
      setRealTime(getFormattedRealTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // The 5 primary navigation categories
  const navItems = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'videos' as const, label: 'Video Library', icon: Video },
    { id: 'calendar' as const, label: 'Publishing Calendar', icon: CalendarDays },
    { id: 'history' as const, label: 'Publishing History', icon: History },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <header className="bg-[#F8F6F1] border-b border-[#DDD7CD] sticky top-0 z-40 text-[#0F172A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 py-2">
          {/* Brand Logo & Title (v2.0 badge removed as requested) */}
          <div
            className="flex items-center space-x-3 cursor-pointer select-none shrink-0"
            onClick={() => onSelectTab('dashboard')}
          >
            <div className="w-10 h-10 rounded-xl bg-[#1F6D52] flex items-center justify-center text-white shadow-2xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-[#0F172A] block leading-tight">
                SocialFlow
              </span>
            </div>
          </div>

          {/* Desktop Nav Items - Spanning the line with larger, highly visible bold text */}
          <nav className="hidden md:flex items-center flex-1 ml-6 lg:ml-10 max-w-4xl grid grid-cols-5 gap-2 lg:gap-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-sm lg:text-[15px] font-bold transition cursor-pointer shadow-2xs whitespace-nowrap ${
                    isActive
                      ? 'bg-[#1F6D52] text-white shadow-sm ring-1 ring-[#185741]'
                      : 'bg-[#F4F1EB] text-[#0F172A] hover:bg-[#EAE4D9] hover:text-[#0F172A] border border-[#DDD7CD]'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-[#1F6D52]'}`} />
                  <span className="tracking-tight">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Area: Real-Time Live Clock Widget only (removed Create & Schedule button and email badge as requested) */}
          <div className="hidden xl:flex items-center ml-4 shrink-0">
            <div className="flex items-center space-x-2 bg-[#F4F1EB] border border-[#DDD7CD] py-2 px-3 rounded-xl text-xs font-mono shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1F6D52]"></span>
              </span>
              <span className="font-bold text-[#0F172A]">
                {realTime.day}, {realTime.date} {realTime.month}
              </span>
              <span className="text-[#DDD7CD]">|</span>
              <span className="font-bold text-[#1F6D52]">{realTime.time}</span>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Bar (Hidden on Desktop) - Updated with larger, clearly visible labels */}
        <div className="md:hidden flex items-center justify-around py-2.5 border-t border-[#DDD7CD] overflow-x-auto space-x-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex flex-col items-center px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition ${
                  isActive
                    ? 'bg-[#1F6D52] text-white shadow-2xs'
                    : 'text-[#0F172A] hover:bg-[#F4F1EB]'
                }`}
              >
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-white' : 'text-[#1F6D52]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
