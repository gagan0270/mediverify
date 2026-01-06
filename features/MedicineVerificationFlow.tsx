
import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, VerificationResult, PrescriptionData, TabletData, MatchStatus, Language, AlertSeverity } from '../types';
import { Card, Button, Badge } from '../components/UI';
import { analyzePrescription, identifyTablet, verifyMedicineSafety } from '../services/geminiService';
import { useNavigate } from 'react-router-dom';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { useLanguage } from '../App';

interface Props {
  user: UserProfile;
  onComplete: (result: VerificationResult) => void;
}

const MedicineVerificationFlow: React.FC<Props> = ({ user, onComplete }) => {
  const { t, language } = useLanguage();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [loadingSubMsg, setLoadingSubMsg] = useState('');
  
  const [extractedPrescription, setExtractedPrescription] = useState<PrescriptionData | null>(null);
  const [capturedTablets, setCapturedTablets] = useState<TabletData[]>([]);
  const [finalResult, setFinalResult] = useState<VerificationResult | null>(null);

  const [showCamera, setShowCamera] = useState(false);
  const [tfModel, setTfModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [focusScore, setFocusScore] = useState(0);
  const [distanceScore, setDistanceScore] = useState(0);
  const [lastBBox, setLastBBox] = useState<number[] | null>(null);

  const navigate = useNavigate();
  const prescriptionCameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const loadModel = async () => {
      try {
        await tf.ready();
        const model = await cocoSsd.load();
        setTfModel(model);
      } catch (err) {
        console.error("TF model load fail", err);
      }
    };
    loadModel();
  }, []);

  const sharpenImage = (ctx: CanvasRenderingContext2D, width: number, height: number, amount: number) => {
    const weights = [
      0, -1, 0,
      -1, 5 + amount, -1,
      0, -1, 0
    ];
    const side = Math.round(Math.sqrt(weights.length));
    const halfSide = Math.floor(side / 2);
    const src = ctx.getImageData(0, 0, width, height);
    const sw = src.width;
    const sh = src.height;
    const output = ctx.createImageData(sw, sh);
    const dst = output.data;
    const srcData = src.data;

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const sy = y;
        const sx = x;
        const dstOff = (y * sw + x) * 4;
        let r = 0, g = 0, b = 0;
        for (let cy = 0; cy < side; cy++) {
          for (let cx = 0; cx < side; cx++) {
            const scy = sy + cy - halfSide;
            const scx = sx + cx - halfSide;
            if (scy >= 0 && scy < sh && scx >= 0 && scx < sw) {
              const srcOff = (scy * sw + scx) * 4;
              const wt = weights[cy * side + cx];
              r += srcData[srcOff] * wt;
              g += srcData[srcOff + 1] * wt;
              b += srcData[srcOff + 2] * wt;
            }
          }
        }
        dst[dstOff] = Math.min(255, Math.max(0, r));
        dst[dstOff + 1] = Math.min(255, Math.max(0, g));
        dst[dstOff + 2] = Math.min(255, Math.max(0, b));
        dst[dstOff + 3] = srcData[dstOff + 3];
      }
    }
    ctx.putImageData(output, 0, 0);
  };

  const enhanceImage = (base64: string, forImprint: boolean = false, cropBox?: number[]): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(base64);

        if (forImprint && cropBox) {
          const [x, y, w, h] = cropBox;
          const pad = 20;
          canvas.width = Math.min(img.width - x, w + pad * 2);
          canvas.height = Math.min(img.height - y, h + pad * 2);
          ctx.drawImage(img, Math.max(0, x - pad), Math.max(0, y - pad), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
        }
        
        if (forImprint) {
          ctx.filter = 'contrast(2.5) brightness(1.2) grayscale(1)';
        } else {
          // Boosted contrast specifically for OCR of text documents/prescriptions
          ctx.filter = 'contrast(2.2) brightness(1.1) grayscale(1)';
        }
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.filter = ctx.filter;
        tempCtx.drawImage(canvas, 0, 0);
        
        // Increased sharpening for prescriptions to help OCR engine
        sharpenImage(tempCtx, tempCanvas.width, tempCanvas.height, forImprint ? 2.5 : 1.5);
        resolve(tempCanvas.toDataURL('image/jpeg', 0.95));
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
          
          const tabletCandidate = predictions.find(p => p.score > 0.35);
          if (tabletCandidate) {
            const [x, y, width, height] = tabletCandidate.bbox;
            const confidence = tabletCandidate.score;
            setLastBBox(tabletCandidate.bbox);
            
            const idealSize = Math.min(canvas.width, canvas.height) * 0.45;
            const currentSize = Math.max(width, height);
            const distRatio = Math.min(currentSize / idealSize, idealSize / currentSize);
            
            setDistanceScore(Math.min(distRatio, 1));
            setFocusScore(Math.min(confidence, 1));

            const isGood = confidence > 0.75 && distRatio > 0.7;
            const isFair = confidence > 0.5 && distRatio > 0.5;
            const qualityColor = isGood ? '#22c55e' : isFair ? '#eab308' : '#ef4444';
            
            ctx.strokeStyle = qualityColor;
            ctx.lineWidth = 6;
            ctx.lineJoin = 'round';
            ctx.strokeRect(x, y, width, height);
          } else {
            setDistanceScore(0);
            setFocusScore(0);
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
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.95);
      
      const currentBBox = lastBBox;
      stopCamera();
      setLoading(true);
      setLoadingMsg("Identifying Medication...");
      setLoadingSubMsg("Applying specialized area-sharpening for imprint text isolation.");
      try {
        const enhanced = await enhanceImage(base64, true, currentBBox || undefined);
        const data = await identifyTablet(enhanced, language);
        setCapturedTablets(prev => [...prev, data]);
        setStep(3);
      } catch (err) {
        alert("Pill identification failed. Please try again with clearer lighting.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCapturePrescription = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setLoading(true);
      setLoadingMsg("Digitizing Prescription...");
      setLoadingSubMsg("Applying clinical-grade high-contrast filtering and sharpening for OCR.");
      try {
        const enhanced = await enhanceImage(base64);
        const data = await analyzePrescription(enhanced, language);
        setExtractedPrescription(data);
        setStep(2);
      } catch (err) {
        alert('Prescription scan failed. Please ensure text is clear and well-lit.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleVerify = async () => {
    if (!extractedPrescription || capturedTablets.length === 0) return;
    setLoading(true);
    setLoadingMsg("Running Clinical Audit...");
    setLoadingSubMsg("Nuanced posology matching and pharmacological color contrast audit in progress.");
    try {
      const result = await verifyMedicineSafety(user, extractedPrescription, capturedTablets, language);
      setFinalResult(result);
      onComplete(result);
      setStep(4);
    } catch (err) {
      alert("Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score?: number) => {
    if (score === undefined) return 'bg-slate-200 dark:bg-slate-800';
    if (score >= 0.95) return 'bg-emerald-500';
    if (score >= 0.8) return 'bg-blue-500';
    if (score >= 0.6) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-12 animate-in fade-in max-w-3xl mx-auto px-6">
        <div className="relative">
          <div className="w-48 h-48 border-[12px] border-slate-100 dark:border-slate-800 rounded-[4rem] animate-pulse"></div>
          <div className="absolute inset-0 flex items-center justify-center">
             <i className="fas fa-shield-heart text-blue-600 dark:text-blue-400 text-6xl animate-bounce"></i>
          </div>
        </div>
        <div className="text-center space-y-4">
           <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{loadingMsg}</h2>
           <p className="text-slate-500 dark:text-slate-400 font-medium italic">{loadingSubMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500 px-4 pb-24">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">Safety Check</h1>
        <div className="flex gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full transition-all ${step >= i ? 'bg-blue-600 scale-110' : 'bg-slate-200 dark:bg-slate-800 opacity-50'}`}></div>
          ))}
        </div>
      </div>

      {step === 1 && (
        <Card title="Step 1: Scan Prescription" className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden p-10">
          <div className="space-y-10 text-center py-6">
            <div className="w-32 h-32 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-[2.5rem] mx-auto flex items-center justify-center text-5xl shadow-inner">
              <i className="fas fa-file-prescription"></i>
            </div>
            <div className="space-y-3">
               <h2 className="text-3xl font-black text-slate-900 dark:text-white">Upload Prescription</h2>
               <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto">AI will extract medicine names, dosages, and frequency for matching.</p>
            </div>
            <input type="file" className="hidden" ref={prescriptionCameraRef} onChange={handleCapturePrescription} accept="image/*" />
            <Button onClick={() => prescriptionCameraRef.current?.click()} className="w-full h-20 rounded-[1.5rem] text-xl font-black shadow-xl shadow-blue-500/20">
               <i className="fas fa-camera mr-3"></i> Take or Upload Photo
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card title="Step 2: Identify Medication" className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden p-10">
          {!showCamera ? (
            <div className="space-y-10 text-center py-6">
              <div className="w-32 h-32 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-[2.5rem] mx-auto flex items-center justify-center text-5xl shadow-inner">
                <i className="fas fa-pills"></i>
              </div>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white">Scan Physical Pill</h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto mb-4">Position the tablet clearly. Our AI will automatically sharpen the imprint area for verification.</p>
              <Button onClick={startCamera} className="w-full h-20 rounded-[1.5rem] text-xl font-black bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-500/20">
                 <i className="fas fa-microscope mr-3"></i> Open Scanner
              </Button>
            </div>
          ) : (
            <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-slate-900 dark:border-slate-800">
               <video ref={videoRef} autoPlay playsInline className="w-full aspect-[4/3] object-cover" />
               <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
               
               <div className="absolute top-8 left-8 right-8 flex justify-between gap-4">
                  <Badge color="blue" className="bg-black/40 backdrop-blur-xl border-white/20 text-white px-6 py-2 uppercase tracking-[0.2em] font-black">
                     Area-Specific Capture
                  </Badge>
               </div>

               <div className="absolute bottom-12 left-0 right-0 flex justify-center px-12 gap-4">
                  <Button variant="danger" onClick={stopCamera} className="h-20 w-20 rounded-2xl p-0">
                     <i className="fas fa-times text-2xl"></i>
                  </Button>
                  <Button onClick={captureTablet} className="h-20 flex-grow rounded-2xl bg-white text-slate-900 hover:bg-slate-100 shadow-2xl font-black text-xl">
                     <i className="fas fa-circle text-red-500 mr-3 animate-pulse"></i> Capture Imprint
                  </Button>
               </div>
            </div>
          )}
        </Card>
      )}

      {step === 3 && (extractedPrescription || capturedTablets.length > 0) && (
        <Card title="Step 3: Verification Audit" className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden p-10">
          <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Prescription Data</p>
                 <div className="space-y-3">
                   <p className="font-black text-2xl text-slate-900 dark:text-white leading-tight">Dr. {extractedPrescription?.doctorName}</p>
                   <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{extractedPrescription?.medicines?.[0]?.name}</p>
                   <p className="text-xs font-bold text-slate-500">{extractedPrescription?.medicines?.[0]?.dosage} • {extractedPrescription?.medicines?.[0]?.frequency}</p>
                 </div>
              </div>
              <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Physical Identification</p>
                 <div className="flex items-center gap-6">
                    <img src={capturedTablets[0]?.imageUrl} className="w-16 h-16 rounded-2xl object-cover shadow-xl border-2 border-white dark:border-slate-700" alt="Pill" />
                    <div>
                      <p className="font-black text-2xl text-slate-900 dark:text-white leading-tight">{capturedTablets[0]?.name}</p>
                      <Badge color="blue" className="mt-2 font-black">Imprint: {capturedTablets[0]?.imprint}</Badge>
                    </div>
                 </div>
              </div>
            </div>
            <Button onClick={handleVerify} className="w-full h-20 rounded-[1.5rem] text-2xl font-black shadow-2xl shadow-blue-500/20 bg-blue-600">
               <i className="fas fa-shield-check mr-3"></i> Run Full Safety Audit
            </Button>
          </div>
        </Card>
      )}

      {step === 4 && finalResult && (
        <div className="space-y-10 animate-in zoom-in-95 duration-700 pb-20">
           <div className={`p-16 rounded-[4rem] text-center text-white shadow-2xl relative overflow-hidden ${
             finalResult.status === MatchStatus.PERFECT_MATCH ? 'bg-gradient-to-br from-emerald-500 to-teal-700' : 
             finalResult.status === MatchStatus.PARTIAL_MATCH ? 'bg-gradient-to-br from-amber-500 to-orange-700' : 'bg-gradient-to-br from-rose-600 to-red-800'
           }`}>
              <div className="absolute top-0 right-0 p-16 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                 <i className={`fas ${finalResult.status === MatchStatus.PERFECT_MATCH ? 'fa-check-circle' : 'fa-biohazard'} text-[200px]`}></i>
              </div>
              <div className="relative z-10 space-y-8">
                <div className="w-24 h-24 bg-white/20 rounded-[2rem] mx-auto flex items-center justify-center text-5xl backdrop-blur-xl border border-white/30 shadow-2xl">
                   <i className={`fas ${finalResult.status === MatchStatus.PERFECT_MATCH ? 'fa-check-double' : 'fa-triangle-exclamation'}`}></i>
                </div>
                <div>
                  <h2 className="text-5xl font-black tracking-tighter mb-3 drop-shadow-md">
                    {finalResult.status === MatchStatus.PERFECT_MATCH ? 'Verified Safe' : 
                     finalResult.status === MatchStatus.PARTIAL_MATCH ? 'Caution Advised' : 'Critical Alert'}
                  </h2>
                  <p className="text-white/80 font-black uppercase tracking-[0.3em] text-xs">
                    Clinical Match Score: {(finalResult.matchScore * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card title="Clinical Insights" className="rounded-[2.5rem] border-none shadow-xl p-8">
                 <div className="space-y-10">
                    {(finalResult.identifiedTablets || []).map((tablet, idx) => (
                      <div key={idx} className="space-y-8">
                        <div className="p-8 bg-slate-50 dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-800">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Therapeutic Profile</p>
                           <p className="font-black text-2xl text-slate-900 dark:text-white mb-2 leading-none">{tablet.genericName}</p>
                           <p className="text-sm font-bold text-slate-500 dark:text-slate-400 italic mb-6">"{tablet.uses}"</p>
                           
                           <div className="grid grid-cols-3 gap-4">
                              {[
                                { label: 'Identity', score: tablet.identityScore },
                                { label: 'Dosage', score: tablet.posologyScore },
                                { label: 'Freq.', score: tablet.chronologyScore }
                              ].map((s, i) => (
                                <div key={i} className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">{s.label}</p>
                                   <div className="flex items-center gap-2">
                                      <div className={`w-2.5 h-2.5 rounded-full ${getScoreColor(s.score)}`}></div>
                                      <span className="font-black text-slate-800 dark:text-white">{(s.score || 0) * 100}%</span>
                                   </div>
                                </div>
                              ))}
                           </div>
                        </div>

                        <div className="space-y-6">
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <i className="fas fa-triangle-exclamation text-amber-500"></i> Side Effects & Warnings
                              </p>
                              <div className="bg-amber-50/50 dark:bg-amber-950/20 p-6 rounded-3xl border border-amber-100 dark:border-amber-900/30">
                                 <p className="text-xs font-bold text-amber-900 dark:text-amber-200 leading-relaxed mb-4">
                                   {tablet.sideEffects || 'Common side effects not specified.'}
                                 </p>
                                 {tablet.specialWarnings && (
                                   <div className="pt-4 border-t border-amber-200 dark:border-amber-900/40">
                                      <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-2">Patient-Specific Alert</p>
                                      <p className="text-xs font-black text-amber-700 dark:text-amber-400 leading-relaxed italic">{tablet.specialWarnings}</p>
                                   </div>
                                 )}
                              </div>
                           </div>

                           {tablet.colorContrastWarning && (
                             <div className="p-6 bg-red-50 dark:bg-red-950/20 rounded-3xl border-2 border-red-100 dark:border-red-900/30 animate-pulse">
                                <div className="flex items-center gap-3 text-red-600 dark:text-red-400 font-black text-sm uppercase mb-3">
                                   <i className="fas fa-eye-dropper"></i> Color Consistency Alert
                                </div>
                                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
                                   {tablet.colorContrastWarning}
                                </p>
                             </div>
                           )}
                        </div>
                      </div>
                    ))}
                 </div>
              </Card>

              <div className="space-y-8">
                <Card title="Safety Log" className="rounded-[2.5rem] border-none shadow-xl p-8">
                  <div className="space-y-4">
                      {finalResult.alerts.map((alert, i) => (
                        <div key={i} className={`p-6 rounded-[2rem] border-2 transition-all hover:scale-[1.02] ${
                          alert.type === AlertSeverity.CRITICAL ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30' : 
                          alert.type === AlertSeverity.MAJOR_WARNING ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/30' :
                          'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30'
                        }`}>
                           <div className="flex items-center gap-4 mb-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                alert.type === AlertSeverity.CRITICAL ? 'bg-red-600 text-white' : 
                                alert.type === AlertSeverity.MAJOR_WARNING ? 'bg-orange-500 text-white' :
                                'bg-blue-600 text-white'
                              }`}>
                                <i className={`fas ${
                                  alert.type === AlertSeverity.CRITICAL ? 'fa-skull-crossbones' : 
                                  alert.type === AlertSeverity.MAJOR_WARNING ? 'fa-biohazard' :
                                  'fa-info-circle'
                                }`}></i>
                              </div>
                              <p className="font-black text-slate-900 dark:text-white text-lg leading-tight">{alert.title}</p>
                           </div>
                           <p className="text-xs font-bold text-slate-600 dark:text-slate-400 leading-relaxed pl-14">
                              {alert.description}
                           </p>
                        </div>
                      ))}
                      {finalResult.alerts.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-emerald-500/30 gap-4">
                           <i className="fas fa-clipboard-check text-6xl"></i>
                           <p className="font-black uppercase tracking-widest text-xs">Clinical Consistency Verified</p>
                        </div>
                      )}
                  </div>
                </Card>

                <div className="p-8 bg-slate-900 dark:bg-slate-800 rounded-[3rem] text-white">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 text-center">Audit Intelligence Trace</p>
                   <p className="text-sm font-bold italic opacity-80 leading-relaxed text-center">
                      "Checked against clinical norms for {capturedTablets[0]?.name}. Audit includes nuanced dosage naming normalization and frequency chronology validation."
                   </p>
                </div>
              </div>
           </div>

           <Button onClick={() => navigate('/')} className="w-full h-20 rounded-[2rem] bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-2xl shadow-2xl transition-transform hover:scale-[1.02]">
              <i className="fas fa-check-double mr-3"></i> Finish & Save Audit
           </Button>
        </div>
      )}
    </div>
  );
};

export default MedicineVerificationFlow;
