
import React, { useState } from 'react';
import { UserProfile, VerificationResult, MatchStatus } from '../types';
import { Card, Button, Badge } from '../components/UI';
import { Link } from 'react-router-dom';
import { useLanguage } from '../App';
import { getHealthSearch } from '../services/geminiService';

interface DashboardProps {
  user: UserProfile;
  history: VerificationResult[];
}

const Dashboard: React.FC<DashboardProps> = ({ user, history }) => {
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ text: string, sources: any[] } | null>(null);
  const [searching, setSearching] = useState(false);

  const stats = {
    total: history?.length || 0,
    perfect: history?.filter(h => h.status === MatchStatus.PERFECT_MATCH).length || 0,
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults(null);
    try {
      const res = await getHealthSearch(searchQuery, language);
      setSearchResults(res);
    } catch (e) {
      alert("Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const displayName = user?.fullName ? user.fullName.split(' ')[0] : 'Patient';

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20 max-w-7xl mx-auto">
      
      <div className="px-4 space-y-2">
         <Badge color="blue" className="px-5 py-1.5 rounded-full text-[9px] uppercase tracking-[0.2em] font-black">{t.dashboard}</Badge>
         <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-slate-900 dark:text-white leading-[0.9]">
            {t.welcome}, <span className="text-blue-600 dark:text-blue-400">{displayName}!</span>
          </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="bg-white dark:bg-slate-900 rounded-[3.5rem] p-10 shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center gap-6 group">
          <div className="relative z-10 w-full space-y-4">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-[1.5rem] mx-auto flex items-center justify-center text-2xl">
              <i className="fas fa-pills"></i>
            </div>
            <h2 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white">{t.tablet_verification}</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed max-w-[250px] mx-auto">{t.analyzing}</p>
            <Link to="/verify" className="block relative pt-4">
                <Button className="h-24 w-full text-xl rounded-[2rem] bg-blue-600 text-white font-black shadow-2xl">
                   <i className="fas fa-camera mr-2"></i> {t.new_verification.toUpperCase()}
                </Button>
            </Link>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-[3.5rem] p-10 shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center gap-6 group">
          <div className="relative z-10 w-full space-y-4">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-[1.5rem] mx-auto flex items-center justify-center text-2xl">
              <i className="fas fa-file-medical"></i>
            </div>
            <h2 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white">Reports</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed max-w-[250px] mx-auto">{t.analyzing}</p>
            <Link to="/reports" className="block relative pt-4">
                <Button className="h-24 w-full text-xl rounded-[2rem] bg-indigo-600 text-white font-black shadow-2xl">
                   <i className="fas fa-microscope mr-2"></i> SCAN REPORTS
                </Button>
            </Link>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-6">
           <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] px-4">{t.total_checks}</h3>
           <div className="grid grid-cols-1 gap-4">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-xl border border-slate-50 dark:border-slate-800 flex items-center justify-between">
                 <div>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.total}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.total_checks}</p>
                 </div>
                 <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl">
                    <i className="fas fa-list-check"></i>
                 </div>
              </div>
           </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
           <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] px-4">{t.ai_helper}</h3>
           <Card className="rounded-[2.5rem] bg-slate-900 text-white p-6 relative overflow-hidden">
              <div className="relative z-10 space-y-6">
                <h4 className="text-xl font-black tracking-tight">{t.assistant}</h4>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input 
                    placeholder="..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="flex-grow h-14 rounded-xl text-slate-900 px-6 bg-white outline-none font-bold"
                  />
                  <Button onClick={handleSearch} disabled={searching} className="h-14 px-8 rounded-xl bg-blue-600 font-black">
                     {searching ? <i className="fas fa-circle-notch animate-spin"></i> : t.ask_ai_btn}
                  </Button>
                </div>
                {searchResults && (
                  <div className="p-5 bg-white/5 rounded-2xl border border-white/10 animate-in fade-in">
                     <p className="text-slate-300 leading-relaxed font-medium text-sm">{searchResults.text}</p>
                  </div>
                )}
              </div>
           </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
