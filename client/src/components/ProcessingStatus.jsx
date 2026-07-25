import { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';

const STAGES = [
  { key: 'parsing', label: 'Parsing document', desc: 'Extracting text from source' },
  { key: 'chunking', label: 'Chunking text', desc: 'Splitting into semantic segments' },
  { key: 'embedding', label: 'Generating embeddings', desc: 'Creating vector representations' },
  { key: 'indexing', label: 'Indexing', desc: 'Storing in knowledge base' },
];

const inferStage = (status, meta) => {
  if (status === 'failed') return -2;
  if (status === 'ready') return 4;
  if (status === 'pending') return -1;
  if (status === 'processing') {
    if (meta?.chunkCount > 0 && meta?.embeddingCount === meta?.chunkCount) return 3;
    if (meta?.chunkCount > 0) return 2;
    if (meta?.pageCount > 0 || meta?.segmentCount > 0 || meta?.charCount > 0) return 1;
    return 0;
  }
  return 0;
};

export default function ProcessingStatus({ sourceId, notebookId, initialSource, onComplete, onError }) {
  const [status, setStatus] = useState(initialSource?.status || 'pending');
  const [meta, setMeta] = useState(initialSource?.meta || {});
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const [stage, setStage] = useState(inferStage(initialSource?.status, initialSource?.meta));
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);
  const pollRef = useRef(null);
  const startRef = useRef(Date.now());

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);

    const poll = async () => {
      try {
        const data = await api.sources.status(notebookId, sourceId);
        setStatus(data.status);
        setMeta(data.meta || {});
        const newStage = inferStage(data.status, data.meta);
        setStage(newStage);

        if (data.status === 'ready') {
          clearInterval(intervalRef.current);
          clearInterval(pollRef.current);
          onComplete?.(data);
        } else if (data.status === 'failed') {
          clearInterval(intervalRef.current);
          clearInterval(pollRef.current);
          setError(data.processingError || 'Processing failed');
          onError?.(data.processingError);
        }
      } catch (e) {
        // keep polling
      }
    };

    poll();
    pollRef.current = setInterval(poll, 2500);

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(pollRef.current);
    };
  }, [sourceId, notebookId]);

  const currentStage = Math.max(0, Math.min(stage, 3));
  const isFailed = status === 'failed';
  const isDone = status === 'ready';

  return (
    <div className={`rounded-2xl overflow-hidden mb-4 border transition-all duration-300 bg-[#16191f]/60 ${isFailed ? 'border-red-500/20' : isDone ? 'border-emerald-500/20' : 'border-[#7c6af7]/20 shadow-lg shadow-[#7c6af7]/2'}`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 bg-transparent outline-none cursor-pointer"
      >
        <div className="flex items-center gap-3">
          {isFailed ? (
            <XCircle size={16} className="text-red-500" />
          ) : isDone ? (
            <CheckCircle size={16} className="text-emerald-500" />
          ) : (
            <Loader2 size={16} className="animate-spin text-[#7c6af7]" />
          )}
          <span className={`text-xs font-bold tracking-wide ${isFailed ? 'text-red-400' : isDone ? 'text-emerald-400' : 'text-zinc-200'}`}>
            {isFailed ? 'Processing failed' : isDone ? 'Ready to query' : `Processing document… (${elapsed}s)`}
          </span>
        </div>
        <div className="flex items-center gap-3.5">
          {!isDone && !isFailed && (
            <span className="text-xs text-zinc-500 font-medium">
              {STAGES[currentStage]?.label}
            </span>
          )}
          {expanded ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-1 space-y-4">
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-950/20 border border-red-500/20">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-red-500" />
              <p className="text-xs leading-relaxed font-semibold text-red-400 font-mono">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            {STAGES.map((s, idx) => {
              let state = 'waiting';
              if (isFailed && idx === currentStage) state = 'failed';
              else if (isDone || idx < stage) state = 'done';
              else if (idx === currentStage && !isFailed && !isDone) state = 'active';

              return (
                <div key={s.key} className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
                    state === 'done' ? 'bg-emerald-500/10 border-emerald-500/30' : 
                    state === 'active' ? 'bg-[#7c6af7]/10 border-[#7c6af7]/30' : 
                    state === 'failed' ? 'bg-red-500/10 border-red-500/30' : 
                    'bg-zinc-900 border-white/[0.04]'
                  }`}>
                    {state === 'done' && <CheckCircle size={12} className="text-emerald-500" />}
                    {state === 'active' && <Loader2 size={12} className="animate-spin text-[#7c6af7]" />}
                    {state === 'failed' && <XCircle size={12} className="text-red-500" />}
                    {state === 'waiting' && <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${state === 'waiting' ? 'text-zinc-600' : state === 'done' ? 'text-zinc-400' : state === 'failed' ? 'text-red-400' : 'text-zinc-200'}`}>
                      {s.label}
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{s.desc}</p>
                  </div>
                  {state === 'active' && (
                    <div className="flex gap-0.5 mt-1.5">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1 h-3 rounded-full animate-pulse bg-[#7c6af7]" style={{ opacity: 0.4 + i * 0.3, animationDelay: `${i * 150}ms` }} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!isFailed && !isDone && meta && Object.keys(meta).length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.02]">
              {meta.pageCount && <span className="text-[10px] font-bold px-2.5 py-1 bg-zinc-900 border border-white/[0.02] rounded-full text-zinc-500">{meta.pageCount} pages</span>}
              {meta.charCount && <span className="text-[10px] font-bold px-2.5 py-1 bg-zinc-900 border border-white/[0.02] rounded-full text-zinc-500">{(meta.charCount / 1000).toFixed(1)}k characters</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
