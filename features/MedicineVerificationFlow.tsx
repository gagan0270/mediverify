
import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, VerificationResult, PrescriptionData, TabletData, MatchStatus, Language, AlertSeverity } from '../types';
import { Card, Button, Badge } from '../components/UI';
import { analyzePrescription, identifyTablet, verifyMedicineSafety } from '../services/geminiService';
import { useNavigate } from 'react-router-dom';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { useLanguage } from '../App';

interface Props {
  user: UserProfile;
  onComplete: (result: VerificationResult) => void;
}

const MedicineVerificationFlow: React.FC<Props> = ({ user, onComplete }) => {
  const { language, t } = useLanguage();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [loadingSubMsg, setLoadingSubMsg] = useState('');
  
  // Progress tracking for multi-file processing
  const [processingProgress, setProcessingProgress] = useState<{current: number, total: number} | null>(null);

  const [extractedPrescription, setExtractedPrescription] = useState<PrescriptionData | null>(null);
  const [capturedTablets, setCapturedTablets] = useState<TabletData[]>([]);
  const [finalResult, setFinalResult] = useState<VerificationResult | null>(null);

  const [showCamera, setShowCamera] = useState(false);
  const [tfModel, setTfModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [lastBBox, setLastBBox] = useState<number[] | null>(null);

  const navigate = useNavigate();
  const prescriptionCameraRef = useRef<HTMLInputElement>(null);
  const tabletGalleryRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const loadModel = async () => {
      try {
        try {
          await (tf as any).setBackend('webgl');
        } catch (e) {
          console.warn("WebGL not supported, falling back to CPU");
          await (tf as any).setBackend('cpu');
        }
        await (tf as any).ready();
        
        const model = await cocoSsd.load();
        setTfModel(model);
      } catch (err) {
        console.error("TF model load fail", err);
      }
    };
    loadModel();
  }, []);

  const enhanceImage = (base64: string, isTextOCR: boolean = false, cropBox?: number[]): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(base64);

        if (!isTextOCR && cropBox) {
          const [x, y, w, h] = cropBox;
          const pad = 30;
          canvas.width = Math.min(img.width - x, w + pad * 2);
          canvas.height = Math.min(img.height - y, h + pad * 2);
          ctx.drawImage(img, Math.max(0, x - pad), Math.max(0, y - pad), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
        }
        
        if (isTextOCR) {
          ctx.filter = 'contrast(2.2) grayscale(1) brightness(1.05)';
        } else {
          ctx.filter = 'contrast(1.6) brightness(1.1) saturate(1.2)';
        }
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.filter = ctx.filter;
        tempCtx.drawImage(canvas, 0, 0);
        
        resolve(tempCanvas.toDataURL('image/jpeg', 0.92));
      };
      img.src = base64;
    });
  };

  useEffect(() => {
    let animationFrameId: number;
    const detect = async () => {
      if (videoRef.current && canvasRef.current && tfModel) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (video.readyState === 4 && ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const predictions = await tfModel.detect(video);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          const tabletCandidate = predictions.find(p => p.score > 0.4);
          if (tabletCandidate) {
            const [x, y, width, height] = tabletCandidate.bbox;
            setLastBBox(tabletCandidate.bbox);
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, width, height);
            
            ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
            ctx.fillRect(x, y, width, height);
          } else {
            setLastBBox(null);
          }
        }
      }
      animationFrameId = requestAnimationFrame(detect);
    };
    if (showCamera) detect();
    return () => cancelAnimationFrame(animationFrameId);
  }, [showCamera, tfModel]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (err) {
      alert("Camera access denied.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  const captureTablet = async () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.drawImage(videoRef.current, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.95);
      
      const currentBBox = lastBBox;
      stopCamera();
      setLoading(true);
      setLoadingMsg(t.analyzing);
      setLoadingSubMsg("");
      try {
        const enhanced = await enhanceImage(base64, false, currentBBox || undefined);
        const data = await identifyTablet(enhanced, language);
        setCapturedTablets(prev => [...prev, data]);
        setStep(3);
      } catch (err) {
        alert("Pill identification failed.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleGalleryTabletUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Instead of full-screen loading, we stay on Step 2 UI and show progress
    setProcessingProgress({ current: 0, total: files.length });

    try {
      const tablets: TabletData[] = [];
      for (let i = 0; i < files.length; i++) {
        setProcessingProgress({ current: i + 1, total: files.length });
        const file = files[i];
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const enhanced = await enhanceImage(base64, false);
        const data = await identifyTablet(enhanced, language);
        tablets.push(data);
      }
      setCapturedTablets(prev => [...prev, ...tablets]);
      setStep(3);
    } catch (err) {
      alert("Failed to process images.");
    } finally {
      setProcessingProgress(null);
    }
  };

  const handleCapturePrescription = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setLoading(true);
      setLoadingMsg(t.analyzing);
      setLoadingSubMsg("");
      try {
        const enhanced = await enhanceImage(base64, true);
        const data = await analyzePrescription(enhanced, language);
        setExtractedPrescription(data);
        setStep(2);
      } catch (err) {
        alert('OCR Processing Failed.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleVerify = async () => {
    if (!extractedPrescription || capturedTablets.length === 0) return;
    setLoading(true);
    setLoadingMsg(t.analyzing);
    setLoadingSubMsg("Deep reasoning with Gemini 3 Pro...");
    try {
      const result = await verifyMedicineSafety(user, extractedPrescription, capturedTablets, language);
      setFinalResult(result);
      onComplete(result);
      setStep(4);
    } catch (err) {
      alert("Safety audit failed.");
    } finally {
      setLoading(false);
    }
  };

  const removeTablet = (index: number) => {
    const newTablets = [...capturedTablets];
    newTablets.splice(index, 1);
    setCapturedTablets(newTablets);
    if (newTablets.length === 0) setStep(2);
  };

  const getScoreColor = (score?: number) => {
    if (score === undefined) return 'bg-slate-200';
    if (score >= 0.9) return 'bg-emerald-500';
    if (score >= 0.7) return 'bg-blue-500';
    if (score >= 0.4) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getScoreLabel = (score?: number) => {
    if (score === undefined) return 'N/A';
    if (score >= 0.95) return 'Precise';
    if (score >= 0.75) return 'Acceptable';
    if (score >= 0.45) return 'Variance';
    return 'Conflict';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-12 animate-in fade-in max-w-3xl mx-auto px-6">
        <div className="w-24 h-24 border-8 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
        <div className="text-center space-y-2">
           <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{loadingMsg}</h2>
           <p className="text-slate-500 dark:text-slate-400 font-medium italic">{loadingSubMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500 px-4 pb-24">
      {step < 4 && (
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">{t.safety_flow_title}</h1>
          <div className="flex gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${step >= i ? 'bg-blue-600 border-blue-200' : 'bg-slate-200 border-transparent dark:bg-slate-800'}`}></div>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <Card title={`Step 1: ${t.step1_title}`} className="rounded-[2.5rem] p-10 border-none shadow-2xl">
          <div className="text-center space-y-8 py-6">
            <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/30 rounded-3xl mx-auto flex items-center justify-center text-4xl text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
              <i className="fas fa-file-prescription"></i>
            </div>
            <div className="space-y-2">
               <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">{t.step1_title}</h3>
               <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto">{t.step1_desc}</p>
            </div>
            <input type="file" className="hidden" ref={prescriptionCameraRef} onChange={handleCapturePrescription} accept="image/*" />
            <Button onClick={() => prescriptionCameraRef.current?.click()} className="w-full h-16 rounded-2xl text-lg font-black shadow-xl shadow-blue-500/10">
               <i className="fas fa-camera mr-2"></i> {t.step1_btn}
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card title={`Step 2: ${t.step2_title}`} className="rounded-[2.5rem] p-10 border-none shadow-2xl">
          {!showCamera ? (
            <div className="text-center space-y-8 py-6">
              <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/30 rounded-3xl mx-auto flex items-center justify-center text-4xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                <i className="fas fa-pills"></i>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">{t.step2_title}</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto">{t.step2_desc}</p>
              </div>

              {processingProgress ? (
                <div className="p-8 bg-blue-50 dark:bg-blue-900/20 rounded-[2rem] border border-blue-100 dark:border-blue-800 animate-in fade-in">
                  <div className="flex justify-between items-end mb-3">
                    <p className="font-black text-sm text-blue-600 uppercase tracking-widest">{t.processing}...</p>
                    <p className="font-black text-lg text-blue-800 dark:text-blue-200">{processingProgress.current} {t.scanned_of} {processingProgress.total}</p>
                  </div>
                  <div className="w-full h-4 bg-white dark:bg-slate-800 rounded-full overflow-hidden border border-blue-100 dark:border-blue-700">
                    <div 
                      className="h-full bg-blue-600 transition-all duration-500" 
                      style={{ width: `${(processingProgress.current / processingProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Button onClick={startCamera} className="h-16 rounded-2xl text-lg font-black bg-indigo-600 shadow-xl shadow-indigo-500/10">
                     <i className="fas fa-microscope mr-2"></i> {t.step2_btn_live}
                  </Button>
                  <input type="file" multiple className="hidden" ref={tabletGalleryRef} onChange={handleGalleryTabletUpload} accept="image/*" />
                  <Button variant="secondary" onClick={() => tabletGalleryRef.current?.click()} className="h-16 rounded-2xl text-lg font-black shadow-xl">
                     <i className="fas fa-images mr-2"></i> {t.step2_btn_gallery}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-900 dark:border-slate-800 bg-black">
               <video ref={videoRef} autoPlay playsInline className="w-full aspect-video object-cover opacity-80" />
               <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
               <div className="absolute bottom-10 left-0 right-0 flex justify-center px-12 gap-4">
                  <Button variant="danger" onClick={stopCamera} className="h-16 w-16 p-0 rounded-2xl shadow-2xl">
                     <i className="fas fa-times"></i>
                  </Button>
                  <Button onClick={captureTablet} className="h-16 flex-grow rounded-2xl bg-white text-slate-900 font-black shadow-2xl active:scale-95 transition-transform">
                     <i className="fas fa-camera mr-2"></i> {t.capture_prescription}
                  </Button>
               </div>
            </div>
          )}
        </Card>
      )}

      {step === 3 && (
        <Card title={`Step 3: ${t.step3_title}`} className="rounded-[2.5rem] p-10 border-none shadow-2xl">
          <div className="space-y-10">
            <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-800/50">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">{t.scan_prescription}</p>
                <div className="space-y-3">
                   {extractedPrescription?.medicines.map((med, i) => (
                     <div key={i} className="flex justify-between items-center">
                        <p className="font-black text-xl text-slate-900 dark:text-white leading-tight">{med.name}</p>
                        <Badge color="blue" className="px-3">{med.dosage}</Badge>
                     </div>
                   ))}
                </div>
            </div>

            <div className="space-y-4">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t.observed_entities} ({capturedTablets.length})</p>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {capturedTablets.map((tablet, i) => (
                   <div key={i} className="group relative p-6 bg-indigo-50 dark:bg-indigo-900/10 rounded-3xl border border-indigo-100 dark:border-indigo-800/50 hover:border-indigo-300 transition-colors">
                      <button onClick={() => removeTablet(i)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors">
                         <i className="fas fa-times-circle text-xl"></i>
                      </button>
                      <div className="flex gap-4">
                         {tablet.imageUrl && <img src={tablet.imageUrl} className="w-16 h-16 rounded-xl object-cover shadow-md" alt="Pill" />}
                         <div className="space-y-1 overflow-hidden">
                            <p className="font-black text-lg text-slate-900 dark:text-white leading-tight truncate">{tablet.name}</p>
                            <Badge color="blue" className="px-3">{tablet.imprint}</Badge>
                         </div>
                      </div>
                   </div>
                 ))}
                 <button onClick={() => setStep(2)} className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-slate-400 hover:text-blue-500 hover:border-blue-200 transition-all group">
                    <i className="fas fa-plus-circle text-2xl mb-2 group-hover:scale-110 transition-transform"></i>
                    <p className="text-[10px] font-black uppercase tracking-widest">{t.new_verification}</p>
                 </button>
               </div>
            </div>

            <Button onClick={handleVerify} className="w-full h-24 rounded-[2rem] text-xl font-black bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xl shadow-blue-500/20 hover:-translate-y-1 active:translate-y-1 transition-all">
               {t.step3_btn}
            </Button>
          </div>
        </Card>
      )}

      {step === 4 && finalResult && (
        <div className="space-y-10 animate-in zoom-in-95 duration-700">
           <div className={`p-12 rounded-[4rem] text-center text-white shadow-2xl relative overflow-hidden ${
             finalResult.status === MatchStatus.PERFECT_MATCH ? 'bg-emerald-600' : 'bg-rose-600'
           }`}>
              <div className="relative z-10 space-y-6">
                 <div className="w-24 h-24 bg-white/20 rounded-[2.5rem] flex items-center justify-center text-5xl mx-auto shadow-2xl backdrop-blur-md">
                    <i className={`fas ${finalResult.status === MatchStatus.PERFECT_MATCH ? 'fa-shield-check' : 'fa-triangle-exclamation'}`}></i>
                 </div>
                 <div>
                    <h2 className="text-5xl font-black mb-2 tracking-tighter uppercase">{finalResult.status.replace('_', ' ')}</h2>
                    <p className="text-white/80 font-black uppercase tracking-[0.3em] text-[12px]">{t.integrity_score}: {(finalResult.matchScore * 100).toFixed(0)}%</p>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 space-y-8">
                <Card title={t.audit_breakdown} className="rounded-[3rem] p-10 border-none shadow-2xl bg-white dark:bg-slate-900">
                   <div className="space-y-12">
                      {finalResult.identifiedTablets.map((tablet, idx) => (
                        <div key={idx} className="space-y-10">
                          <div className="flex justify-between items-start border-b border-slate-50 dark:border-slate-800 pb-6">
                            <div>
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{t.observed_entities}</p>
                               <h4 className="font-black text-3xl text-slate-900 dark:text-white leading-tight">{tablet.name}</h4>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-8">
                             {[
                               { label: 'Identity', score: tablet.identityScore, icon: 'fa-vial' },
                               { label: 'Dosage', score: tablet.posologyScore, icon: 'fa-weight-hanging' }
                             ].map((s, i) => (
                               <div key={i} className="space-y-3">
                                  <div className="flex justify-between items-end">
                                     <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getScoreColor(s.score)} bg-opacity-10 text-blue-600`}>
                                           <i className={`fas ${s.icon}`}></i>
                                        </div>
                                        <p className="font-black text-sm text-slate-800 dark:text-slate-100 uppercase tracking-tight">{s.label}</p>
                                     </div>
                                     <p className="font-black text-lg text-slate-900 dark:text-white">{(s.score || 0) * 100}%</p>
                                  </div>
                                  <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                     <div className={`h-full transition-all duration-1000 ${getScoreColor(s.score)}`} style={{ width: `${(s.score || 0) * 100}%` }}></div>
                                  </div>
                               </div>
                             ))}
                          </div>

                          {tablet.discrepancyDetails && (
                             <div className="p-6 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100">
                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">{t.audit_trace}</p>
                                <p className="text-sm font-bold text-amber-900 dark:text-amber-200">{tablet.discrepancyDetails}</p>
                             </div>
                          )}

                          <div className="space-y-6 pt-8 border-t border-slate-50 dark:border-slate-800">
                             <h5 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2">{t.medication_intelligence}</h5>
                             <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-2">
                                   <p className="flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tighter">
                                      <i className="fas fa-hand-holding-heart text-blue-500"></i> {t.primary_uses}
                                   </p>
                                   <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                                      {tablet.uses || 'Standard therapeutic use cases apply.'}
                                   </p>
                                </div>
                                <div className="space-y-2">
                                   <p className="flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tighter">
                                      <i className="fas fa-triangle-exclamation text-amber-500"></i> {t.side_effects}
                                   </p>
                                   <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                                      {tablet.sideEffects || 'Common pharmacological reactions may occur.'}
                                   </p>
                                </div>
                                <div className="space-y-2">
                                   <p className="flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tighter">
                                      <i className="fas fa-shield-virus text-rose-500"></i> {t.special_warnings}
                                   </p>
                                   <p className="text-sm font-bold text-rose-700 dark:text-rose-400 leading-relaxed bg-rose-50 dark:bg-rose-950/20 p-4 rounded-2xl border border-rose-100 dark:border-rose-900/30">
                                      {tablet.specialWarnings || 'Consult your physician for specific contraindications.'}
                                   </p>
                                </div>
                             </div>
                          </div>
                        </div>
                      ))}
                   </div>
                </Card>
              </div>

              <div className="lg:col-span-5 space-y-8">
                <Card title={t.critical_risks} className="rounded-[3rem] p-10 border-none shadow-2xl bg-white dark:bg-slate-900">
                  <div className="space-y-6">
                      {finalResult.alerts.map((alert, i) => (
                        <div key={i} className={`p-6 rounded-3xl border-2 ${alert.type === AlertSeverity.CRITICAL ? 'bg-red-50 border-red-100 text-red-700' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
                           <p className="font-black text-lg uppercase tracking-tight mb-2">{alert.title}</p>
                           <p className="text-sm font-bold opacity-80 leading-relaxed">{alert.description}</p>
                        </div>
                      ))}
                  </div>
                </Card>
                <Button onClick={() => navigate('/')} className="w-full h-20 rounded-[2rem] bg-blue-600 text-white font-black text-xl shadow-2xl">
                   {t.back}
                </Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default MedicineVerificationFlow;
