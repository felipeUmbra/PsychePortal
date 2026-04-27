import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Calendar,
  History,
  Settings,
  LogOut,
  Languages,
  DollarSign
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { auth } from '../firebase';
import { cn } from '../lib/utils';
import { X } from 'lucide-react';
import { changeLanguage } from '../i18n';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const navItems = [
    { icon: LayoutDashboard, label: t('sidebar.dashboard'), path: '/app' },
    {
      icon: Users,
      label: t('sidebar.patients'),
      path: '/app/patients',
      subItems: [
        { label: t('sidebar.add_patients'), path: '/app/patients?action=add' },
        { label: t('sidebar.show_patients'), path: '/app/patients' }
      ]
    },
    {
      icon: Calendar,
      label: t('sidebar.calendar'),
      path: '/app/calendar',
      subItems: [
        { label: t('sidebar.entire_calendar'), path: '/app/calendar' },
        { label: t('sidebar.sessions_by_day'), path: '/app/calendar/daily' }
      ]
    },
    { icon: History, label: t('sidebar.sessions'), path: '/app/sessions' },
    { icon: DollarSign, label: t('sidebar.finance'), path: '/app/finance' },
    { icon: Settings, label: t('sidebar.settings'), path: '/app/settings' },
  ];

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const toggleLanguage = async () => {
    const newLang = i18n.language.startsWith('pt') ? 'en' : 'pt';
    await changeLanguage(newLang);
  };

  return (
    <aside className={cn(
      "w-60 bg-[#fcfdfe] border-r border-border-custom flex flex-col h-screen fixed lg:relative lg:translate-x-0 top-0 z-50 transition-transform duration-300 ease-in-out",
      isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
    )}>
      <div className="h-16 flex items-center justify-between gap-3 px-6 border-b border-border-custom shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-custom rounded-sm flex items-center justify-center shadow-sm">
            <Users className="text-white w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-text-main leading-tight">PsychePortal</span>
            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider w-fit">{t('sidebar.active')}</span>
          </div>
        </div>

        {/* Mobile Close Button */}
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 hover:bg-bg rounded-lg text-text-muted"
          aria-label={t('common.close', 'Close')}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 px-3 py-6 overflow-visible">
        <div className="text-[11px] uppercase text-text-muted font-bold tracking-wider mb-3 px-3">{t('sidebar.practice_management')}</div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <div key={item.path} className="relative group">
              <NavLink
                to={item.path}
                end={item.path === '/app'}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose();
                }}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-[14px] transition-all duration-200",
                  isActive
                    ? "bg-accent-custom text-primary-custom font-semibold"
                    : "text-text-main hover:bg-bg"
                )}
              >
                <item.icon className={cn(
                  "w-4 h-4 transition-colors",
                  "group-hover:text-primary-custom"
                )} />
                {item.label}
              </NavLink>

              {item.subItems && (
                <div className="absolute left-full top-0 pl-2 hidden lg:group-hover:block z-50">
                  <div className="bg-white border border-border-custom shadow-lg rounded-lg py-2 w-48">
                    {item.subItems.map((subItem) => {
                      // More precise matching for search params
                      const isActuallyActive = window.location.pathname === subItem.path.split('?')[0] &&
                        (subItem.path.includes('?')
                          ? window.location.search === '?' + subItem.path.split('?')[1]
                          : window.location.search === '');

                      return (
                        <NavLink
                          key={subItem.path}
                          to={subItem.path}
                          className={cn(
                            "block px-4 py-2 text-[13px] text-text-main transition-all",
                            "hover:bg-bg hover:text-primary-custom",
                            isActuallyActive ? "text-primary-custom font-semibold bg-accent-custom/50" : ""
                          )}
                        >
                          {subItem.label}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      <div className="p-3 border-t border-border-custom space-y-1">
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-md text-text-muted hover:bg-bg text-[14px] transition-all duration-200 group"
        >
          <Languages className="w-4 h-4 group-hover:text-primary-custom" />
          {i18n.language.startsWith('pt') ? 'English' : 'Português'}
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-md text-text-muted hover:bg-red-50 hover:text-red-600 text-[14px] transition-all duration-200 group"
        >
          <LogOut className="w-4 h-4 group-hover:text-red-600" />
          {t('sidebar.logout')}
        </button>
      </div>
    </aside>
  );
}
