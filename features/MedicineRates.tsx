
import React, { useState, useRef } from 'react';
import { Card, Button, Badge } from '../components/UI';
import { identifyTablet, getMedicineRates } from '../services/geminiService';
import { useLanguage } from '../App';
import { TabletData } from '../types';

const MedicineRates: React.FC = () => {
  const { t, language } = useLanguage();
  const [capturedMedicines, setCapturedMedicines] = useState<TabletData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [rateResults, setRateResults] = useState<{ text: string, sources: any[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    setRateResults(null);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        
        setLoadingMsg(`Identifying Medicine ${i + 1} of ${files.length}...`);
        const data = await identifyTablet(base64, language);
        setCapturedMedicines(prev => [...prev, data]);
      }
    } catch (err) {
      alert("Error identifying medicine. Please try a clearer photo.");
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  const fetchRates = async () => {
    if (capturedMedicines.length === 0) return;
    setLoading(true);
    setLoadingMsg("Checking current market rates...");
    try {
      const results = await getMedicineRates(capturedMedicines, language);
      setRateResults(results);
    } catch (err) {
      alert("Failed to fetch rates. Please try again later.");
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  const removeMedicine = (index: number) => {
    setCapturedMedicines(prev => prev.filter((_, i) => i !== index));
    setRateResults(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 py-10 px-4 animate-in fade-in duration-700">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-indigo-50 px-6 py-2 rounded-full border border-indigo-100 text-[10px] font-black uppercase text-indigo-600 tracking-[0.2em]">
          <i className="fas fa-tag"></i> Market Price Check
        </div>
        <h1 className="text-5xl font-black text-slate-900 tracking-tight">{t.medicine_rates}</h1>
        <p className="text-slate-500 text-lg font-medium max-w-2xl mx-auto">Upload photos of your medicines to check their current market rates and find alternatives.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card title="Upload Medicines">
             <div className="space-y-6">
                <p className="text-sm text-slate-500 font-medium italic">You can upload multiple medicine photos at once to check their total estimated cost.</p>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="w-full h-16 rounded-2xl bg-indigo-600 shadow-xl shadow-indigo-500/20"
                  disabled={loading}
                >
                   <i className="fas fa-plus-circle mr-2"></i>
                   {t.upload_medicine}
                </Button>

                {capturedMedicines.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identified Items</p>
                     <div className="space-y-2">
                        {capturedMedicines.map((med, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                             <div className="flex items-center gap-3 truncate">
                                <img src={med.imageUrl} className="w-10 h-10 rounded-lg object-cover" alt="Med" />
                                <p className="font-black text-slate-800 text-sm truncate">{med.name}</p>
                             </div>
                             <button onClick={() => removeMedicine(idx)} className="text-slate-300 hover:text-red-500">
                                <i className="fas fa-times-circle"></i>
                             </button>
                          </div>
                        ))}
                     </div>
                     <Button 
                       variant="primary" 
                       className="w-full h-14 mt-4 bg-slate-900" 
                       onClick={fetchRates}
                       disabled={loading}
                     >
                        <i className="fas fa-search-dollar mr-2"></i>
                        {t.check_rates}
                     </Button>
                  </div>
                )}
             </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
           <Card className="min-h-[500px] flex flex-col">
              {loading ? (
                <div className="flex-grow flex flex-col items-center justify-center p-20 space-y-6">
                   <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                   <div className="text-center">
                      <p className="font-black text-slate-800">{loadingMsg}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Checking True Medicine & Local Rates</p>
                   </div>
                </div>
              ) : rateResults ? (
                <div className="p-4 space-y-8 animate-in fade-in slide-in-from-top-4">
                   <div className="bg-indigo-50 p-8 rounded-[2.5rem] border border-indigo-100">
                      <h3 className="text-2xl font-black text-indigo-900 mb-6 flex items-center gap-3">
                         <i className="fas fa-file-invoice-dollar"></i>
                         Rate Analysis Report
                      </h3>
                      <div className="prose prose-slate max-w-none">
                         <div className="text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                            {rateResults.text}
                         </div>
                      </div>
                   </div>

                   {rateResults.sources.length > 0 && (
                     <div className="space-y-4">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Sources Verified via Google Search</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           {rateResults.sources.map((s, idx) => (
                             <a 
                               key={idx} 
                               href={s.web?.uri} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-300 transition-colors shadow-sm group"
                             >
                                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                   <i className="fas fa-link text-xs"></i>
                                </div>
                                <div className="truncate">
                                   <p className="font-black text-slate-800 text-xs truncate">{s.web?.title || 'External Source'}</p>
                                   <p className="text-[10px] text-slate-400 truncate">{s.web?.uri}</p>
                                </div>
                             </a>
                           ))}
                        </div>
                     </div>
                   )}
                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center p-20 text-center space-y-4 opacity-30">
                   <i className="fas fa-hand-holding-dollar text-8xl"></i>
                   <p className="text-xl font-black uppercase tracking-widest">No Analysis Requested</p>
                   <p className="text-sm font-medium">Identify medicines first to see current market rates.</p>
                </div>
              )}
           </Card>
        </div>
      </div>
    </div>
  );
};

export default MedicineRates;
