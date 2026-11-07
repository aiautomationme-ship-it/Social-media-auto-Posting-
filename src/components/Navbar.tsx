import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Video,
  CalendarDays,
  History,
  Settings,
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
    <header className="bg-white/80 backdrop-blur-md border-b border-[#D1D5DB] sticky top-0 z-40 text-[#111827]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 py-2">
          {/* Brand Title (Icon removed as requested) */}
          <div
            className="flex items-center cursor-pointer select-none shrink-0"
            onClick={() => onSelectTab('dashboard')}
          >
            <div>
              <span className="text-2xl font-black tracking-tight text-[#111827] block leading-tight">
                SocialFlow
              </span>
            </div>
          </div>

          {/* Desktop Nav Items */}
          <nav className="hidden md:flex items-center flex-1 ml-6 lg:ml-10 max-w-4xl grid grid-cols-5 gap-2 lg:gap-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition cursor-pointer shadow-2xs whitespace-nowrap ${
                    isActive
                      ? 'bg-[#111827] text-white shadow-sm ring-1 ring-[#1F2937]'
                      : 'bg-[#F3F4F6]/90 text-[#111827] hover:bg-[#E5E7EB] border border-[#D1D5DB]'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-[#374151]'}`} />
                  <span className="tracking-tight">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Area: Real-Time Live Clock Widget */}
          <div className="hidden xl:flex items-center ml-4 shrink-0">
            <div className="flex items-center space-x-2 bg-[#F3F4F6]/90 border border-[#D1D5DB] py-2 px-3 rounded-xl text-xs font-mono shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gray-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#111827]"></span>
              </span>
              <span className="font-bold text-[#111827]">
                {realTime.day}, {realTime.date} {realTime.month}
              </span>
              <span className="text-[#9CA3AF]">|</span>
              <span className="font-bold text-[#374151]">{realTime.time}</span>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden flex items-center justify-around py-2.5 border-t border-[#D1D5DB] overflow-x-auto space-x-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex flex-col items-center px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition ${
                  isActive
                    ? 'bg-[#111827] text-white shadow-2xs'
                    : 'text-[#111827] hover:bg-[#F3F4F6]'
                }`}
              >
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-white' : 'text-[#374151]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
