
import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, VerificationResult, PrescriptionData, TabletData, MatchStatus, Language, AlertSeverity, PrescriptionMedicine } from '../types';
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
  
  const [processingProgress, setProcessingProgress] = useState<{current: number, total: number} | null>(null);

  const [allPrescriptions, setAllPrescriptions] = useState<PrescriptionData[]>([]);
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
        
        ctx.filter = isTextOCR ? 'contrast(2.2) grayscale(1) brightness(1.05)' : 'contrast(1.6) brightness(1.1) saturate(1.2)';
        
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

  const handleCapturePrescription = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setProcessingProgress({ current: 0, total: files.length });
    const newPrescriptions: PrescriptionData[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        setProcessingProgress({ current: i + 1, total: files.length });
        const file = files[i];
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const enhanced = await enhanceImage(base64, true);
        const data = await analyzePrescription(enhanced, language);
        newPrescriptions.push(data);
      }
      setAllPrescriptions(prev => [...prev, ...newPrescriptions]);
    } catch (err) {
      alert('Prescription processing failed.');
    } finally {
      setProcessingProgress(null);
    }
  };

  const handleGalleryTabletUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setProcessingProgress({ current: 0, total: files.length });
    const newTablets: TabletData[] = [];

    try {
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
        newTablets.push(data);
      }
      setCapturedTablets(prev => [...prev, ...newTablets]);
      setStep(3);
    } catch (err) {
      alert('Tablet identification failed.');
    } finally {
      setProcessingProgress(null);
    }
  };

  const handleVerify = async () => {
    if (allPrescriptions.length === 0 || capturedTablets.length === 0) return;
    setLoading(true);
    setLoadingMsg(t.analyzing);
    setLoadingSubMsg("Consolidated Safety Audit with Gemini Pro...");
    try {
      const result = await verifyMedicineSafety(user, allPrescriptions, capturedTablets, language);
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

  const removePrescription = (id: string) => {
    setAllPrescriptions(prev => prev.filter(p => p.id !== id));
  };

  const masterMedicineList = allPrescriptions.flatMap(pr => pr.medicines);
  const summary = {
    total: masterMedicineList.length,
    tablets: masterMedicineList.filter(m => m.type === 'Tablet').length,
    syrups: masterMedicineList.filter(m => m.type === 'Syrup').length,
    others: masterMedicineList.filter(m => m.type !== 'Tablet' && m.type !== 'Syrup').length,
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
        <div className="space-y-8 animate-in slide-in-from-bottom-8">
          <Card title={t.step1_title} className="rounded-[2.5rem] p-10 border-none shadow-2xl overflow-hidden relative">
            {processingProgress ? (
                <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 z-20 flex flex-col items-center justify-center p-12 text-center space-y-4">
                  <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="font-black text-xl text-slate-900 dark:text-white">{t.processing} {processingProgress.current} {t.scanned_of} {processingProgress.total}</p>
                </div>
            ) : null}

            <div className="text-center space-y-8 py-6">
              <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/30 rounded-3xl mx-auto flex items-center justify-center text-4xl text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                <i className="fas fa-file-prescription"></i>
              </div>
              <div className="space-y-2">
                 <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">{t.step1_title}</h3>
                 <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto">{t.step1_desc}</p>
              </div>
              <input type="file" multiple className="hidden" ref={prescriptionCameraRef} onChange={handleCapturePrescription} accept="image/*" />
              <Button onClick={() => prescriptionCameraRef.current?.click()} className="w-full h-16 rounded-2xl text-lg font-black shadow-xl shadow-blue-500/10">
                 <i className="fas fa-camera mr-2"></i> {t.step1_btn}
              </Button>
            </div>
          </Card>

          {allPrescriptions.length > 0 && (
            <div className="space-y-6 animate-in fade-in zoom-in-95">
               <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 text-center">
                    <p className="text-3xl font-black text-blue-600">{summary.total}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.items_detected}</p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 text-center">
                    <p className="text-2xl font-black text-emerald-600">{summary.tablets}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.tablets}</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/20 p-6 rounded-3xl border border-amber-100 dark:border-amber-900/30 text-center">
                    <p className="text-2xl font-black text-amber-600">{summary.syrups}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.syrups}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 text-center">
                    <p className="text-2xl font-black text-slate-600 dark:text-slate-300">{summary.others}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.others}</p>
                  </div>
               </div>

               <Card title={t.detected_summary} className="rounded-3xl p-8 shadow-xl">
                  <div className="space-y-4">
                    {allPrescriptions.map((pr, pIdx) => (
                      <div key={pr.id} className="pb-6 border-b border-slate-50 last:border-0 last:pb-0">
                         <div className="flex justify-between items-center mb-4">
                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Prescription #{pIdx + 1} - {pr.doctorName || 'Unknown Doctor'}</p>
                            <button onClick={() => removePrescription(pr.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                               <i className="fas fa-trash"></i>
                            </button>
                         </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                           {pr.medicines.map((med, mIdx) => (
                             <div key={mIdx} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex justify-between items-center border border-slate-100 dark:border-slate-700">
                                <div>
                                   <p className="font-black text-slate-900 dark:text-white leading-tight">{med.name}</p>
                                   <p className="text-[10px] text-slate-400 font-bold">{med.dosage} • {med.type}</p>
                                </div>
                                <i className={`fas ${med.type === 'Tablet' ? 'fa-pills text-blue-400' : med.type === 'Syrup' ? 'fa-prescription-bottle text-amber-400' : 'fa-vial text-slate-400'}`}></i>
                             </div>
                           ))}
                         </div>
                      </div>
                    ))}
                  </div>
               </Card>

               <div className="flex flex-col sm:flex-row gap-4">
                  <Button variant="ghost" className="flex-1 h-16 rounded-2xl font-black" onClick={() => prescriptionCameraRef.current?.click()}>
                     <i className="fas fa-plus-circle mr-2"></i> {t.add_another}
                  </Button>
                  <Button className="flex-[2] h-16 rounded-2xl font-black bg-blue-600 shadow-2xl" onClick={() => setStep(2)}>
                     {t.continue} <i className="fas fa-chevron-right ml-2"></i>
                  </Button>
               </div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <Card title={t.step2_title} className="rounded-[2.5rem] p-10 border-none shadow-2xl">
          {!showCamera ? (
            <div className="text-center space-y-8 py-6">
              <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/30 rounded-3xl mx-auto flex items-center justify-center text-4xl text-indigo-600 dark:text-indigo-400 rounded-3xl border border-indigo-100 dark:border-indigo-800">
                <i className="fas fa-pills"></i>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">{t.step2_title}</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto">{t.step2_desc}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button onClick={startCamera} className="h-16 rounded-2xl text-lg font-black bg-indigo-600 shadow-xl shadow-indigo-500/10">
                   <i className="fas fa-microscope mr-2"></i> {t.step2_btn_live}
                </Button>
                <input type="file" multiple className="hidden" ref={tabletGalleryRef} onChange={handleGalleryTabletUpload} accept="image/*" />
                <Button variant="secondary" onClick={() => tabletGalleryRef.current?.click()} className="h-16 rounded-2xl text-lg font-black shadow-xl">
                   <i className="fas fa-images mr-2"></i> {t.step2_btn_gallery}
                </Button>
              </div>
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
        <Card title={t.step3_title} className="rounded-[2.5rem] p-10 border-none shadow-2xl">
          <div className="space-y-10">
            <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-800/50">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">{t.scan_prescription}</p>
                <div className="space-y-3">
                   {masterMedicineList.map((med, i) => (
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
        <div className="space-y-12 animate-in zoom-in-95 duration-700">
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

           <div className="space-y-8">
              <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.5em] px-4">{t.audit_breakdown}</h3>
              {finalResult.identifiedTablets.map((tablet, idx) => {
                const prescribedMed = masterMedicineList.find(m => 
                  tablet.name.toLowerCase().includes(m.name.toLowerCase()) || 
                  m.name.toLowerCase().includes(tablet.name.toLowerCase())
                );

                return (
                  <Card key={idx} className="rounded-[3rem] p-0 border-none shadow-2xl bg-white dark:bg-slate-900 overflow-hidden">
                    <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                       <div className="flex items-center gap-6">
                          {tablet.imageUrl && (
                            <img src={tablet.imageUrl} className="w-20 h-20 rounded-2xl object-cover shadow-lg border-2 border-white dark:border-slate-700" alt="Pill" />
                          )}
                          <div>
                             <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{t.identified}</p>
                             <h4 className="font-black text-3xl text-slate-900 dark:text-white leading-none">{tablet.name}</h4>
                          </div>
                       </div>
                       <div className="text-right">
                          <Badge color={tablet.isMatch ? 'green' : 'red'} className="text-sm px-4 py-1.5 rounded-xl uppercase">
                             {tablet.isMatch ? t.match : t.mismatch}
                          </Badge>
                       </div>
                    </div>

                    <div className="p-10 space-y-12">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          <div className="space-y-8">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t.prescribed.toUpperCase()}</p>
                             <div className="space-y-6">
                                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                   <p className="text-[9px] font-black text-slate-400 mb-1 uppercase tracking-tight">{t.dosage}</p>
                                   <p className="text-xl font-black text-slate-800 dark:text-slate-100">{prescribedMed?.dosage || 'N/A'}</p>
                                </div>
                                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                   <p className="text-[9px] font-black text-slate-400 mb-1 uppercase tracking-tight">{t.frequency}</p>
                                   <p className="text-xl font-black text-slate-800 dark:text-slate-100">{prescribedMed?.frequency || 'N/A'}</p>
                                </div>
                             </div>
                          </div>

                          <div className="space-y-8">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t.identified.toUpperCase()}</p>
                             <div className="space-y-6">
                                <div className={`p-6 rounded-2xl border flex justify-between items-center transition-all ${tablet.posologyScore! >= 0.8 ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100' : 'bg-rose-50 dark:bg-rose-950/20 border-rose-100'}`}>
                                   <div>
                                      <p className={`text-[9px] font-black mb-1 uppercase tracking-tight ${tablet.posologyScore! >= 0.8 ? 'text-emerald-600' : 'text-rose-600'}`}>{t.dosage}</p>
                                      <p className="text-xl font-black text-slate-800 dark:text-slate-100">{tablet.dosage || 'Unknown'}</p>
                                   </div>
                                   <i className={`fas ${tablet.posologyScore! >= 0.8 ? 'fa-check-circle text-emerald-500' : 'fa-times-circle text-rose-500'} text-2xl`}></i>
                                </div>
                                <div className={`p-6 rounded-2xl border flex justify-between items-center transition-all ${tablet.chronologyScore! >= 0.8 ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100' : 'bg-rose-50 dark:bg-rose-950/20 border-rose-100'}`}>
                                   <div>
                                      <p className={`text-[9px] font-black mb-1 uppercase tracking-tight ${tablet.chronologyScore! >= 0.8 ? 'text-emerald-600' : 'text-rose-600'}`}>{t.frequency}</p>
                                      <p className="text-xl font-black text-slate-800 dark:text-slate-100">{tablet.frequency || 'Unknown'}</p>
                                   </div>
                                   <i className={`fas ${tablet.chronologyScore! >= 0.8 ? 'fa-check-circle text-emerald-500' : 'fa-times-circle text-rose-500'} text-2xl`}></i>
                                </div>
                             </div>
                          </div>
                       </div>

                       {tablet.discrepancyDetails && (
                          <div className="p-8 bg-amber-50 dark:bg-amber-950/20 rounded-[2.5rem] border-2 border-amber-100 dark:border-amber-900/30">
                             <div className="flex gap-4 items-start">
                                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                                   <i className="fas fa-search"></i>
                                </div>
                                <div>
                                   <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">{t.audit_trace}</p>
                                   <p className="text-lg font-bold text-amber-900 dark:text-amber-200 leading-relaxed italic">"{tablet.discrepancyDetails}"</p>
                                </div>
                             </div>
                          </div>
                       )}

                       <div className="space-y-10 pt-10 border-t border-slate-50 dark:border-slate-800">
                          <div className="flex items-center gap-3">
                             <div className="h-px flex-grow bg-slate-50 dark:bg-slate-800"></div>
                             <h5 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">{t.medication_intelligence}</h5>
                             <div className="h-px flex-grow bg-slate-50 dark:bg-slate-800"></div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="space-y-3">
                                <p className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">
                                   <i className="fas fa-dna text-indigo-500"></i> {t.pharmacology}
                                </p>
                                <div className="p-6 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-3xl border border-indigo-50 dark:border-indigo-800/50">
                                   <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200 mb-2 uppercase tracking-tight">{tablet.pharmacologyClass || 'General Pharmaceutical'}</p>
                                   <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed italic">
                                      {tablet.mechanismOfAction || 'Mechanism not specified.'}
                                   </p>
                                </div>
                             </div>

                             <div className="space-y-3">
                                <p className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">
                                   <i className="fas fa-hand-holding-heart text-blue-500"></i> {t.primary_uses}
                                </p>
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-700">
                                   {tablet.uses || 'Used for standard clinical therapeutic indications.'}
                                </p>
                             </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="space-y-3">
                                <p className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">
                                   <i className="fas fa-triangle-exclamation text-amber-500"></i> {t.side_effects}
                                </p>
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-700">
                                   {tablet.sideEffects || 'Mild symptoms may occur depending on patient tolerance.'}
                                </p>
                             </div>
                             <div className="space-y-3">
                                <p className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">
                                   <i className="fas fa-shield-virus text-rose-500"></i> {t.special_warnings}
                                </p>
                                <p className="text-sm font-bold text-rose-700 dark:text-rose-300 leading-relaxed bg-rose-50 dark:bg-rose-950/20 p-6 rounded-3xl border border-rose-100 dark:border-rose-900/30">
                                   {tablet.specialWarnings || 'Always consult a medical professional before administration.'}
                                </p>
                             </div>
                          </div>
                       </div>
                    </div>
                  </Card>
                );
              })}
           </div>

           <div className="max-w-md mx-auto">
              <Button onClick={() => navigate('/')} className="w-full h-24 rounded-[2.5rem] bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xl shadow-2xl hover:-translate-y-1 transition-all">
                 <i className="fas fa-house-user mr-3"></i> {t.back}
              </Button>
           </div>
        </div>
      )}
    </div>
  );
};

export default MedicineVerificationFlow;
