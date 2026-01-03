
import React, { useState } from 'react';
import { UserProfile, VerificationResult, MatchStatus } from '../types';
import { Card, Button, Badge, Input } from '../components/UI';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
    total: history.length,
    perfect: history.filter(h => h.status === MatchStatus.PERFECT_MATCH).length,
    risky: history.filter(h => h.status === MatchStatus.NO_MATCH).length,
  };

  const chartData = history.slice(0, 7).reverse().map(h => ({
    name: new Date(h.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    score: h.matchScore * 100
  }));

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

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">{t.dashboard}</h1>
          <p className="text-slate-500 font-medium">{t.welcome}, {user.fullName.split(' ')[0]}!</p>
        </div>
        <div className="flex gap-2">
          <Link to="/assistant">
            <Button variant="secondary" className="h-12">
              <i className="fas fa-user-md"></i>
              {t.assistant}
            </Button>
          </Link>
          <Link to="/verify">
            <Button className="h-12 px-8">
              <i className="fas fa-camera"></i>
              {t.new_verification}
            </Button>
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-blue-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest">{t.total_checks}</p>
              <h3 className="text-4xl font-black mt-1 text-slate-800">{stats.total}</h3>
            </div>
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              <i className="fas fa-clipboard-check text-xl"></i>
            </div>
          </div>
        </Card>
        <Card className="border-l-4 border-l-green-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest">{t.perfect_matches}</p>
              <h3 className="text-4xl font-black mt-1 text-slate-800">{stats.perfect}</h3>
            </div>
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
              <i className="fas fa-check-circle text-xl"></i>
            </div>
          </div>
        </Card>
        <Card className="border-l-4 border-l-red-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest">{t.critical_risks}</p>
              <h3 className="text-4xl font-black mt-1 text-slate-800">{stats.risky}</h3>
            </div>
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
              <i className="fas fa-exclamation-triangle text-xl"></i>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2" title="Deep Health Search (Thinking Mode Active)">
          <div className="space-y-4">
             <div className="flex gap-2">
                <Input 
                  placeholder="Ask complex health questions..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={searching} className="shrink-0">
                   {searching ? <i className="fas fa-brain animate-pulse text-blue-400"></i> : <i className="fas fa-search"></i>}
                </Button>
             </div>
             
             {searching && (
               <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl animate-pulse">
                  <i className="fas fa-network-wired text-blue-600"></i>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Gemini 3 Pro is thinking... (32k token budget)</span>
               </div>
             )}

             {searchResults && (
               <div className="p-4 bg-blue-50 rounded-2xl animate-in fade-in slide-in-from-top-2">
                  <div className="prose prose-sm prose-slate max-w-none">
                    <p className="text-slate-700 whitespace-pre-wrap">{searchResults.text}</p>
                  </div>
                  {searchResults.sources.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-blue-100">
                      <p className="text-[10px] font-black uppercase text-blue-400 mb-2">Sources:</p>
                      <div className="flex flex-wrap gap-2">
                        {searchResults.sources.map((s, idx) => (
                          <a key={idx} href={s.web?.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline font-bold bg-white px-2 py-1 rounded-md border border-blue-200">
                            {s.web?.title || 'Link'}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
               </div>
             )}

             <div className="h-[200px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={4} dot={{ fill: '#2563eb', strokeWidth: 2, r: 6, stroke: '#fff' }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
             </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="AI Tools">
             <div className="space-y-3">
               <Link to="/rates">
                 <Button variant="ghost" className="w-full justify-start text-indigo-600 bg-indigo-50/50">
                   <i className="fas fa-tag"></i>
                   {t.medicine_rates}
                 </Button>
               </Link>
               <Link to="/visualizer">
                 <Button variant="ghost" className="w-full justify-start text-blue-600 bg-blue-50/50">
                   <i className="fas fa-wand-magic-sparkles"></i>
                   {t.visualizer}
                 </Button>
               </Link>
               <Link to="/assistant">
                 <Button variant="ghost" className="w-full justify-start text-slate-600 bg-slate-50/50">
                   <i className="fas fa-user-md"></i>
                   {t.ai_helper}
                 </Button>
               </Link>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
