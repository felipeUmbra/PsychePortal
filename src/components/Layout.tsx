import React, { useState, useEffect } from 'react';
import { Outlet, Navigate, useNavigate, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import { auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useTranslation } from 'react-i18next';
import { LogOut, AlertTriangle, ExternalLink, X, Menu } from 'lucide-react';

export default function Layout() {
  const [user, loading] = useAuthState(auth);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [authError, setAuthError] = useState<{ status: number; message?: string; service: string } | null>(null);

  useEffect(() => {
    const handleAuthError = async (e: any) => {
      // Caso 401 Unauthorized / Expired ou 403 Forbidden
      if (e.detail?.status === 401 || e.detail?.status === 403) {
         // Auto save the draft before logout happens if possible, although React handles it
         await auth.signOut();
      } else {
         setAuthError(e.detail);
      }
    };
    const handleAuthSuccess = () => {
      setAuthError(null);
    };
    window.addEventListener('google-auth-error', handleAuthError);
    window.addEventListener('google-auth-success', handleAuthSuccess);
    return () => {
      window.removeEventListener('google-auth-error', handleAuthError);
      window.removeEventListener('google-auth-success', handleAuthSuccess);
    };
  }, []);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-custom"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen bg-bg relative">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {authError && (
          <div className="bg-amber-50 border-b border-amber-200 px-8 py-2.5 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[13px] text-amber-800 font-bold">
                  {authError.status === 403 
                    ? t('layout.auth_missing_scopes', 'Acesso negado: Certifique-se de MARCAR TODAS AS CAIXAS de permissão na tela do Google ao autorizar.') 
                    : t('layout.auth_expired', 'Sua sessão com o Google expirou ou as permissões foram revogadas.')}
                </p>
                {authError.message && (
                  <p className="text-[11px] text-amber-700 font-medium leading-tight">
                    Google diz: {authError.message}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link 
                to="/app/settings" 
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-[12px] font-bold transition-colors"
                onClick={() => setAuthError(null)}
              >
                Configurações
                <ExternalLink className="w-3 h-3" />
              </Link>
              <button 
                onClick={() => setAuthError(null)}
                className="p-1.5 hover:bg-amber-100 rounded-lg text-amber-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        <header className="h-16 bg-surface border-b border-border-custom flex items-center justify-between px-4 sm:px-8 shrink-0">
          <div className="flex flex-col">
            <span className="text-[14px] font-semibold text-text-main">{t('layout.workspace', 'Workspace')}</span>
            <span className="text-[11px] text-text-muted uppercase tracking-wider font-bold">Workspace v1.0.4</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-4 hover:opacity-80 transition-opacity"
              >
                <div className="flex flex-col items-end hidden sm:flex">
                  <span className="text-[13px] font-semibold text-text-main">{user.displayName}</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-accent-custom border border-border-custom flex items-center justify-center text-[12px] font-bold text-primary-custom overflow-hidden">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    user.displayName?.charAt(0) || 'P'
                  )}
                </div>
              </button>
              
              {isUserMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-border-custom rounded-xl shadow-lg z-50 p-2">
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 rounded-lg transition-colors font-bold"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('sidebar.logout', 'Logout')}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 hover:bg-bg rounded-lg text-text-muted transition-colors"
              aria-label="Toggle Menu"
            >
              {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
