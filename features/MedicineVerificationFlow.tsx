
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
  
  const [extractedPrescription, setExtractedPrescription] = useState<PrescriptionData | null>(null);
  const [capturedTablets, setCapturedTablets] = useState<TabletData[]>([]);
  const [finalResult, setFinalResult] = useState<VerificationResult | null>(null);

  const [showCamera, setShowCamera] = useState(false);
  const [tfModel, setTfModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [focusScore, setFocusScore] = useState(0);
  const [distanceScore, setDistanceScore] = useState(0);
  const [brightnessLevel, setBrightnessLevel] = useState(0);

  const navigate = useNavigate();
  const prescriptionCameraRef = useRef<HTMLInputElement>(null);
  const tabletGalleryRef = useRef<HTMLInputElement>(null);
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

  /**
   * Enhances the image for better OCR (sharpening and contrast adjustment)
   */
  const enhanceImage = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(base64);

        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw image
        ctx.drawImage(img, 0, 0);

        // Apply basic contrast and brightness
        // Values can be tuned for OCR optimization
        ctx.filter = 'contrast(1.4) brightness(1.1) saturate(1.1)';
        ctx.drawImage(img, 0, 0);

        // Resolve enhanced base64
        resolve(canvas.toDataURL('image/jpeg', 0.9));
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
          
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          let colorSum = 0;
          for(let x = 0; x < data.length; x+=16) {
            colorSum += Math.floor((data[x]+data[x+1]+data[x+2])/3);
          }
          const samples = (video.videoWidth * video.videoHeight) / 4;
          const brightness = Math.floor(colorSum / samples);
          setBrightnessLevel(brightness);

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const tabletCandidate = predictions.find(p => p.score > 0.40);

          if (tabletCandidate) {
            const [x, y, width, height] = tabletCandidate.bbox;
            const confidence = tabletCandidate.score;
            const idealSize = Math.min(canvas.width, canvas.height) * 0.4;
            const currentSize = Math.max(width, height);
            const distRatio = Math.min(currentSize / idealSize, idealSize / currentSize);
            setDistanceScore(distRatio);
            setFocusScore(confidence);

            let qualityColor = confidence > 0.8 && distRatio > 0.7 ? '#22c55e' : '#eab308';
            ctx.strokeStyle = qualityColor;
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, width, height);
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

  const processTabletImage = async (base64: string) => {
    setLoading(true);
    setLoadingMsg("Optimizing Imprint Area & Identifying...");
    try {
      const enhanced = await enhanceImage(base64);
      const data = await identifyTablet(enhanced, language);
      setCapturedTablets(prev => [...prev, data]);
      setStep(3);
    } catch (err) {
      alert("Identification failed.");
    } finally {
      setLoading(false);
    }
  };

  const captureTablet = async () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.95); // High quality for imprint OCR
      stopCamera();
      await processTabletImage(base64);
    }
  };

  const handleTabletGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    setLoadingMsg(`Processing ${files.length} images...`);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        
        setLoadingMsg(`Optimizing & Identifying Tablet ${i + 1} of ${files.length}...`);
        const enhanced = await enhanceImage(base64);
        const data = await identifyTablet(enhanced, language);
        setCapturedTablets(prev => [...prev, data]);
      }
      setStep(3);
    } catch (err) {
      alert("Batch processing failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleCapturePrescription = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setLoading(true);
      setLoadingMsg("Optimizing Prescription OCR Accuracy...");
      try {
        const enhanced = await enhanceImage(base64);
        const data = await analyzePrescription(enhanced, language);
        setExtractedPrescription(data);
        setStep(2);
      } catch (err) {
        alert('OCR Analysis failed.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const performSafetyCheck = async () => {
    if (!extractedPrescription || capturedTablets.length === 0) return;
    setLoading(true);
    setLoadingMsg("Deep Clinical Verification (Thinking Mode)...");
    try {
      const result = await verifyMedicineSafety(user, extractedPrescription, capturedTablets, language);
      setFinalResult(result);
      setStep(4);
    } catch (err) {
      alert('Safety analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-10 animate-in fade-in">
        <div className="relative">
          <div className="w-24 h-24 border-4 border-blue-100 rounded-full"></div>
          <div className="absolute top-0 w-24 h-24 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center text-blue-600">
             <i className="fas fa-brain text-2xl"></i>
          </div>
        </div>
        <div className="text-center space-y-2">
           <h2 className="text-3xl font-black text-slate-800 tracking-tight">{loadingMsg}</h2>
           <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Gemini Intelligence</p>
        </div>
      </div>
    );
  }

  if (showCamera) {
    const isQualityGood = focusScore > 0.7 && distanceScore > 0.6;
    return (
      <div className="fixed inset-0 bg-black z-[100] flex flex-col font-sans">
        <div className="relative flex-grow">
          <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover opacity-90" />
          <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className={`w-72 h-72 border-4 rounded-[3rem] transition-all duration-300 ${isQualityGood ? 'border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'border-white/20'}`}></div>
            {!isQualityGood && <p className="mt-8 text-white/50 text-xs font-black uppercase tracking-widest text-center px-6">Ensure imprint is visible & center in frame</p>}
          </div>
        </div>
        <div className="bg-slate-900 p-10 flex justify-between items-center px-12">
           <Button variant="ghost" className="text-white w-14 h-14 rounded-full bg-white/5" onClick={stopCamera}>
             <i className="fas fa-times text-xl"></i>
           </Button>
           <button 
             onClick={captureTablet} 
             className={`w-24 h-24 rounded-full border-4 flex items-center justify-center transition-transform active:scale-95 ${isQualityGood ? 'bg-white border-green-500 scale-110 shadow-2xl' : 'bg-white/10 border-white/20'}`}
           >
             <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white">
                <i className="fas fa-camera text-2xl"></i>
             </div>
           </button>
           <button 
             onClick={() => { stopCamera(); tabletGalleryRef.current?.click(); }}
             className="text-white w-14 h-14 rounded-full bg-white/5 flex items-center justify-center"
           >
              <i className="fas fa-image text-xl"></i>
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-24 px-4 font-sans">
      <input 
        type="file" 
        multiple 
        accept="image/*" 
        className="hidden" 
        ref={tabletGalleryRef} 
        onChange={handleTabletGalleryUpload} 
      />

      {step === 1 && (
        <div className="text-center py-20 space-y-12 animate-in fade-in duration-700">
           <div className="relative inline-block">
              <div className="bg-blue-600/5 w-40 h-40 rounded-[3rem] flex items-center justify-center mx-auto text-blue-600 text-6xl border border-blue-100 shadow-inner">
                 <i className="fas fa-file-prescription"></i>
              </div>
              <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border-4 border-slate-50">
                 <i className="fas fa-plus"></i>
              </div>
           </div>
           <div className="space-y-4">
              <h1 className="text-5xl font-black text-slate-900 tracking-tight">Step 1: Prescription Scan</h1>
              <p className="text-slate-500 text-xl font-medium max-w-lg mx-auto">Place your doctor's prescription in clear view. Our AI uses high-precision OCR to extract details.</p>
           </div>
           <div className="flex flex-col items-center gap-6 max-w-sm mx-auto w-full">
              <input type="file" accept="image/*" capture="environment" className="hidden" ref={prescriptionCameraRef} onChange={handleCapturePrescription} />
              <Button onClick={() => prescriptionCameraRef.current?.click()} className="h-20 w-full text-xl rounded-3xl shadow-2xl shadow-blue-500/20">
                <i className="fas fa-camera-retro mr-3"></i>{t.capture_prescription}
              </Button>
              <Button variant="ghost" onClick={() => navigate('/')} className="font-black uppercase tracking-widest text-[10px] text-slate-400">{t.cancel}</Button>
           </div>
        </div>
      )}

      {step === 2 && extractedPrescription && (
        <div className="space-y-10 animate-in slide-in-from-bottom-8">
          <div className="flex justify-between items-end">
             <div>
                <p className="text-blue-600 font-black uppercase tracking-[0.3em] text-[10px] mb-2">Prescription Confirmed</p>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">Extracted Medication List</h2>
             </div>
             <Badge color="green" className="py-2 px-6 rounded-xl">Step 2 of 3</Badge>
          </div>

          <Card className="rounded-[3rem] shadow-2xl border-none">
             <div className="p-6 space-y-10">
                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8 shadow-inner">
                   <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                         <i className="fas fa-user-md text-2xl"></i>
                      </div>
                      <div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Doctor Name</p>
                         <p className="font-black text-slate-800 text-xl">Dr. {extractedPrescription.doctorName}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                         <i className="fas fa-calendar-day text-2xl"></i>
                      </div>
                      <div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Issue Date</p>
                         <p className="font-black text-slate-800 text-xl">{extractedPrescription.date || 'Today'}</p>
                      </div>
                   </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                     <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Required Items</h3>
                     <Badge color="blue">{extractedPrescription.medicines.length} Medicines</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {extractedPrescription.medicines.map((m, i) => (
                      <div key={i} className="p-6 bg-white border-2 border-slate-50 hover:border-blue-100 rounded-3xl flex items-center gap-5 transition-all group">
                         <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <i className="fas fa-pills text-2xl"></i>
                         </div>
                         <div>
                            <p className="font-black text-slate-800 text-lg leading-tight">{m.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-tighter">{m.dosage} • {m.frequency}</p>
                         </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-10 border-t border-slate-100 space-y-8">
                   <div className="text-center space-y-3">
                      <h3 className="text-3xl font-black text-slate-900 tracking-tight">Step 2: Scan Tablets Now</h3>
                      <p className="text-slate-500 font-medium max-w-lg mx-auto">Verify your medications by scanning the physical tablets. Our AI uses imprint area sharpening for maximum accuracy.</p>
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                      <Button onClick={startCamera} className="h-20 rounded-[1.5rem] text-xl bg-indigo-600 hover:bg-indigo-700 shadow-2xl shadow-indigo-500/20">
                        <i className="fas fa-camera-retro mr-3"></i>Scan Tablets
                      </Button>
                      <Button variant="secondary" onClick={() => tabletGalleryRef.current?.click()} className="h-20 rounded-[1.5rem] text-xl border-2">
                        <i className="fas fa-images mr-3"></i>Upload Gallery
                      </Button>
                   </div>
                </div>
             </div>
          </Card>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-12 animate-in zoom-in-95 duration-500">
           <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 bg-blue-50 px-6 py-2 rounded-full border border-blue-100 text-[10px] font-black uppercase text-blue-600 tracking-[0.2em] mb-4">
                <i className="fas fa-check-circle"></i> Samples Captured
              </div>
              <h2 className="text-5xl font-black text-slate-900 tracking-tight">Confirm Samples</h2>
              <p className="text-slate-500 text-lg font-medium">Review identified tablet samples before final cross-verification.</p>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {capturedTablets.map((t, idx) => (
                <div key={idx} className="group relative">
                  <Card className="overflow-hidden rounded-[2.5rem] border-none shadow-xl group-hover:shadow-2xl transition-all duration-300 transform group-hover:-translate-y-2">
                     <div className="relative aspect-square">
                        <img src={t.imageUrl} className="w-full h-full object-cover" alt="Tablet sample" />
                        <div className="absolute top-4 right-4">
                           <button 
                             onClick={() => setCapturedTablets(prev => prev.filter((_, i) => i !== idx))}
                             className="bg-red-600 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg active:scale-90"
                           >
                             <i className="fas fa-trash-alt"></i>
                           </button>
                        </div>
                     </div>
                     <div className="p-6 space-y-4">
                        <div className="flex justify-between items-start">
                           <h4 className="font-black text-slate-800 text-lg leading-tight truncate pr-2">{t.name}</h4>
                           <Badge color="blue">#{idx + 1}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                           <Badge color="yellow" className="text-[10px]">{t.color}</Badge>
                           <Badge color="blue" className="text-[10px]">{t.shape}</Badge>
                        </div>
                     </div>
                  </Card>
                </div>
              ))}
              
              <button 
                onClick={startCamera}
                className="h-full min-h-[220px] border-4 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 transition-all group"
              >
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                  <i className="fas fa-plus text-2xl"></i>
                </div>
                <span className="font-black uppercase tracking-widest text-[10px]">Add via Camera</span>
              </button>
           </div>

           <div className="flex flex-col sm:flex-row gap-6 pt-10 max-w-2xl mx-auto">
              <Button variant="ghost" className="flex-1 h-18 text-slate-400 font-black uppercase tracking-widest text-xs" onClick={() => setStep(2)}>
                <i className="fas fa-arrow-left mr-2"></i>Edit List
              </Button>
              <Button className="flex-[2] h-20 text-xl rounded-3xl shadow-2xl shadow-blue-500/30 bg-blue-600" onClick={performSafetyCheck}>
                 <i className="fas fa-shield-check mr-3"></i>Cross-Match All Samples
              </Button>
           </div>
        </div>
      )}

      {step === 4 && finalResult && (
        <div className="space-y-12 animate-in fade-in duration-1000 pb-20 max-w-5xl mx-auto">
           {/* Top Summary Header */}
           <div className={`p-16 rounded-[4rem] text-center shadow-2xl text-white relative overflow-hidden ${finalResult.matchStats.unmatchedCount > 0 ? 'bg-red-600' : 'bg-green-600'}`}>
              <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12 pointer-events-none">
                 <i className={`fas ${finalResult.matchStats.unmatchedCount > 0 ? 'fa-triangle-exclamation' : 'fa-shield-check'} text-[240px]`}></i>
              </div>
              <div className="relative z-10 space-y-8">
                 <div className="inline-block p-6 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/20 shadow-inner mb-4">
                    <i className={`fas ${finalResult.matchStats.unmatchedCount > 0 ? 'fa-hand-stop' : 'fa-check-double'} text-5xl`}></i>
                 </div>
                 <div className="space-y-2">
                    <h2 className="text-6xl font-black tracking-tighter leading-none">{finalResult.matchStats.unmatchedCount > 0 ? 'Safety Alert' : 'Verification Success'}</h2>
                    <p className="text-white/80 font-black uppercase tracking-[0.4em] text-xs">Clinical Verification Complete</p>
                 </div>
                 <div className="inline-flex gap-12 bg-black/15 backdrop-blur-xl px-12 py-5 rounded-[2rem] border border-white/10 shadow-2xl">
                    <div className="text-center">
                       <p className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-1">Prescribed</p>
                       <p className="text-3xl font-black">{finalResult.matchStats.totalPrescribed}</p>
                    </div>
                    <div className="text-center">
                       <p className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-1">Matched</p>
                       <p className="text-3xl font-black">{finalResult.matchStats.matchedCount}</p>
                    </div>
                    <div className="text-center">
                       <p className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-1">Mismatched</p>
                       <p className={`text-3xl font-black ${finalResult.matchStats.unmatchedCount > 0 ? 'text-red-200 animate-pulse' : ''}`}>{finalResult.matchStats.unmatchedCount}</p>
                    </div>
                 </div>
              </div>
           </div>

           {/* Results List - Separated Matched vs Unmatched */}
           <div className="space-y-10">
              <div className="flex items-center gap-4">
                 <div className="h-px bg-slate-200 flex-grow"></div>
                 <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.5em]">Detailed Tablet Analysis</h3>
                 <div className="h-px bg-slate-200 flex-grow"></div>
              </div>

              {/* Unmatched Items First (Critical Priority) */}
              {finalResult.matchStats.unmatchedCount > 0 && (
                <div className="space-y-6">
                   <div className="flex items-center gap-3 px-4">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                         <i className="fas fa-triangle-exclamation text-sm"></i>
                      </div>
                      <h4 className="text-xl font-black text-red-600 uppercase tracking-tight">Foreign Substance Detected (Mismatched)</h4>
                   </div>
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {finalResult.identifiedTablets.filter(t => !t.isMatch).map((tablet, i) => (
                        <Card key={i} className="rounded-[3rem] border-2 border-red-200 shadow-xl bg-red-50/20 hover:shadow-2xl transition-all group overflow-visible">
                           <div className="p-6 space-y-6">
                              <div className="flex gap-6 items-start">
                                 <div className="relative shrink-0">
                                    <img src={tablet.imageUrl} className="w-24 h-24 rounded-[1.5rem] object-cover border-4 border-white shadow-xl grayscale-[0.5]" alt="Mismatch" />
                                    <div className="absolute -bottom-2 -right-2 bg-red-600 text-white w-8 h-8 rounded-xl flex items-center justify-center shadow-lg">
                                       <i className="fas fa-times text-xs"></i>
                                    </div>
                                 </div>
                                 <div className="space-y-1">
                                    <h4 className="text-2xl font-black text-red-900 leading-tight">{tablet.name}</h4>
                                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Mismatch Warning</p>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                       <Badge color="red" className="text-[9px]">{tablet.color}</Badge>
                                       <Badge color="red" className="text-[9px]">{tablet.shape}</Badge>
                                    </div>
                                 </div>
                              </div>
                              <div className="bg-red-600/5 p-6 rounded-[2rem] space-y-4 border border-red-100 shadow-inner">
                                 <div>
                                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Deep Clinical Description</p>
                                    <p className="text-sm font-medium text-red-900/70 leading-relaxed whitespace-pre-wrap">{tablet.description}</p>
                                 </div>
                                 <div className="pt-4 border-t border-red-200/50">
                                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Medical Indication</p>
                                    <p className="text-sm font-bold text-red-900 leading-relaxed whitespace-pre-wrap">{tablet.uses}</p>
                                 </div>
                              </div>
                              <div className="p-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase text-center tracking-[0.3em] shadow-lg">
                                 Hazard: DO NOT CONSUME - NOT PRESCRIBED
                              </div>
                           </div>
                        </Card>
                      ))}
                   </div>
                </div>
              )}

              {/* Matched Items */}
              {finalResult.matchStats.matchedCount > 0 && (
                <div className="space-y-6">
                   <div className="flex items-center gap-3 px-4">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                         <i className="fas fa-check-circle text-sm"></i>
                      </div>
                      <h4 className="text-xl font-black text-green-600 uppercase tracking-tight">Verified Matches</h4>
                   </div>
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {finalResult.identifiedTablets.filter(t => t.isMatch).map((tablet, i) => (
                        <Card key={i} className="rounded-[3rem] border-none shadow-xl bg-white hover:shadow-2xl transition-all group overflow-visible">
                           <div className="p-6 space-y-6">
                              <div className="flex gap-6 items-start">
                                 <div className="relative shrink-0">
                                    <img src={tablet.imageUrl} className="w-24 h-24 rounded-[1.5rem] object-cover border-4 border-white shadow-xl" alt="Match" />
                                    <div className="absolute -bottom-2 -right-2 bg-green-500 text-white w-8 h-8 rounded-xl flex items-center justify-center shadow-lg">
                                       <i className="fas fa-check text-xs"></i>
                                    </div>
                                 </div>
                                 <div className="space-y-1">
                                    <h4 className="text-2xl font-black text-slate-900 leading-tight">{tablet.name}</h4>
                                    <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Matched Medication</p>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                       <Badge color="blue" className="text-[9px] bg-blue-50/50">{tablet.color}</Badge>
                                       <Badge color="blue" className="text-[9px] bg-blue-50/50">{tablet.shape}</Badge>
                                    </div>
                                 </div>
                              </div>
                              <div className="bg-slate-50 p-6 rounded-[2rem] space-y-4 border border-slate-100 shadow-inner">
                                 <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pharmacology & Mechanism</p>
                                    <p className="text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">{tablet.description}</p>
                                 </div>
                                 <div className="pt-4 border-t border-slate-200/50">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Therapeutic Benefits</p>
                                    <p className="text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">{tablet.uses}</p>
                                 </div>
                              </div>
                           </div>
                        </Card>
                      ))}
                   </div>
                </div>
              )}
           </div>

           {/* Safety Alerts Card */}
           <Card title="Clinical Safety Intelligence" className="rounded-[3rem] shadow-xl border-none">
              <div className="space-y-4">
                 {finalResult.alerts.map((alert, i) => (
                   <div key={i} className={`flex gap-8 p-8 rounded-[2.5rem] border transition-all ${alert.type === 'CRITICAL' ? 'bg-red-50 border-red-100 shadow-inner' : 'bg-slate-50 border-slate-100 shadow-sm'}`}>
                      <div className={`shrink-0 w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-2xl shadow-xl ${alert.type === 'CRITICAL' ? 'bg-red-600 text-white shadow-red-500/30' : 'bg-blue-600 text-white shadow-blue-500/30'}`}>
                         <i className={`fas ${alert.type === 'CRITICAL' ? 'fa-biohazard' : 'fa-info-circle'}`}></i>
                      </div>
                      <div className="space-y-2">
                         <h4 className={`text-2xl font-black tracking-tight ${alert.type === 'CRITICAL' ? 'text-red-900' : 'text-slate-900'}`}>{alert.title}</h4>
                         <p className={`text-base font-medium leading-relaxed ${alert.type === 'CRITICAL' ? 'text-red-800/70' : 'text-slate-500'}`}>{alert.description}</p>
                      </div>
                   </div>
                 ))}
                 {finalResult.alerts.length === 0 && (
                    <div className="text-center py-16 bg-green-50 rounded-[3rem] border-4 border-dashed border-green-100">
                       <i className="fas fa-shield-check text-7xl text-green-500 mb-6 drop-shadow-sm opacity-50"></i>
                       <p className="font-black text-slate-800 text-2xl tracking-tight">Zero Clinical Safety Threats Detected</p>
                       <p className="text-xs text-slate-400 font-black uppercase tracking-[0.2em] mt-1">Verified via Gemini Neural Cross-Match</p>
                    </div>
                 )}
              </div>
           </Card>

           <div className="flex flex-col sm:flex-row gap-6 pt-10">
              <Button variant="ghost" className="flex-1 h-20 rounded-[2.5rem] font-black uppercase text-xs tracking-[0.3em] text-slate-400 hover:text-red-500" onClick={() => navigate('/')}>
                 <i className="fas fa-chevron-left mr-3"></i>Dashboard
              </Button>
              <Button className="flex-[2] h-20 rounded-[2.5rem] bg-slate-900 hover:bg-black shadow-2xl text-white font-black uppercase tracking-[0.3em] text-xs py-10" onClick={() => { onComplete(finalResult); navigate('/'); }}>
                 <i className="fas fa-check-double mr-3"></i>Confirm & Secure Record
              </Button>
           </div>
        </div>
      )}
    </div>
  );
};

export default MedicineVerificationFlow;
