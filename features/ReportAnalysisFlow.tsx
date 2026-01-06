
import React, { useState, useRef } from 'react';
import { UserProfile, ReportAnalysis, ReportComponent } from '../types';
import { Card, Button, Badge } from '../components/UI';
import { analyzeMedicalReports } from '../services/geminiService';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../App';

const SectionHeader: React.FC<{ title: string; subtitle: string; icon: string; theme: 'red' | 'indigo' | 'green' | 'blue' }> = ({ title, subtitle, icon, theme }) => {
  const colors = {
    red: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/30',
    indigo: 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30',
    green: 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 border-green-100 dark:border-green-900/30',
    blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30'
  };
  return (
    <div className={`p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border ${colors[theme]} flex flex-col sm:flex-row items-center gap-4 md:gap-6 mb-6 md:mb-10 shadow-sm transition-colors`}>
      <div className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl flex items-center justify-center text-xl md:text-3xl bg-white dark:bg-slate-800 shadow-xl border border-slate-100 dark:border-slate-700 shrink-0`}>
        <i className={`fas ${icon}`}></i>
      </div>
      <div className="text-center sm:text-left overflow-hidden w-full">
        <h3 className="text-xl md:text-2xl lg:text-3xl font-black tracking-tight leading-tight mb-1 truncate md:whitespace-normal">{title}</h3>
        <p className="text-[9px] md:text-[11px] font-bold uppercase tracking-[0.15em] md:tracking-[0.25em] opacity-70 leading-tight break-words">{subtitle}</p>
      </div>
    </div>
  );
};

const ClinicalDataTable: React.FC<{ items: ReportComponent[]; title: string; statusType: 'DANGER' | 'WARNING' | 'SUCCESS' }> = ({ items, title, statusType }) => {
  if (!items || items.length === 0) return null;

  const headerColors = {
    DANGER: 'bg-red-600 text-white',
    WARNING: 'bg-amber-500 text-white',
    SUCCESS: 'bg-emerald-600 text-white'
  };

  return (
    <div className="overflow-hidden border border-slate-100 dark:border-slate-800 rounded-[2rem] md:rounded-[2.5rem] bg-white dark:bg-slate-900 shadow-xl mb-12 transition-all">
      <div className={`px-6 md:px-8 py-4 md:py-6 ${headerColors[statusType]} flex flex-col sm:flex-row justify-between items-center gap-3`}>
         <div className="flex items-center gap-3 md:gap-4">
            <i className={`fas ${statusType === 'DANGER' ? 'fa-skull-crossbones' : statusType === 'WARNING' ? 'fa-circle-exclamation' : 'fa-circle-check'} text-lg md:text-2xl opacity-80`}></i>
            <span className="font-black text-xs md:text-lg uppercase tracking-widest">{title}</span>
         </div>
         <Badge color="white" className="bg-white/20 border-white/30 text-white px-3 md:px-5 py-1 text-[10px] uppercase font-black">{items.length} Findings</Badge>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
          <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="w-[20%] px-6 py-4 text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest">Biomarker</th>
              <th className="w-[15%] px-6 py-4 text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest">Reading</th>
              <th className="w-[25%] px-6 py-4 text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest">Simplified Meaning</th>
              <th className="w-[20%] px-6 py-4 text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest">Disease Risk</th>
              <th className="w-[20%] px-6 py-4 text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest">Suggested Solution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {items.map((item, i) => (
              <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-6 py-6 align-top">
                   <div className="font-black text-slate-900 dark:text-slate-100 text-lg mb-1 leading-tight">{item.name}</div>
                   <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Healthy Range: {item.range}</div>
                </td>
                <td className="px-6 py-6 align-top">
                   <div className={`inline-block px-4 py-2 rounded-2xl text-lg font-black ${
                     statusType === 'DANGER' ? 'bg-red-100 text-red-700' : 
                     statusType === 'WARNING' ? 'bg-amber-100 text-amber-700' : 
                     'bg-emerald-100 text-emerald-700'
                   }`}>
                    {item.value}
                   </div>
                </td>
                <td className="px-6 py-6 align-top">
                   <p className="text-xs md:text-sm font-bold text-slate-600 dark:text-slate-300 leading-relaxed italic break-words">
                     "{item.problemSimplified}"
                   </p>
                </td>
                <td className="px-6 py-6 align-top">
                   <div className="flex items-start gap-2 text-red-500 font-black text-[10px] uppercase tracking-tight leading-tight break-words">
                      <i className="fas fa-triangle-exclamation mt-0.5 shrink-0"></i>
                      <span>{item.majorDiseaseRisk || 'Minimal risk detected'}</span>
                   </div>
                </td>
                <td className="px-6 py-6 align-top">
                   <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/50 text-xs font-bold text-blue-700 dark:text-blue-300 leading-relaxed break-words">
                      {item.suggestedSolution || 'Continue monitoring readings'}
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ReportAnalysisFlow: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [results, setResults] = useState<ReportAnalysis[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setLoading(true);
    setLoadingMsg(`AI Turbo Scanning ${files.length} Report${files.length > 1 ? 's' : ''}...`);

    try {
      // Parallel processing using Promise.all to maximize speed
      const analysisPromises = Array.from(files).map(async (file) => {
        const base64 = await new Promise<string>(r => {
          const reader = new FileReader();
          reader.onload = () => r(reader.result as string);
          reader.readAsDataURL(file);
        });
        return analyzeMedicalReports(base64, file.type || 'application/pdf', user, language);
      });

      const processedResults = await Promise.all(analysisPromises);
      setResults(processedResults);
    } catch (err) { 
      alert("Scan failed. Ensure report is clear."); 
    } finally { 
      setLoading(false); 
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-12 animate-in fade-in max-w-3xl mx-auto px-6">
        <div className="w-24 h-24 border-8 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
        <div className="text-center space-y-2">
           <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter leading-tight">{loadingMsg}</h2>
           <p className="text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.3em] text-xs">Utilizing Gemini Flash for Instant Extraction</p>
        </div>
      </div>
    );
  }

  if (results.length > 0) {
    const r = results[activeIdx];
    return (
      <div className="max-w-7xl mx-auto space-y-16 lg:space-y-24 pb-24 px-4 font-sans animate-in zoom-in-95 duration-1000">
        
        <div className={`p-12 md:p-24 rounded-[4rem] text-center shadow-2xl text-white relative overflow-hidden ${
          r.severity === 'DANGER' ? 'bg-gradient-to-br from-red-600 to-red-800' : r.severity === 'WARNING' ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-emerald-600 to-teal-800'
        }`}>
           <div className="absolute top-0 right-0 p-12 md:p-24 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
             <i className="fas fa-bolt text-[200px] md:text-[350px]"></i>
           </div>
           <div className="relative z-10 space-y-12">
              {results.length > 1 && (
                <div className="flex justify-center gap-2 mb-4">
                  {results.map((_, i) => (
                    <button 
                      key={i} 
                      onClick={() => setActiveIdx(i)}
                      className={`w-3 h-3 rounded-full transition-all ${activeIdx === i ? 'bg-white scale-125' : 'bg-white/30 hover:bg-white/50'}`}
                    />
                  ))}
                </div>
              )}
              <div className="w-20 h-20 md:w-32 md:h-32 bg-white/20 rounded-[2.5rem] mx-auto flex items-center justify-center text-4xl md:text-6xl backdrop-blur-xl border border-white/30 shadow-2xl">
                 <i className={`fas ${r.severity === 'DANGER' ? 'fa-biohazard' : 'fa-check-double'}`}></i>
              </div>
              <div>
                 <p className="text-xs md:text-lg font-black uppercase tracking-[0.5em] opacity-80 mb-4">Turbo Health Assessment</p>
                 <h2 className="text-5xl md:text-9xl font-black tracking-tighter leading-none mb-8 drop-shadow-lg break-words px-4">
                    {r.overallHealthGrade}
                 </h2>
              </div>
              <div className="max-w-4xl mx-auto p-8 md:p-12 bg-black/10 backdrop-blur-md rounded-[3rem] border border-white/20 shadow-inner">
                 <p className="text-xl md:text-3xl font-bold leading-relaxed italic text-white/95">
                   "{r.simpleSummary}"
                 </p>
              </div>
           </div>
        </div>

        <section>
          <SectionHeader 
            title="Biomarker Analysis" 
            subtitle="Extracted markers compared to healthy norms" 
            icon="fa-flask-vial" 
            theme="red"
          />
          
          <div className="space-y-12">
            <ClinicalDataTable 
              items={r.highFindings || []} 
              title="Compartment: Elevated Findings (High)" 
              statusType="DANGER" 
            />
            
            <ClinicalDataTable 
              items={r.lowFindings || []} 
              title="Compartment: Deficient Findings (Low)" 
              statusType="WARNING" 
            />
            
            <ClinicalDataTable 
              items={r.normalFindings || []} 
              title="Compartment: Optimal Findings (Normal)" 
              statusType="SUCCESS" 
            />
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 space-y-8">
            <SectionHeader 
              title="Disease Risk Profile" 
              subtitle="Potential conditions associated with your markers" 
              icon="fa-dna" 
              theme="indigo"
            />
            <div className="grid grid-cols-1 gap-6">
               {r.top3Risks?.map((risk, i) => (
                 <Card key={i} className="p-8 md:p-10 rounded-[2.5rem] border-none shadow-2xl bg-slate-900 text-white flex items-center gap-8 group transition-all transform hover:scale-[1.02]">
                    <span className="text-4xl font-black text-indigo-500 opacity-30 shrink-0">0{i+1}</span>
                    <div className="overflow-hidden">
                       <p className="text-xl md:text-2xl font-black tracking-tight leading-tight break-words">{risk}</p>
                       <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-2">Clinical Warning</p>
                    </div>
                 </Card>
               ))}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-8">
            <SectionHeader 
              title="Action Plan" 
              subtitle="Simple steps to normalize your profile" 
              icon="fa-list-check" 
              theme="green"
            />
            <div className="space-y-6">
               {r.immediateSteps?.map((step, i) => (
                 <div key={i} className="p-6 md:p-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] shadow-xl flex items-start gap-6 transition-all hover:bg-slate-50">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 font-black text-xl shadow-lg">
                       {i+1}
                    </div>
                    <p className="font-bold text-slate-700 dark:text-slate-300 leading-relaxed text-sm md:text-base pt-1">{step}</p>
                 </div>
               ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-8 max-w-3xl mx-auto pt-10">
           <Button variant="ghost" className="flex-1 h-20 text-lg font-black text-slate-400 rounded-[2.5rem] border-2 border-dashed border-slate-200" onClick={() => { setResults([]); setActiveIdx(0); }}>
              <i className="fas fa-undo mr-3"></i> Analyze New
           </Button>
           <Button className="flex-[2] h-20 text-2xl rounded-[2.5rem] bg-slate-900 text-white font-black shadow-2xl" onClick={() => navigate('/')}>
              <i className="fas fa-house-user mr-3"></i> Home Dashboard
           </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-16 py-12 px-4 animate-in fade-in duration-1000">
      <div className="text-center space-y-6">
         <div className="w-24 h-24 md:w-36 md:h-36 bg-indigo-600 rounded-[3rem] md:rounded-[4rem] mx-auto flex items-center justify-center text-white text-4xl md:text-6xl shadow-2xl shadow-indigo-600/30">
            <i className="fas fa-bolt"></i>
         </div>
         <div className="space-y-4">
            <h1 className="text-4xl md:text-7xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">Instant Analysis</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xl md:text-2xl font-medium max-w-3xl mx-auto leading-relaxed">Turbo-charged medical extraction. Upload multiple reports and get instant insights in seconds.</p>
         </div>
      </div>

      <Card className="rounded-[3rem] md:rounded-[5rem] p-12 md:p-24 text-center border-none shadow-2xl bg-white dark:bg-slate-900 group hover:shadow-indigo-500/20 transition-all cursor-pointer relative overflow-hidden" onClick={() => fileInputRef.current?.click()}>
         <div className="absolute inset-0 bg-indigo-50/10 dark:bg-indigo-900/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
         <div className="relative z-10 space-y-10">
            <div className="w-20 h-20 md:w-28 md:h-28 bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-[2.5rem] mx-auto flex items-center justify-center text-4xl md:text-5xl group-hover:scale-110 transition-transform">
               <i className="fas fa-bolt"></i>
            </div>
            <div className="space-y-3">
               <h3 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white">Turbo Upload</h3>
               <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.4em] text-xs">PDF • IMAGES (Multiple Files Welcome)</p>
            </div>
         </div>
         <input type="file" multiple accept=".pdf,image/*" className="hidden" ref={fileInputRef} onChange={handleUpload} />
      </Card>
    </div>
  );
};

export default ReportAnalysisFlow;
