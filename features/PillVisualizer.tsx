
import React, { useState } from 'react';
import { Card, Button } from '../components/UI';
import { generatePillVisual } from '../services/geminiService';

const PillVisualizer: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ratios = ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"];
  const sizes = ["1K", "2K", "4K"];

  const handleGenerate = async () => {
    if (!prompt) return;
    
    setLoading(true);
    try {
      const result = await generatePillVisual(prompt, aspectRatio, imageSize);
      setImage(result);
    } catch (err) {
      alert("Generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">Pill Visualizer</h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium">Generate a detailed visual of what your medicine should look like.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card title="Generator Settings" className="dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Pill Description</label>
              <textarea 
                className="w-full h-32 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none font-medium text-slate-700 dark:text-white transition-colors"
                placeholder="Round, white tablet with '500' imprint on one side..."
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Image Quality</label>
              <div className="flex gap-2">
                {sizes.map(s => (
                  <button 
                    key={s}
                    onClick={() => setImageSize(s)}
                    className={`flex-1 py-2 rounded-xl text-xs font-black border transition-all ${
                      imageSize === s ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-800'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Aspect Ratio</label>
              <div className="grid grid-cols-4 gap-2">
                {ratios.map(r => (
                  <button 
                    key={r}
                    onClick={() => setAspectRatio(r)}
                    className={`px-2 py-2 rounded-xl text-[10px] font-black border transition-all ${
                      aspectRatio === r ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-800'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <Button className="w-full h-14" disabled={!prompt || loading} onClick={handleGenerate}>
              {loading ? <i className="fas fa-spinner animate-spin"></i> : <i className="fas fa-magic"></i>}
              {loading ? "Generating High-Res Visual..." : "Visualize Medicine"}
            </Button>
          </div>
        </Card>

        <Card title="Visual Output" className="dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <div className="flex flex-col items-center justify-center min-h-[400px] bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800">
            {image ? (
              <img src={image} className="max-w-full h-auto rounded-3xl shadow-2xl animate-in zoom-in-95" alt="Generated Pill" />
            ) : (
              <div className="text-center p-8 space-y-4 text-slate-300 dark:text-slate-700">
                <i className="fas fa-image text-8xl opacity-10"></i>
                <p className="font-black uppercase tracking-widest text-xs">Awaiting Generation</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PillVisualizer;
