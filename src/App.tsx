import { useState, useEffect } from "react";
import { Sparkles, Wand2, Clock, MonitorPlay, Loader2 } from "lucide-react";
import { VideoHistory } from "./components/VideoHistory";
import { cn } from "./lib/utils";

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("5s");
  const [quality, setQuality] = useState("1080p");
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState("");

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/videos/history");
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchHistory();
    // Poll history every 5 seconds to update generation status
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError("");
    
    try {
      const res = await fetch("/api/videos/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, duration, quality })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setPrompt("");
        fetchHistory(); // Refresh history with new video
      } else {
        setError(data.error || "حدث خطأ أثناء الإنشاء.");
      }
    } catch (err) {
      setError("فشل الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white selection:bg-indigo-500/30" dir="rtl">
      {/* Navbar */}
      <nav className="border-b border-slate-800/60 bg-[#0B0F19]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">فيجن <span className="text-indigo-400">ستوديو</span></span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20 flex flex-col items-center">
        
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
            حوّل كلماتك إلى <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">فيديو سينمائي</span>
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed">
            استخدم قوة الذكاء الاصطناعي (Kling, Hailuo, Pika) لإنشاء مشاهد واقعية واحترافية بمجرد كتابة وصف بسيط.
          </p>
        </div>

        {/* Generator Card */}
        <div className="w-full max-w-4xl bg-slate-800/30 border border-slate-700/50 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-2xl relative">
          
          <div className="relative mb-6">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="صف المشهد الذي تريد إنشاءه بالتفصيل... (مثال: سيارة رياضية حمراء تسير بسرعة على طريق ساحلي وقت الغروب، تصوير سينمائي 4k...)"
              className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl px-6 py-5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none h-40 custom-scrollbar text-lg"
              dir="auto"
            />
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="flex-1 bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3">
              <Clock className="w-5 h-5 text-slate-400" />
              <select 
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="bg-transparent border-none text-white focus:ring-0 flex-1 outline-none appearance-none cursor-pointer"
              >
                <option value="5s" className="bg-slate-800">5 ثواني</option>
                <option value="10s" className="bg-slate-800">10 ثواني</option>
                <option value="15s" className="bg-slate-800">15 ثانية (Pika/Hailuo)</option>
              </select>
            </div>
            
            <div className="flex-1 bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3">
              <MonitorPlay className="w-5 h-5 text-slate-400" />
              <select 
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="bg-transparent border-none text-white focus:ring-0 flex-1 outline-none appearance-none cursor-pointer"
              >
                <option value="1080p" className="bg-slate-800">جودة 1080p</option>
                <option value="4k" className="bg-slate-800">جودة 4K (Kling)</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <div className="flex justify-center">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className={cn(
                "group relative overflow-hidden rounded-full px-8 py-4 font-bold text-lg flex items-center gap-3 transition-all",
                isGenerating || !prompt.trim() 
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)] hover:shadow-[0_0_60px_-15px_rgba(99,102,241,0.7)] hover:-translate-y-0.5"
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جاري إرسال الطلب...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                  إنشاء الفيديو
                </>
              )}
            </button>
          </div>
        </div>

        {/* Generated Videos History */}
        <VideoHistory history={history} />

      </main>
    </div>
  );
}

