
import React, { useState, useRef } from 'react';
import { Card, Button, Input } from '../components/UI';
import { analyzeHealthImage, getDeepReasoning } from '../services/geminiService';
import { useLanguage } from '../App';

const HealthAssistant: React.FC = () => {
  const { language } = useLanguage();
  const [image, setImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [textQuery, setTextQuery] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
      setAnalysis(null);
    }
  };

  const runImageAnalysis = async () => {
    if (!image) return;
    setLoading(true);
    setAnalysis(null);
    try {
      const result = await analyzeHealthImage(image, language);
      setAnalysis(result);
    } catch (err) {
      alert("Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const runTextAnalysis = async () => {
    if (!textQuery.trim()) return;
    setLoading(true);
    setAnalysis(null);
    try {
      const result = await getDeepReasoning(textQuery, language);
      setAnalysis(result);
    } catch (err) {
      alert("Deep reasoning failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 px-4">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Health AI Assistant</h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium max-w-2xl mx-auto">Deep reasoning for your medical reports, prescription labels, or general health concerns.</p>
        <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 px-4 py-1.5 rounded-full border border-blue-100 dark:border-blue-800 text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-widest mt-4">
          <i className="fas fa-brain animate-pulse"></i>
          Gemini 3 Pro Thinking Mode Active
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card title="Multi-Modal Inquiry" className="dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Describe Your Concern</label>
                <textarea 
                  className="w-full h-32 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none font-medium text-slate-700 dark:text-white transition-colors"
                  placeholder="Ask a complex medical question or provide details about a symptom..."
                  value={textQuery}
                  onChange={e => setTextQuery(e.target.value)}
                />
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100 dark:border-slate-800"></div></div>
                <div className="relative flex justify-center text-[10px] font-black uppercase text-slate-300 dark:text-slate-600 tracking-widest"><span className="bg-white dark:bg-slate-900 px-4">Optional: Add Image</span></div>
              </div>

              <div 
                onClick={() => fileRef.current?.click()}
                className={`aspect-video bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors overflow-hidden relative ${image ? 'border-blue-400 dark:border-blue-500' : ''}`}
              >
                {image ? (
                  <>
                    <img src={image} className="w-full h-full object-cover" alt="Selected" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setImage(null); }}
                      className="absolute top-4 right-4 bg-red-600 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg active:scale-95"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </>
                ) : (
                  <>
                    <i className="fas fa-camera-retro text-4xl text-slate-200 dark:text-slate-700 mb-4"></i>
                    <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Upload Health Image</p>
                  </>
                )}
              </div>
              <input type="file" className="hidden" ref={fileRef} onChange={handleFileChange} accept="image/*" />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button className="h-14 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-black dark:hover:bg-white" disabled={!textQuery || loading} onClick={runTextAnalysis}>
                   <i className="fas fa-comment-medical"></i>
                   Deep Text Analysis
                </Button>
                <Button className="h-14" disabled={!image || loading} onClick={runImageAnalysis}>
                  <i className="fas fa-eye"></i>
                  Analyze Image
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <Card title="Expert Reasoning Engine" className="dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <div className="min-h-[400px] flex flex-col">
            {loading && (
              <div className="flex-grow flex flex-col items-center justify-center text-center p-12 space-y-6">
                 <div className="relative">
                   <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 animate-pulse">
                      <i className="fas fa-brain text-3xl"></i>
                   </div>
                   <div className="absolute -inset-2 border-2 border-blue-600/20 dark:border-blue-400/20 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
                 </div>
                 <div className="space-y-2">
                    <p className="font-black text-slate-800 dark:text-slate-100 text-lg">AI is Reasoning...</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Utilizing 32k Thinking Budget for Deep Insight</p>
                 </div>
              </div>
            )}

            {!loading && analysis && (
              <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap animate-in fade-in slide-in-from-top-4 p-2">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-inner text-slate-900 dark:text-slate-100">
                  {analysis}
                </div>
              </div>
            )}

            {!loading && !analysis && (
              <div className="flex-grow flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 text-center p-8 space-y-4">
                <i className="fas fa-network-wired text-8xl opacity-10"></i>
                <div className="space-y-1">
                  <p className="font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest text-xs">Ready for Analysis</p>
                  <p className="text-sm font-medium text-slate-300 dark:text-slate-700">Submit text or image for deep medical reasoning.</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default HealthAssistant;
