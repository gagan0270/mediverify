
import React, { useState, createContext, useContext, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { UserProfile, VerificationResult, Language } from './types';
import { Card, Button, Badge } from './components/UI';
import Dashboard from './features/Dashboard';
import HealthProfileWizard from './features/HealthProfileWizard';
import MedicineVerificationFlow from './features/MedicineVerificationFlow';
import History from './features/History';
import HealthAssistant from './features/HealthAssistant';
import PillVisualizer from './features/PillVisualizer';
import MedicineRates from './features/MedicineRates';
import { translations } from './translations';

const LanguageContext = createContext<{ language: Language; setLanguage: (l: Language) => void; t: any }>({
  language: 'en',
  setLanguage: () => {},
  t: translations.en
});

export const useLanguage = () => useContext(LanguageContext);

const SplashScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [status, setStatus] = useState('Initializing secure session...');
  
  useEffect(() => {
    const init = async () => {
      // Small delay to show brand identity
      await new Promise(r => setTimeout(r, 1200));
      setStatus('Verifying AI credentials...');
      
      // Check if user has selected an API key for Pro features (Veo/Imagen/Pro)
      if (typeof (window as any).aistudio?.hasSelectedApiKey === 'function') {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
          setStatus('Awaiting AI Studio key selection...');
          // This will open the dialog; app resumes once chosen
          await (window as any).aistudio.openSelectKey();
        }
      }
      
      setStatus('Restoring health profile...');
      await new Promise(r => setTimeout(r, 800));
      onComplete();
    };
    init();
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-white z-[200] flex flex-col items-center justify-center p-8 text-center space-y-8 animate-in fade-in duration-500">
      <div className="relative">
        <div className="w-24 h-24 bg-blue-600 rounded-[2.5rem] flex items-center justify-center text-white text-4xl shadow-2xl animate-bounce">
          <i className="fas fa-prescription-bottle-medical"></i>
        </div>
        <div className="absolute -inset-4 border-2 border-blue-100 rounded-[3.5rem] animate-pulse"></div>
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter">MediVerify</h1>
        <div className="flex items-center gap-2 justify-center text-blue-600 font-bold uppercase tracking-widest text-[10px]">
           <i className="fas fa-shield-halved"></i>
           <span>{status}</span>
        </div>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const [isInitializing, setIsInitializing] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('medi_verify_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
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

  const location = useLocation();

  const handleProfileComplete = (profile: UserProfile) => {
    setUser(profile);
    localStorage.setItem('medi_verify_profile', JSON.stringify(profile));
  };

  const handleVerificationComplete = (result: VerificationResult) => {
    const newHistory = [result, ...history];
    setHistory(newHistory);
    localStorage.setItem('medi_verify_history', JSON.stringify(newHistory));
  };

  if (isInitializing) {
    return <SplashScreen onComplete={() => setIsInitializing(false)} />;
  }

  if (!user && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-0">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="bg-blue-600 p-2 rounded-xl text-white transform group-hover:rotate-12 transition-transform">
              <i className="fas fa-prescription-bottle-medical"></i>
            </div>
            <span className="font-black text-xl tracking-tight text-slate-900">MediVerify</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-500">
            <Link to="/" className="hover:text-blue-600 transition-colors">{t.dashboard}</Link>
            <Link to="/history" className="hover:text-blue-600 transition-colors">{t.history}</Link>
            <Link to="/assistant" className="hover:text-blue-600 transition-colors">{t.assistant}</Link>
            <Link to="/visualizer" className="hover:text-blue-600 transition-colors">{t.visualizer}</Link>
            <Link to="/rates" className="hover:text-blue-600 transition-colors">{t.medicine_rates}</Link>
          </nav>

          <div className="flex items-center gap-4">
             <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-green-50 text-green-600 rounded-lg border border-green-100">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-[10px] font-black uppercase tracking-widest">Account Active</span>
             </div>

             <select 
               value={language} 
               onChange={(e) => setLanguage(e.target.value as Language)}
               className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold px-2 py-1 outline-none"
             >
               <option value="en">EN</option>
               <option value="hi">HI</option>
               <option value="es">ES</option>
             </select>

             <Link to="/profile" className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 overflow-hidden border-2 border-white shadow-sm hover:bg-slate-300 transition-colors">
                <i className="fas fa-user"></i>
             </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto max-w-7xl px-4 py-6 sm:py-8">
        <Routes>
          <Route path="/" element={<Dashboard user={user!} history={history} />} />
          <Route path="/onboarding" element={<HealthProfileWizard onComplete={handleProfileComplete} />} />
          <Route path="/verify" element={<MedicineVerificationFlow user={user!} onComplete={handleVerificationComplete} />} />
          <Route path="/history" element={<History history={history} />} />
          <Route path="/assistant" element={<HealthAssistant />} />
          <Route path="/visualizer" element={<PillVisualizer />} />
          <Route path="/rates" element={<MedicineRates />} />
          <Route path="/profile" element={
            <div className="max-w-2xl mx-auto space-y-6">
              <Card title={t.profile}>
                <div className="space-y-6">
                   <div className="flex items-center justify-between p-4 bg-blue-50 rounded-2xl border border-blue-100">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                           <i className="fas fa-shield-check text-xl"></i>
                        </div>
                        <div>
                           <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none">Session Status</p>
                           <p className="font-black text-blue-800 text-sm">Authenticated & Persistent</p>
                        </div>
                      </div>
                      <Badge color="green">Live</Badge>
                   </div>

                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <p className="text-xs text-slate-400 font-black uppercase tracking-widest mb-1">{t.personal_info}</p>
                        <p className="font-bold text-slate-800 text-lg">{user?.fullName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-black uppercase tracking-widest mb-1">DOB</p>
                        <p className="font-bold text-slate-800 text-lg">{user?.dob}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-black uppercase tracking-widest mb-1">Blood Type</p>
                        <Badge color="red">{user?.bloodType}</Badge>
                      </div>
                   </div>
                   <div className="pt-6 border-t border-slate-100">
                     <p className="text-xs text-slate-400 font-black uppercase tracking-widest mb-3">{t.conditions}</p>
                     <div className="flex flex-wrap gap-2">
                        {user?.medicalConditions?.map(c => <Badge key={c} color="blue">{c}</Badge>)}
                     </div>
                   </div>
                   <div className="pt-6 border-t border-slate-100">
                     <p className="text-xs text-slate-400 font-black uppercase tracking-widest mb-3">{t.allergies}</p>
                     <div className="flex flex-wrap gap-2">
                        {user?.allergies?.map(a => <Badge key={a} color="yellow">{a}</Badge>)}
                     </div>
                   </div>
                   <div className="pt-6 border-t border-slate-100">
                      <p className="text-xs text-slate-400 font-black uppercase tracking-widest mb-3">{t.emergency_contact}</p>
                      <div className="bg-slate-50 p-4 rounded-2xl">
                        <p className="text-sm font-black text-slate-800">{user?.emergencyContact.name}</p>
                        <p className="text-sm font-black text-blue-600">{user?.emergencyContact.phone}</p>
                      </div>
                   </div>
                   <Button variant="ghost" className="w-full text-red-500 hover:bg-red-50" onClick={() => { if(confirm("This will log you out and clear all health data. Continue?")) { localStorage.removeItem('medi_verify_profile'); localStorage.removeItem('medi_verify_history'); window.location.reload(); } }}>
                     <i className="fas fa-sign-out-alt mr-2"></i>Logout & Reset Session
                   </Button>
                </div>
              </Card>
            </div>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50 shadow-lg">
        <Link to="/" className="flex flex-col items-center gap-1 text-slate-400 hover:text-blue-600">
          <i className="fas fa-chart-pie text-lg"></i>
          <span className="text-[10px] font-bold">{t.home}</span>
        </Link>
        <Link to="/assistant" className="flex flex-col items-center gap-1 text-slate-400 hover:text-blue-600">
          <i className="fas fa-user-md text-lg"></i>
          <span className="text-[10px] font-bold">{t.ai_helper}</span>
        </Link>
        <Link to="/verify" className="-mt-8 bg-blue-600 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-xl border-4 border-slate-50">
          <i className="fas fa-plus text-xl"></i>
        </Link>
        <Link to="/rates" className="flex flex-col items-center gap-1 text-slate-400 hover:text-blue-600">
          <i className="fas fa-tag text-lg"></i>
          <span className="text-[10px] font-bold">Rates</span>
        </Link>
        <Link to="/history" className="flex flex-col items-center gap-1 text-slate-400 hover:text-blue-600">
          <i className="fas fa-history text-lg"></i>
          <span className="text-[10px] font-bold">{t.history}</span>
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

  const value = {
    language,
    setLanguage: handleSetLanguage,
    t: (translations as any)[language]
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

const App: React.FC = () => (
  <HashRouter>
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  </HashRouter>
);

export default App;
