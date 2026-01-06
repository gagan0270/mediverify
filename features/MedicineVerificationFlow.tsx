
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
        const dstOff = (y * sw + x) * 4;
        let r = 0, g = 0, b = 0;
        for (let cy = 0; cy < side; cy++) {
          for (let cx = 0; cx < side; cx++) {
            const scy = y + cy - halfSide;
            const scx = x + cx - halfSide;
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

  const enhanceImage = (base64: string, isTextOCR: boolean = false, cropBox?: number[]): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(base64);

        if (!isTextOCR && cropBox) {
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
        
        if (isTextOCR) {
          // Sharp contrast for handwriting
          ctx.filter = 'contrast(3.5) brightness(1.1) grayscale(1)';
        } else {
          ctx.filter = 'contrast(2.2) brightness(1.1) grayscale(1)';
        }
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.filter = ctx.filter;
        tempCtx.drawImage(canvas, 0, 0);
        
        sharpenImage(tempCtx, tempCanvas.width, tempCanvas.height, isTextOCR ? 4.0 : 2.0);
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
            setLastBBox(tabletCandidate.bbox);
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 6;
            ctx.strokeRect(x, y, width, height);
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
        video: { facingMode: 'environment', width: { ideal: 1920 } } 
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
      setLoadingMsg("Identifying Tablet...");
      setLoadingSubMsg("Extracting pharmaceutical imprints.");
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
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setLoading(true);
      setLoadingMsg("Analyzing Prescription...");
      setLoadingSubMsg("Applying OCR enhancement filters for handwriting clarity.");
      try {
        const enhanced = await enhanceImage(base64, true);
        const data = await analyzePrescription(enhanced, language);
        setExtractedPrescription(data);
        setStep(2);
      } catch (err) {
        alert('Prescription scan failed.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleVerify = async () => {
    if (!extractedPrescription || capturedTablets.length === 0) return;
    setLoading(true);
    setLoadingMsg("Safety Audit In Progress...");
    setLoadingSubMsg("Performing multi-dimensional clinical matching.");
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
    if (score === undefined) return 'bg-slate-200';
    if (score >= 0.9) return 'bg-emerald-500';
    if (score >= 0.7) return 'bg-blue-500';
    if (score >= 0.4) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getScoreText = (score?: number) => {
    if (score === undefined) return 'N/A';
    if (score >= 0.95) return 'Optimal';
    if (score >= 0.7) return 'Acceptable';
    if (score >= 0.4) return 'Variant';
    return 'Mismatch';
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
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Safety Check</h1>
          <div className="flex gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className={`w-3 h-3 rounded-full ${step >= i ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'}`}></div>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <Card title="Prescription Scan" className="rounded-[2.5rem] p-10">
          <div className="text-center space-y-8 py-6">
            <div className="w-24 h-24 bg-blue-50 rounded-3xl mx-auto flex items-center justify-center text-4xl text-blue-600">
              <i className="fas fa-file-prescription"></i>
            </div>
            <p className="text-slate-500 font-medium max-w-sm mx-auto">Upload your doctor's prescription. We'll enhance the handwriting for better OCR matching.</p>
            <input type="file" className="hidden" ref={prescriptionCameraRef} onChange={handleCapturePrescription} accept="image/*" />
            <Button onClick={() => prescriptionCameraRef.current?.click()} className="w-full h-16 rounded-2xl text-lg font-black">
               <i className="fas fa-camera mr-2"></i> Take or Upload Photo
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card title="Pill Scanner" className="rounded-[2.5rem] p-10">
          {!showCamera ? (
            <div className="text-center space-y-8 py-6">
              <div className="w-24 h-24 bg-indigo-50 rounded-3xl mx-auto flex items-center justify-center text-4xl text-indigo-600">
                <i className="fas fa-pills"></i>
              </div>
              <p className="text-slate-500 font-medium max-w-sm mx-auto">Scan the physical pill. Our algorithm identifies the imprint, color, and shape.</p>
              <Button onClick={startCamera} className="w-full h-16 rounded-2xl text-lg font-black bg-indigo-600">
                 <i className="fas fa-microscope mr-2"></i> Start Pill Scanner
              </Button>
            </div>
          ) : (
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-900">
               <video ref={videoRef} autoPlay playsInline className="w-full aspect-video object-cover" />
               <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
               <div className="absolute bottom-10 left-0 right-0 flex justify-center px-12 gap-4">
                  <Button variant="danger" onClick={stopCamera} className="h-16 w-16 p-0 rounded-2xl">
                     <i className="fas fa-times"></i>
                  </Button>
                  <Button onClick={captureTablet} className="h-16 flex-grow rounded-2xl bg-white text-slate-900 font-black">
                     <i className="fas fa-camera mr-2"></i> Capture Imprint
                  </Button>
               </div>
            </div>
          )}
        </Card>
      )}

      {step === 3 && (
        <Card title="Verify Data" className="rounded-[2.5rem] p-10">
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Prescribed</p>
                 <p className="font-black text-lg text-slate-900 dark:text-white">{extractedPrescription?.medicines?.[0]?.name}</p>
                 <p className="text-xs font-bold text-blue-600">{extractedPrescription?.medicines?.[0]?.dosage}</p>
              </div>
              <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Identified</p>
                 <p className="font-black text-lg text-slate-900 dark:text-white">{capturedTablets[0]?.name}</p>
                 <Badge color="blue">{capturedTablets[0]?.imprint}</Badge>
              </div>
            </div>
            <Button onClick={handleVerify} className="w-full h-20 rounded-3xl text-xl font-black bg-blue-600">
               Run Nuanced Safety Check
            </Button>
          </div>
        </Card>
      )}

      {step === 4 && finalResult && (
        <div className="space-y-8 animate-in zoom-in-95 duration-500">
           <div className={`p-12 rounded-[3.5rem] text-center text-white shadow-2xl ${
             finalResult.status === MatchStatus.PERFECT_MATCH ? 'bg-emerald-600' : 
             finalResult.status === MatchStatus.PARTIAL_MATCH ? 'bg-amber-500' : 'bg-rose-600'
           }`}>
              <i className={`fas ${finalResult.status === MatchStatus.PERFECT_MATCH ? 'fa-check-circle' : 'fa-exclamation-triangle'} text-6xl mb-6`}></i>
              <h2 className="text-4xl font-black mb-2">{finalResult.status.replace('_', ' ')}</h2>
              <p className="text-white/80 font-bold uppercase tracking-widest text-[10px]">Clinical Integrity Score: {(finalResult.matchScore * 100).toFixed(0)}%</p>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card title="Clinical Match Scores" className="rounded-[2.5rem] p-8">
                 <div className="space-y-10">
                    {finalResult.identifiedTablets.map((tablet, idx) => (
                      <div key={idx} className="space-y-8">
                        <div>
                          <p className="font-black text-2xl mb-2 text-slate-900 dark:text-white">{tablet.name}</p>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Multi-Factor Analysis</p>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-6">
                           {[
                             { label: 'Drug Identity', score: tablet.identityScore, icon: 'fa-vial' },
                             { label: 'Dosage Precision', score: tablet.posologyScore, icon: 'fa-weight-hanging' },
                             { label: 'Frequency Pattern', score: tablet.chronologyScore, icon: 'fa-calendar-check' }
                           ].map((s, i) => (
                             <div key={i} className="space-y-2">
                                <div className="flex justify-between items-end mb-1">
                                   <div className="flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tighter">
                                      <i className={`fas ${s.icon} opacity-40`}></i>
                                      {s.label}
                                   </div>
                                   <div className="text-[10px] font-black uppercase text-slate-400">{getScoreText(s.score)}</div>
                                </div>
                                <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                   <div className={`h-full transition-all duration-1000 ${getScoreColor(s.score)}`} style={{ width: `${(s.score || 0) * 100}%` }}></div>
                                </div>
                             </div>
                           ))}
                        </div>

                        {tablet.discrepancyDetails && (
                           <div className="p-5 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border-2 border-amber-100 dark:border-amber-900/30">
                              <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase mb-2">Discrepancy Details</p>
                              <p className="text-sm font-bold text-amber-800 dark:text-amber-200 leading-relaxed italic">"{tablet.discrepancyDetails}"</p>
                           </div>
                        )}
                      </div>
                    ))}
                 </div>
              </Card>

              <div className="space-y-6">
                <Card title="Clinical Safety Alerts" className="rounded-[2.5rem] p-8">
                  <div className="space-y-4">
                      {finalResult.alerts.map((alert, i) => (
                        <div key={i} className={`p-5 rounded-2xl border-2 transition-all hover:scale-[1.02] ${
                          alert.type === AlertSeverity.CRITICAL ? 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400' : 
                          alert.type === AlertSeverity.MAJOR_WARNING ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/30 text-orange-700 dark:text-orange-400' :
                          'bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30 text-blue-700 dark:text-blue-400'
                        }`}>
                           <div className="flex items-center gap-3 mb-2">
                              <i className={`fas ${alert.type === AlertSeverity.CRITICAL ? 'fa-skull-crossbones' : alert.type === AlertSeverity.MAJOR_WARNING ? 'fa-biohazard' : 'fa-info-circle'}`}></i>
                              <p className="font-black text-sm uppercase tracking-tight">{alert.title}</p>
                           </div>
                           <p className="text-xs font-bold opacity-80 leading-relaxed pl-6">{alert.description}</p>
                        </div>
                      ))}
                      {finalResult.alerts.length === 0 && <p className="text-center text-slate-400 font-bold py-10">No clinical warnings found. Matching scores indicate safe consumption.</p>}
                  </div>
                </Card>
                <Button onClick={() => navigate('/')} className="w-full h-20 rounded-[2rem] bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xl shadow-2xl">
                   <i className="fas fa-check-double mr-3"></i> Finish & Save Record
                </Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default MedicineVerificationFlow;
