
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
         <Badge color="blue" className="px-5 py-1.5 rounded-full text-[9px] uppercase tracking-[0.2em] font-black">Central Health Console</Badge>
         <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-slate-900 dark:text-white leading-[0.9]">
            {t.welcome}, <span className="text-blue-600 dark:text-blue-400">{displayName}!</span>
          </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="bg-white dark:bg-slate-900 rounded-[3.5rem] p-10 shadow-2xl shadow-blue-500/10 border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center gap-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-blue-50/20 dark:bg-blue-900/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative z-10 w-full space-y-4">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-[1.5rem] mx-auto flex items-center justify-center text-2xl">
              <i className="fas fa-pills"></i>
            </div>
            <h2 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white">Medicine Safety</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed max-w-[250px] mx-auto">Verify pills against prescriptions instantly.</p>
            <Link to="/verify" className="block relative group/btn pt-4">
                <Button className="h-24 w-full text-xl rounded-[2rem] bg-blue-600 text-white hover:bg-blue-700 border-b-8 border-blue-800 dark:border-blue-900 shadow-2xl transform hover:-translate-y-1.5 active:translate-y-1 transition-all flex flex-col items-center justify-center p-0 font-black">
                  <div className="flex items-center gap-3">
                    <i className="fas fa-camera text-2xl"></i>
                    <span>VERIFY MEDICINE</span>
                  </div>
                </Button>
            </Link>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-[3.5rem] p-10 shadow-2xl shadow-indigo-500/10 border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center gap-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-indigo-50/20 dark:bg-indigo-900/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative z-10 w-full space-y-4">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-[1.5rem] mx-auto flex items-center justify-center text-2xl">
              <i className="fas fa-file-medical"></i>
            </div>
            <h2 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white">Report Intelligence</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed max-w-[250px] mx-auto">Deep clinical scan of blood & lab reports.</p>
            <Link to="/reports" className="block relative group/btn pt-4">
                <Button className="h-24 w-full text-xl rounded-[2rem] bg-indigo-600 text-white hover:bg-indigo-700 border-b-8 border-indigo-800 dark:border-indigo-900 shadow-2xl transform hover:-translate-y-1.5 active:translate-y-1 transition-all flex flex-col items-center justify-center p-0 font-black">
                  <div className="flex items-center gap-3">
                    <i className="fas fa-microscope text-2xl"></i>
                    <span>SCAN REPORTS</span>
                  </div>
                </Button>
            </Link>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-6">
           <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] px-4">Verification Stats</h3>
           <div className="grid grid-cols-1 gap-4">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-50 dark:border-slate-800 flex items-center justify-between group">
                 <div>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.total}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Meds Checked</p>
                 </div>
                 <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center text-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <i className="fas fa-list-check"></i>
                 </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-50 dark:border-slate-800 flex items-center justify-between group">
                 <div>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">Active</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">MediScan Engine</p>
                 </div>
                 <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center text-xl">
                    <i className="fas fa-shield-virus"></i>
                 </div>
              </div>
           </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
           <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] px-4">AI Clinical Inquiries</h3>
           <Card className="rounded-[2.5rem] border-none shadow-2xl bg-slate-900 dark:bg-slate-800 text-white p-6 relative overflow-hidden transition-colors">
              <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                 <i className="fas fa-wand-sparkles text-[150px]"></i>
              </div>
              
              <div className="relative z-10 space-y-6">
                <div>
                  <h4 className="text-xl font-black tracking-tight mb-1">Instant Health Assistant</h4>
                  <p className="text-slate-400 text-xs font-medium">Verify interactions or clarify dosage instructions.</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <input 
                    placeholder="Can I take paracetamol with this?" 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    className="flex-grow h-14 rounded-xl text-slate-900 px-6 bg-white dark:bg-slate-700 dark:text-white border-none focus:ring-4 focus:ring-blue-500/30 outline-none font-bold text-sm"
                  />
                  <Button onClick={handleSearch} disabled={searching} className="h-14 px-8 rounded-xl bg-blue-600 hover:bg-blue-500 font-black tracking-widest text-xs shadow-xl shadow-blue-500/20 uppercase">
                     {searching ? <i className="fas fa-circle-notch animate-spin"></i> : 'Ask AI'}
                  </Button>
                </div>

                {searchResults && (
                  <div className="p-5 bg-white/5 backdrop-blur-3xl rounded-2xl border border-white/10 animate-in zoom-in-95 duration-500">
                     <p className="text-slate-300 leading-relaxed font-medium italic mb-4 text-sm">"{searchResults.text}"</p>
                     
                     {/* Added source list to comply with mandatory Google Search grounding URL display requirements */}
                     {searchResults.sources && searchResults.sources.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                           <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1">Sources:</p>
                           <div className="flex flex-wrap gap-2">
                              {searchResults.sources.map((s: any, idx: number) => (
                                 <a key={idx} href={s.web?.uri} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-400 hover:underline flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg transition-colors hover:bg-white/10">
                                    <i className="fas fa-link text-[7px]"></i>
                                    {s.web?.title || 'External Source'}
                                 </a>
                              ))}
                           </div>
                        </div>
                     )}

                     <div className="flex items-center gap-2 text-[8px] font-black uppercase text-blue-400 tracking-widest mt-4">
                        <i className="fas fa-check-double"></i>
                        Clinical Data Grounded by Gemini Search
                     </div>
                  </div>
                )}
              </div>
           </Card>

           <div className="grid grid-cols-2 gap-4">
              <Link to="/rates" className="block group/card">
                 <div className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] hover:border-blue-300 dark:hover:border-blue-800 transition-all shadow-lg shadow-slate-200/30 dark:shadow-none flex flex-col gap-3">
                    <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center text-lg group-hover/card:bg-indigo-600 group-hover/card:text-white transition-all">
                       <i className="fas fa-tag"></i>
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 dark:text-white tracking-tight text-sm">Market Rates</h4>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Price Check</p>
                    </div>
                 </div>
              </Link>
              <Link to="/visualizer" className="block group/card">
                 <div className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] hover:border-blue-300 dark:hover:border-blue-800 transition-all shadow-lg shadow-slate-200/30 dark:shadow-none flex flex-col gap-3">
                    <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center text-lg group-hover/card:bg-purple-600 group-hover/card:text-white transition-all">
                       <i className="fas fa-eye"></i>
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 dark:text-white tracking-tight text-sm">Pill Lookup</h4>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Visual Search</p>
                    </div>
                 </div>
              </Link>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
