
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
    blue: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30'
  };
  return (
    <div className={`p-8 rounded-[3rem] border ${colors[theme]} flex flex-col sm:flex-row items-center gap-6 mb-10 shadow-sm transition-colors`}>
      <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-3xl bg-white dark:bg-slate-800 shadow-xl border border-slate-100 dark:border-slate-700`}>
        <i className={`fas ${icon}`}></i>
      </div>
      <div className="text-center sm:text-left">
        <h3 className="text-3xl font-black tracking-tight leading-none mb-2">{title}</h3>
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] opacity-70">{subtitle}</p>
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
    <div className="overflow-hidden border border-slate-100 dark:border-slate-800 rounded-[3.5rem] bg-white dark:bg-slate-900 shadow-2xl shadow-slate-200/50 dark:shadow-none mb-12 transition-all">
      <div className={`px-10 py-6 ${headerColors[statusType]} flex justify-between items-center`}>
         <div className="flex items-center gap-4">
            <i className={`fas ${statusType === 'DANGER' ? 'fa-skull-crossbones' : statusType === 'WARNING' ? 'fa-circle-exclamation' : 'fa-circle-check'} text-2xl opacity-70`}></i>
            <span className="font-black text-lg uppercase tracking-widest">{title}</span>
         </div>
         <Badge color="white" className="bg-white/20 border-white/30 text-white px-5 py-1 text-sm">{items.length} Markers</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="px-10 py-5 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest min-w-[180px]">Biomarker</th>
              <th className="px-10 py-5 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest min-w-[120px]">Reading</th>
              <th className="px-10 py-5 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Description & Impact</th>
              <th className="px-10 py-5 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Risk Factor</th>
              <th className="px-10 py-5 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Recommended Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {items.map((item, i) => (
              <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-10 py-8 align-top">
                   <div className="font-black text-slate-900 dark:text-slate-100 text-lg mb-1">{item.name}</div>
                   <div className="text-[10px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">Range: {item.range}</div>
                </td>
                <td className="px-10 py-8 align-top">
                   <Badge 
                    color={statusType === 'DANGER' ? 'red' : statusType === 'WARNING' ? 'yellow' : 'green'} 
                    className="text-xl font-black px-5 py-2 rounded-2xl"
                   >
                    {item.value}
                   </Badge>
                </td>
                <td className="px-10 py-8 align-top">
                   <p className="text-sm font-bold text-slate-600 dark:text-slate-300 leading-relaxed italic max-w-xs">
                     "{item.problemSimplified}"
                   </p>
                </td>
                <td className="px-10 py-8 align-top">
                   <div className="flex items-center gap-2 text-red-500 dark:text-red-400 font-black text-xs uppercase tracking-tight">
                      <i className="fas fa-triangle-exclamation"></i>
                      {item.majorDiseaseRisk || 'No acute risk detected'}
                   </div>
                </td>
                <td className="px-10 py-8 align-top">
                   <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/50 text-xs font-bold text-blue-700 dark:text-blue-300 max-w-xs leading-relaxed">
                      {item.suggestedSolution || 'Maintain current healthy lifestyle'}
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
    try {
      const temp: ReportAnalysis[] = [];
      for (let i = 0; i < files.length; i++) {
        setLoadingMsg(`Deep Clinical Extraction: ${i + 1}/${files.length}...`);
        const base64 = await new Promise<string>(r => {
          const reader = new FileReader();
          reader.onload = () => r(reader.result as string);
          reader.readAsDataURL(files[i]);
        });
        const res = await analyzeMedicalReports(base64, files[i].type || 'application/pdf', user, language);
        temp.push(res);
      }
      setResults(temp);
    } catch (err) { 
      alert("Scan failed. Ensure report is flat, well-lit, and text is readable."); 
    } finally { 
      setLoading(false); 
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-12 animate-in fade-in max-w-3xl mx-auto px-6">
        <div className="relative">
          <div className="w-56 h-56 border-[16px] border-slate-100 dark:border-slate-800 rounded-[5rem] animate-pulse"></div>
          <div className="absolute inset-0 flex items-center justify-center flex-col gap-4">
             <i className="fas fa-microscope text-indigo-600 dark:text-indigo-400 text-7xl animate-bounce"></i>
             <div className="w-16 h-2 bg-indigo-100 dark:bg-indigo-900 rounded-full"></div>
          </div>
        </div>
        <div className="text-center space-y-6">
           <h2 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter leading-tight">{loadingMsg}</h2>
           <div className="flex flex-wrap items-center justify-center gap-3">
              <Badge color="blue" className="animate-pulse px-4 py-1">Gemini 3 Pro Reasoning</Badge>
              <Badge color="green" className="px-4 py-1">Biomarker Logic Active</Badge>
              <Badge color="red" className="px-4 py-1">Clinical Audit Mode</Badge>
           </div>
           <p className="text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.4em] text-xs">Matching findings against international clinical standards</p>
        </div>
      </div>
    );
  }

  if (results.length > 0) {
    const r = results[activeIdx];
    return (
      <div className="max-w-7xl mx-auto space-y-20 pb-32 px-4 font-sans animate-in zoom-in-95 duration-1000">
        
        {/* COMPARTMENT 1: EXECUTIVE INTELLIGENCE SUMMARY */}
        <div className={`p-16 md:p-24 rounded-[5rem] text-center shadow-2xl text-white relative overflow-hidden transition-all transform hover:scale-[1.01] duration-700 ${
          r.severity === 'DANGER' ? 'bg-gradient-to-br from-red-600 to-red-800' : r.severity === 'WARNING' ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-emerald-600 to-teal-800'
        }`}>
           <div className="absolute top-0 right-0 p-24 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
             <i className="fas fa-file-waveform text-[250px]"></i>
           </div>
           <div className="relative z-10 space-y-10">
              <div className="w-28 h-28 bg-white/20 rounded-[2.5rem] mx-auto flex items-center justify-center text-6xl backdrop-blur-xl border border-white/30 shadow-2xl">
                 <i className={`fas ${r.severity === 'DANGER' ? 'fa-triangle-exclamation' : 'fa-shield-heart'}`}></i>
              </div>
              <div className="space-y-4">
                 <p className="text-[14px] font-black uppercase tracking-[0.5em] opacity-80">Final Clinical Assessment</p>
                 <h2 className="text-6xl md:text-8xl font-black tracking-tighter leading-none mb-6 drop-shadow-lg">{r.overallHealthGrade}</h2>
              </div>
              <div className="max-w-4xl mx-auto p-10 bg-black/10 backdrop-blur-md rounded-[3rem] border border-white/20 shadow-inner">
                 <p className="text-2xl md:text-3xl font-bold opacity-100 leading-relaxed italic text-white drop-shadow-sm">
                   "{r.simpleSummary}"
                 </p>
              </div>
           </div>
        </div>

        {/* COMPARTMENT 2: CRITICAL & HIGH ABNORMALITIES */}
        <section>
          <SectionHeader 
            title="Biomarker Intelligence Audit" 
            subtitle="Deep tabular breakdown of markers outside healthy range" 
            icon="fa-flask-vial" 
            theme="red"
          />
          <ClinicalDataTable 
            items={r.highFindings || []} 
            title="HIGH VALUE ALERT" 
            statusType="DANGER" 
          />
          <ClinicalDataTable 
            items={r.lowFindings || []} 
            title="LOW VALUE ALERT" 
            statusType="WARNING" 
          />
          
          {(!r.highFindings?.length && !r.lowFindings?.length) && (
            <div className="p-24 bg-emerald-50 dark:bg-emerald-900/20 rounded-[4rem] border border-emerald-100 dark:border-emerald-800/30 text-center shadow-2xl">
               <i className="fas fa-heart-pulse text-8xl text-emerald-500 mb-8 animate-pulse"></i>
               <h3 className="text-4xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight">Clinical Optimization Detected</h3>
               <p className="text-emerald-600 dark:text-emerald-500/70 font-bold opacity-70 mt-4 text-xl">All biomarkers analyzed within this report reside in the optimal pharmacological range.</p>
            </div>
          )}
        </section>

        {/* COMPARTMENT 3: PATHOLOGY RISK MAPPING */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7 space-y-8">
            <SectionHeader 
              title="Risk Profile Mapping" 
              subtitle="Major illnesses statistically linked to these specific markers" 
              icon="fa-dna" 
              theme="indigo"
            />
            <div className="grid grid-cols-1 gap-6">
               {r.top3Risks?.map((risk, i) => (
                 <Card key={i} className="p-10 rounded-[3rem] border-none shadow-2xl bg-slate-900 dark:bg-slate-800 text-white relative overflow-hidden group hover:-translate-y-2 transition-all cursor-default">
                    <div className="absolute inset-0 bg-indigo-600 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                    <div className="flex items-center gap-8 relative z-10">
                       <span className="text-5xl font-black text-indigo-500 opacity-40">0{i+1}</span>
                       <div>
                          <p className="text-2xl font-black tracking-tight leading-tight mb-2">{risk}</p>
                          <Badge color="blue" className="bg-indigo-500/20 text-indigo-400 border-none font-black text-[10px] uppercase">Pathological Correlation</Badge>
                       </div>
                    </div>
                 </Card>
               ))}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-8">
            <SectionHeader 
              title="Clinical Action Plan" 
              subtitle="Precise steps to normalize your biomarker profile" 
              icon="fa-clipboard-list" 
              theme="green"
            />
            <div className="space-y-6">
               {r.immediateSteps?.map((step, i) => (
                 <div key={i} className="p-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[3rem] shadow-xl flex items-start gap-6 transition-all hover:scale-[1.02] hover:shadow-2xl">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 font-black text-xl shadow-lg shadow-emerald-500/30">
                       {i+1}
                    </div>
                    <p className="font-bold text-slate-700 dark:text-slate-300 leading-relaxed text-base pt-1">{step}</p>
                 </div>
               ))}
            </div>
          </div>
        </div>

        {/* COMPARTMENT 4: OPTIMAL MARKER REPOSITORY */}
        <section className="pt-16 border-t border-slate-200 dark:border-slate-800">
           <SectionHeader 
            title="Healthy Biomarkers" 
            subtitle="Verified clinical markers within safety thresholds" 
            icon="fa-shield-check" 
            theme="blue"
          />
          <ClinicalDataTable 
            items={r.normalFindings || []} 
            title="NORMAL RANGE VERIFIED" 
            statusType="SUCCESS" 
          />
        </section>

        <div className="flex flex-col md:flex-row gap-8 max-w-3xl mx-auto pt-10">
           <Button variant="ghost" className="flex-1 h-20 text-lg font-black text-slate-400 dark:text-slate-500 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800" onClick={() => setResults([])}>
              <i className="fas fa-redo-alt mr-3"></i> Scan Another Report
           </Button>
           <Button className="flex-[2] h-20 text-2xl rounded-[2.5rem] bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-black shadow-2xl shadow-slate-900/40 transform hover:scale-105 transition-transform" onClick={() => navigate('/')}>
              <i className="fas fa-house-user mr-3"></i> Back to Dashboard
           </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-20 py-12 px-4 animate-in fade-in duration-1000">
      <div className="text-center space-y-8">
         <div className="w-36 h-36 bg-indigo-600 dark:bg-indigo-500 rounded-[4rem] mx-auto flex items-center justify-center text-white text-6xl shadow-2xl shadow-indigo-600/30 transform hover:rotate-12 transition-transform cursor-pointer group">
            <i className="fas fa-file-medical group-hover:scale-110 transition-transform"></i>
         </div>
         <div className="space-y-4">
            <h1 className="text-6xl md:text-8xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">Report Intelligence</h1>
            <p className="text-slate-500 dark:text-slate-400 text-2xl font-medium max-w-3xl mx-auto leading-relaxed">Structured clinical audit for lab tests and blood work. Professional reasoning translated for patients.</p>
         </div>
      </div>

      <Card className="rounded-[5rem] p-12 md:p-24 text-center border-none shadow-2xl bg-white dark:bg-slate-900 group hover:shadow-indigo-500/20 transition-all cursor-pointer relative overflow-hidden" onClick={() => fileInputRef.current?.click()}>
         <div className="absolute inset-0 bg-indigo-50/10 dark:bg-indigo-900/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
         <div className="relative z-10 space-y-10">
            <div className="w-28 h-28 bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-[2.5rem] mx-auto flex items-center justify-center text-5xl group-hover:scale-110 transition-transform shadow-inner">
               <i className="fas fa-file-upload"></i>
            </div>
            <div className="space-y-3">
               <h3 className="text-5xl font-black text-slate-900 dark:text-white">Upload Lab Results</h3>
               <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.4em] text-sm">PDF • IMAGE (Supports Multi-page Blood Panels)</p>
            </div>
         </div>
         <input type="file" multiple accept=".pdf,image/*" className="hidden" ref={fileInputRef} onChange={handleUpload} />
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
         {[
           { i: 'fa-microscope', t: 'Clinical Context', d: 'Extracts exact biomarkers and compares to norms' },
           { i: 'fa-table-cells', t: 'Structured Data', d: 'Converts messy PDFs into clear, actionable tables' },
           { i: 'fa-user-doctor', t: 'Med-Audit', d: 'Deep reasoning for next steps and pathological risks' }
         ].map((item, i) => (
           <div key={i} className="p-10 bg-slate-50 dark:bg-slate-900 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center gap-6 transition-all hover:-translate-y-3 hover:shadow-xl">
              <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-md border border-slate-50 dark:border-slate-700">
                 <i className={`fas ${item.i} text-2xl`}></i>
              </div>
              <div className="space-y-2">
                <p className="font-black text-slate-900 dark:text-white tracking-tight text-2xl">{item.t}</p>
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 leading-relaxed uppercase tracking-widest">{item.d}</p>
              </div>
           </div>
         ))}
      </div>
    </div>
  );
};

export default ReportAnalysisFlow;
