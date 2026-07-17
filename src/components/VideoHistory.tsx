import { Copy, Download, Play, Video, Loader2, AlertCircle } from "lucide-react";

interface VideoRecord {
  id: string;
  prompt: string;
  duration: string;
  quality: string;
  videoUrl: string | null;
  service: string;
  status: 'generating' | 'completed' | 'failed';
  createdAt: number;
}

export function VideoHistory({ history }: { history: VideoRecord[] }) {
  if (history.length === 0) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="mt-16 w-full max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <Video className="w-5 h-5 text-indigo-400" />
        أحدث الفيديوهات
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {history.map((record) => (
          <div key={record.id} className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden backdrop-blur-sm transition-all hover:border-slate-600/50 hover:bg-slate-800/60 flex flex-col">
            <div className="aspect-video bg-slate-900 relative group shrink-0">
              {record.status === 'completed' && record.videoUrl ? (
                <video 
                  src={record.videoUrl} 
                  controls 
                  className="w-full h-full object-cover"
                  poster={`https://source.unsplash.com/random/800x450/?abstract,ai&sig=${record.id}`}
                />
              ) : record.status === 'generating' ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-800/50">
                  <Loader2 className="w-10 h-10 animate-spin mb-3 text-indigo-500" />
                  <span className="text-sm font-medium animate-pulse">جاري إنشاء الفيديو...</span>
                  <span className="text-xs text-slate-500 mt-1">يتم المعالجة بواسطة {record.service}</span>
                </div>
              ) : record.status === 'failed' ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-red-400 bg-red-950/20">
                  <AlertCircle className="w-10 h-10 mb-3 text-red-500" />
                  <span className="text-sm font-medium">فشل إنشاء الفيديو</span>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Play className="w-12 h-12 text-slate-700" />
                </div>
              )}
              
              <div className="absolute top-3 left-3 flex gap-2">
                <span className="bg-black/60 backdrop-blur-md text-white text-xs px-2.5 py-1 rounded-md font-medium uppercase">
                  {record.service}
                </span>
                <span className="bg-black/60 backdrop-blur-md text-white text-xs px-2.5 py-1 rounded-md font-medium">
                  {record.quality}
                </span>
              </div>
            </div>
            
            <div className="p-5 flex-1 flex flex-col">
              <p className="text-slate-300 text-sm leading-relaxed line-clamp-3 mb-4" dir="auto">
                {record.prompt}
              </p>
              
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-700/50">
                <span className="text-xs text-slate-500">
                  {new Date(record.createdAt).toLocaleDateString('ar-EG')}
                </span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleCopy(record.prompt)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                    title="نسخ الوصف"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  {record.status === 'completed' && record.videoUrl && (
                    <a 
                      href={record.videoUrl}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors"
                      title="تحميل الفيديو"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
