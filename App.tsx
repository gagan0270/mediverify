
import React, { useState, createContext, useContext, useEffect, useMemo } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { UserProfile, VerificationResult, Language } from './types';
import { Card, Button, Badge } from './components/UI';
import Dashboard from './features/Dashboard';
import HealthProfileWizard from './features/HealthProfileWizard';
import MedicineVerificationFlow from './features/MedicineVerificationFlow';
import ReportAnalysisFlow from './features/ReportAnalysisFlow';
import History from './features/History';
import HealthAssistant from './features/HealthAssistant';
import PillVisualizer from './features/PillVisualizer';
import MedicineRates from './features/MedicineRates';
import { translations } from './translations';

type Theme = 'light' | 'dark';

const LanguageContext = createContext<{ language: Language; setLanguage: (l: Language) => void; t: any }>({
  language: 'en',
  setLanguage: () => {},
  t: translations.en
});

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void }>({
  theme: 'light',
  toggleTheme: () => {}
});

export const useLanguage = () => useContext(LanguageContext);
export const useTheme = () => useContext(ThemeContext);

const SplashScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [status, setStatus] = useState('Verifying session...');
  
  useEffect(() => {
    let active = true;
    const init = async () => {
      await new Promise(r => setTimeout(r, 1000));
      if (!active) return;

      if (typeof (window as any).aistudio?.hasSelectedApiKey === 'function') {
        try {
          const hasKey = await (window as any).aistudio.hasSelectedApiKey();
          if (!hasKey) {
            setStatus('Connecting to AI Studio...');
            (window as any).aistudio.openSelectKey();
          }
        } catch (e) {
          console.error("Auth check skipped", e);
        }
      }
      
      if (active) onComplete();
    };
    init();
    return () => { active = false; };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-[200] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
      <div className="relative mb-8">
        <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white text-4xl shadow-2xl animate-bounce">
          <i className="fas fa-shield-heart"></i>
        </div>
        <div className="absolute -inset-4 border-2 border-blue-200 dark:border-blue-900 rounded-[2.5rem] animate-pulse"></div>
      </div>
      <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter mb-2">MediVerify</h1>
      <div className="flex items-center gap-3 text-blue-600 font-bold uppercase tracking-widest text-[9px]">
         <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></div>
         <span>{status}</span>
      </div>
    </div>
  );
};

const ProtectedRoute: React.FC<{ user: UserProfile | null; children: React.ReactNode }> = ({ user, children }) => {
  if (!user) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [isInitializing, setIsInitializing] = useState(true);

  // Global error handler for 'Requested entity was not found.' to re-prompt API key selection
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const errorMessage = event.reason?.message || '';
      if (errorMessage.includes('Requested entity was not found.')) {
        if (typeof (window as any).aistudio?.openSelectKey === 'function') {
          (window as any).aistudio.openSelectKey();
        }
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);

  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('medi_verify_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.fullName) return parsed;
      }
    } catch (e) {
      console.error("Profile recovery failed", e);
    }
    return null;
  });

  const [history, setHistory] = useState<VerificationResult[]>(() => {
    try {
      const saved = localStorage.getItem('medi_verify_history');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const handleInitComplete = () => {
    setIsInitializing(false);
  };

  const handleProfileComplete = (profile: UserProfile) => {
    localStorage.setItem('medi_verify_profile', JSON.stringify(profile));
    setUser(profile);
  };

  const handleVerificationComplete = (result: VerificationResult) => {
    const newHistory = [result, ...history];
    setHistory(newHistory);
    localStorage.setItem('medi_verify_history', JSON.stringify(newHistory));
  };

  if (isInitializing) {
    return <SplashScreen onComplete={handleInitComplete} />;
  }

  return (
    <div className="min-h-screen flex flex-col pb-24 md:pb-0 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-4 py-3 sm:px-8 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="bg-blue-600 p-2.5 rounded-xl text-white transform group-hover:scale-105 transition-transform shadow-lg shadow-blue-500/20">
              <i className="fas fa-prescription-bottle-medical text-lg"></i>
            </div>
            <div>
              <span className="font-black text-lg tracking-tighter text-slate-900 dark:text-white block leading-none">MediVerify</span>
              <span className="text-[7px] font-black uppercase text-blue-500 tracking-[0.2em]">Clinical Safety AI</span>
            </div>
          </Link>
          
          <div className="flex items-center gap-3">
             <div className="hidden lg:flex items-center gap-6 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mr-6">
                <Link to="/" className="hover:text-blue-600 transition-colors">Home</Link>
                <Link to="/history" className="hover:text-blue-600 transition-colors">History</Link>
                <Link to="/assistant" className="hover:text-blue-600 transition-colors">AI Docs</Link>
             </div>

             <button 
                onClick={toggleTheme}
                className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
                aria-label="Toggle dark mode"
             >
                <i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'} text-sm`}></i>
             </button>

             <div className="bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center p-0.5 border border-slate-200 dark:border-slate-700">
               {(['en', 'hi', 'es'] as Language[]).map(l => (
                 <button 
                   key={l}
                   onClick={() => setLanguage(l)}
                   className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black transition-all ${language === l ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}
                 >{l.toUpperCase()}</button>
               ))}
             </div>

             {user && (
               <Link to="/profile" className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shadow-lg hover:opacity-90 transition-all">
                  <i className="fas fa-user-circle text-lg"></i>
               </Link>
             )}
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto max-w-7xl px-4 py-6 sm:py-8">
        <Routes>
          <Route path="/" element={<ProtectedRoute user={user}><Dashboard user={user!} history={history} /></ProtectedRoute>} />
          <Route path="/onboarding" element={user ? <Navigate to="/" replace /> : <HealthProfileWizard onComplete={handleProfileComplete} />} />
          <Route path="/verify" element={<ProtectedRoute user={user}><MedicineVerificationFlow user={user!} onComplete={handleVerificationComplete} /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute user={user}><ReportAnalysisFlow user={user!} /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute user={user}><History history={history} /></ProtectedRoute>} />
          <Route path="/assistant" element={<ProtectedRoute user={user}><HealthAssistant /></ProtectedRoute>} />
          <Route path="/visualizer" element={<ProtectedRoute user={user}><PillVisualizer /></ProtectedRoute>} />
          <Route path="/rates" element={<ProtectedRoute user={user}><MedicineRates /></ProtectedRoute>} />
          
          <Route path="/profile" element={<ProtectedRoute user={user}>
            <div className="max-w-2xl mx-auto animate-in slide-in-from-bottom-8 duration-500">
              <Card title="Patient Profile" className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
                <div className="space-y-6">
                   <div className="p-8 bg-blue-600 text-white rounded-[2rem] shadow-xl shadow-blue-500/20 relative">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/30 text-3xl">
                           <i className="fas fa-id-card"></i>
                        </div>
                        <div>
                           <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Identity Profile</p>
                           <p className="font-black text-2xl tracking-tight leading-none">{user?.fullName || 'Active Patient'}</p>
                        </div>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Born</p>
                        <p className="font-black text-slate-800 dark:text-slate-200">{user?.dob}</p>
                      </div>
                      <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Type</p>
                        <Badge color="red" className="text-[10px] px-3">{user?.bloodType}</Badge>
                      </div>
                   </div>

                   <Button variant="ghost" className="w-full text-red-500 font-black py-4 border-2 border-dashed border-red-50 dark:border-red-900/30 rounded-2xl" onClick={() => { if(confirm("This will clear your health data. Logout?")) { localStorage.clear(); window.location.reload(); } }}>
                     <i className="fas fa-power-off mr-2"></i>Sign Out & Reset
                   </Button>
                </div>
              </Card>
            </div>
          </ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <nav className="md:hidden fixed bottom-6 left-6 right-6 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-2xl border border-white/10 p-4 flex justify-between items-center z-[100] rounded-[2.5rem] shadow-2xl">
        <Link to="/" className="flex flex-col items-center gap-1 flex-1 text-slate-500 hover:text-white transition-colors">
          <i className="fas fa-house-chimney text-lg"></i>
          <span className="text-[8px] font-black uppercase tracking-widest">Home</span>
        </Link>
        <Link to="/history" className="flex flex-col items-center gap-1 flex-1 text-slate-400 hover:text-white transition-colors">
          <i className="fas fa-clock-rotate-left text-lg"></i>
          <span className="text-[8px] font-black uppercase tracking-widest">History</span>
        </Link>
        
        <div className="relative -mt-16 mx-4">
          <Link to="/verify" className="flex flex-col items-center group">
            <div className="pulse-button bg-blue-600 text-white w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/50 border-4 border-slate-50 dark:border-slate-950 transform active:scale-95 transition-all">
              <i className="fas fa-plus text-2xl"></i>
            </div>
          </Link>
        </div>

        <Link to="/assistant" className="flex flex-col items-center gap-1 flex-1 text-slate-400 hover:text-white transition-colors">
          <i className="fas fa-brain text-lg"></i>
          <span className="text-[8px] font-black uppercase tracking-widest">AI Docs</span>
        </Link>
        <Link to="/profile" className="flex flex-col items-center gap-1 flex-1 text-slate-400 hover:text-white transition-colors">
          <i className="fas fa-user text-lg"></i>
          <span className="text-[8px] font-black uppercase tracking-widest">Me</span>
        </Link>
      </nav>
    </div>
  );
};

const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('medi_verify_lang');
    return (saved as Language) || 'en';
  });

  const handleSetLanguage = (l: Language) => {
    setLanguage(l);
    localStorage.setItem('medi_verify_lang', l);
  };

  const value = useMemo(() => ({
    language,
    setLanguage: handleSetLanguage,
    t: (translations as any)[language]
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageProvider>;
};

const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('medi_verify_theme');
    return (saved as Theme) || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('medi_verify_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const value = useMemo(() => ({ theme, toggleTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

const App: React.FC = () => (
  <HashRouter>
    <ThemeProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </ThemeProvider>
  </HashRouter>
);

export default App;
