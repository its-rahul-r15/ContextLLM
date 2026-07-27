import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Plus, Search, Bell, Settings, Share2, Download, Paperclip, Send,
  ChevronRight, Check, X, Loader2, BookOpen, FileText, PlayCircle,
  Globe, AlignLeft, Star, Trash2, Archive, ThumbsUp, ThumbsDown, Copy, RefreshCw,
  ZoomIn, ZoomOut, Printer, Bookmark, ArrowLeft, MoreHorizontal, Upload,
  Sparkles, Sliders, AudioLines, HelpCircle, Network, StickyNote,
  PenSquare, Grid, Eye
} from 'lucide-react';
import { api, streamChat } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import ProcessingStatus from '../components/ProcessingStatus';

const SOURCE_ICONS = {
  pdf: <FileText size={16} className="text-blue-400" />,
  youtube: <PlayCircle size={16} className="text-red-500" />,
  weblink: <Globe size={16} className="text-emerald-400" />,
  text: <AlignLeft size={16} className="text-purple-400" />,
  vtt: <FileText size={16} className="text-amber-500" />,
};

const TYPE_COLOR = {
  pdf: '#3b82f6',
  youtube: '#ef4444',
  weblink: '#10b981',
  text: '#a855f7',
  vtt: '#f59e0b',
};

const formatSize = (meta) => {
  if (!meta?.size) return null;
  const kb = meta.size / 1024;
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
};

const timeAgo = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
};

export default function NotebookPage() {
  const { id: notebookId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [notebook, setNotebook] = useState(null);
  const [sources, setSources] = useState([]);
  const [selectedSources, setSelectedSources] = useState(new Set());
  const [filterType, setFilterType] = useState('all');
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const [activeCitation, setActiveCitation] = useState(null);
  const [citationData, setCitationData] = useState(null);
  const [showAddSource, setShowAddSource] = useState(false);
  const [addMode, setAddMode] = useState('');
  const [addForm, setAddForm] = useState({ url: '', title: '', content: '' });
  const [uploading, setUploading] = useState(false);
  const [pollingIds, setPollingIds] = useState(new Set());
  const [searchSources, setSearchSources] = useState('');
  const [copied, setCopied] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // Notes state
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState([]);
  const [activeNote, setActiveNote] = useState(null);
  const saveTimeoutRef = useRef(null);

  const handleNoteChange = (updates) => {
    if (!activeNote) return;
    const updatedNote = { ...activeNote, ...updates };
    setActiveNote(updatedNote);
    setNotes(prev => prev.map(n => n._id === activeNote._id ? updatedNote : n));

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await api.notes.update(notebookId, activeNote._id, updates);
    }, 800);
  };

  const createNewNote = async () => {
    const note = await api.notes.create(notebookId, { title: "Untitled Note", content: "" });
    setNotes(prev => [note, ...prev]);
    setActiveNote(note);
    setShowNotes(true);
  };

  const deleteNote = async (noteId, e) => {
    if (e) e.stopPropagation();
    await api.notes.delete(notebookId, noteId);
    setNotes(prev => {
      const remaining = prev.filter(n => n._id !== noteId);
      if (activeNote?._id === noteId) {
        setActiveNote(remaining[0] || null);
      }
      return remaining;
    });
  };

  // Graph state
  const [showGraph, setShowGraph] = useState(false);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [graphLoading, setGraphLoading] = useState(false);

  const loadSourceGraph = async () => {
    setGraphLoading(true);
    setShowGraph(true);
    try {
      const data = await api.sources.getGraph(notebookId);
      setGraphData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setGraphLoading(false);
    }
  };

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const startResize = useCallback((mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
    const startX = mouseDownEvent.clientX;
    const startWidth = sidebarWidth;

    const doDrag = (mouseMoveEvent) => {
      const newWidth = startWidth + (mouseMoveEvent.clientX - startX);
      if (newWidth >= 200 && newWidth <= 450) {
        setSidebarWidth(newWidth);
      }
    };

    const stopDrag = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
    };

    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
  }, [sidebarWidth]);

  const startPolling = useCallback((sourceId) => {
    setPollingIds(prev => new Set(prev).add(sourceId));
    const iv = setInterval(async () => {
      const srcs = await api.sources.list(notebookId);
      setSources(srcs);
      const src = srcs.find(s => s._id === sourceId);
      if (src?.status === 'ready' || src?.status === 'failed') {
        if (src.status === 'ready') setSelectedSources(prev => new Set(prev).add(sourceId));
        setPollingIds(prev => { const n = new Set(prev); n.delete(sourceId); return n; });
        clearInterval(iv);
      }
    }, 3000);
  }, [notebookId]);

  useEffect(() => {
    Promise.all([
      api.notebooks.get(notebookId),
      api.sources.list(notebookId),
      api.chat.listConversations(notebookId),
      api.notes.list(notebookId),
    ]).then(([nb, srcs, convs, fetchedNotes]) => {
      setNotebook(nb);
      setSources(srcs);
      setSelectedSources(new Set(srcs.filter(s => s.status === 'ready').map(s => s._id)));
      setConversations(convs);
      setNotes(fetchedNotes || []);
      if (fetchedNotes && fetchedNotes.length > 0) {
        setActiveNote(fetchedNotes[0]);
      }
      if (convs.length > 0) {
        setActiveConvId(convs[0]._id);
        api.chat.getMessages(convs[0]._id).then(setMessages);
      }
      // Auto-resume status polling on load for any in-progress sources
      srcs.forEach(src => {
        if (src.status !== 'ready' && src.status !== 'failed') {
          startPolling(src._id);
        }
      });
    });
  }, [notebookId, startPolling]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamBuffer]);

  const ensureConv = async () => {
    if (activeConvId) return activeConvId;
    const conv = await api.chat.createConversation(notebookId, { title: input.slice(0, 40) || 'New chat' });
    setConversations(prev => [conv, ...prev]);
    setActiveConvId(conv._id);
    return conv._id;
  };

  const send = async () => {
    if (!input.trim() || streaming) return;
    const query = input.trim();
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    const cid = await ensureConv();
    setMessages(prev => [...prev, { _id: Date.now(), role: 'user', text: query, createdAt: new Date().toISOString() }]);
    setStreaming(true);
    setStreamBuffer('');
    let full = '';
    streamChat(cid, { query, sourceIds: [...selectedSources] },
      (token) => { full += token; setStreamBuffer(full); },
      ({ text, citations, messageId }) => {
        setMessages(prev => [...prev, { _id: messageId || Date.now() + 1, role: 'assistant', text, citations, createdAt: new Date().toISOString() }]);
        setStreamBuffer(''); setStreaming(false);
      },
      (err) => {
        setMessages(prev => [...prev, { _id: Date.now() + 2, role: 'assistant', text: `Something went wrong: ${err}`, citations: [], createdAt: new Date().toISOString() }]);
        setStreamBuffer(''); setStreaming(false);
      }
    );
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append('file', file);
    try {
      const src = await api.sources.uploadFile(notebookId, fd);
      setSources(prev => [src, ...prev]);
      startPolling(src._id);
      setShowAddSource(false); // Close the popup after successful upload
    } finally { setUploading(false); e.target.value = ''; }
  };

  const handleAddSource = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      let src;
      if (addMode === 'url') {
        const url = addForm.url.trim();
        const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");
        if (isYoutube) {
          src = await api.sources.addYoutube(notebookId, { url, title: addForm.title || undefined });
        } else {
          src = await api.sources.addWebLink(notebookId, { url, title: addForm.title || undefined });
        }
      } else if (addMode === 'text') {
        src = await api.sources.addText(notebookId, { title: addForm.title, content: addForm.content });
      }
      setSources(prev => [src, ...prev]);
      startPolling(src._id);
      setShowAddSource(false); setAddMode(''); setAddForm({ url: '', title: '', content: '' });
    } finally { setUploading(false); }
  };

  const handleQuickAddUrl = async () => {
    const url = addForm.url.trim();
    if (!url) return;
    setUploading(true);
    try {
      let src;
      const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");
      if (isYoutube) {
        src = await api.sources.addYoutube(notebookId, { url });
      } else {
        src = await api.sources.addWebLink(notebookId, { url });
      }
      setSources(prev => [src, ...prev]);
      startPolling(src._id);
      setShowAddSource(false);
      setAddForm({ url: '', title: '', content: '' });
    } finally {
      setUploading(false);
    }
  };

  const handleDropFile = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const src = await api.sources.uploadFile(notebookId, fd);
      setSources(prev => [src, ...prev]);
      startPolling(src._id);
      setShowAddSource(false);
    } finally {
      setUploading(false);
    }
  };

  const deleteSrc = async (sid, e) => {
    e.stopPropagation();
    await api.sources.delete(notebookId, sid);
    setSources(prev => prev.filter(s => s._id !== sid));
    setSelectedSources(prev => { const n = new Set(prev); n.delete(sid); return n; });
  };

  const toggleSrc = (id) => setSelectedSources(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const copyMsg = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCitation = (ref) => {
    setActiveCitation(ref);
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    const cite = lastAssistant?.citations?.find(c => c.ref === ref);
    setCitationData(cite || null);
    if (cite) {
      setShowNotes(false);
    }
  };

  const filteredSources = sources.filter(s => {
    const matchType = filterType === 'all' || s.type === filterType;
    const matchSearch = (s.title || '').toLowerCase().includes(searchSources.toLowerCase());
    return matchType && matchSearch;
  });

  const handleSelectAll = () => {
    const allReady = sources.filter(s => s.status === 'ready').map(s => s._id);
    if (selectedSources.size === allReady.length) {
      setSelectedSources(new Set());
    } else {
      setSelectedSources(new Set(allReady));
    }
  };

  if (!notebook) return (
    <div className="h-screen flex items-center justify-center bg-[#07080a]">
      <Loader2 size={24} className="animate-spin text-[#7c6af7]" />
    </div>
  );

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden bg-[#07080a] text-zinc-300 antialiased font-sans ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      <style>{`
        @media (max-width: 768px) {
          .rc-responsive-sidebar {
            position: absolute !important;
            left: 8px !important;
            top: 64px !important;
            bottom: 8px !important;
            z-index: 50 !important;
            width: 280px !important;
            max-width: calc(100vw - 16px) !important;
            box-shadow: 20px 0px 40px rgba(0, 0, 0, 0.6) !important;
          }
          .rc-responsive-right-sidebar {
            position: absolute !important;
            right: 8px !important;
            top: 64px !important;
            bottom: 8px !important;
            z-index: 50 !important;
            width: 320px !important;
            max-width: calc(100vw - 16px) !important;
            box-shadow: -20px 0px 40px rgba(0, 0, 0, 0.6) !important;
          }
        }
      `}</style>

      {/* Top Header */}
      <nav className="flex items-center justify-between px-4 sm:px-6 h-14 shrink-0 z-50 bg-[#0c0e12] border-b border-white/[0.04]">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Link to="/dashboard" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#7c6af7]">
              <BookOpen size={16} className="text-white" />
            </div>
          </Link>
          <span className="h-4 w-px bg-white/[0.08]" />
          <h1 className="text-xs sm:text-sm font-semibold text-white truncate max-w-[120px] xs:max-w-[200px] sm:max-w-lg">
            {notebook.title}
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 relative">
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 border border-white/[0.08] hover:bg-white/[0.04] hover:border-white/[0.12] transition rounded-full text-xs font-semibold text-zinc-300"
          >
            <ArrowLeft size={13} />
            <span className="hidden xs:inline">Back to Notebooks</span>
            <span className="inline xs:hidden">Back</span>
          </Link>
          <button 
            onClick={() => setShowProfile(!showProfile)} 
            className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#7c6af7] to-[#9b8df9] flex items-center justify-center text-xs font-bold text-white border border-white/10 hover:opacity-90 transition shrink-0"
          >
            {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
          </button>

          {showProfile && (
            <div className="absolute right-0 top-11 rounded-2xl overflow-hidden z-[90] w-52 shadow-2xl bg-[#101216] border border-white/[0.06] animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-4 py-3.5 border-b border-white/[0.04] bg-[#0c0e12]">
                <p className="text-xs font-semibold text-white">{user?.displayName || 'User profile'}</p>
                <p className="text-[10px] text-zinc-500 truncate mt-0.5">{user?.email}</p>
              </div>
              <button 
                onClick={() => { setShowProfile(false); logout().then(() => navigate('/login')); }} 
                className="w-full text-left px-4 py-3 text-xs text-red-400 hover:bg-white/[0.02] transition font-medium"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 p-2 gap-2 overflow-hidden bg-[#07080a] relative">
        {/* Backdrop for Left Sidebar on Mobile */}
        {!sidebarCollapsed && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" 
            onClick={() => setSidebarCollapsed(true)} 
          />
        )}

        {/* Backdrop for Right Sidebars on Mobile */}
        {(activeCitation !== null || showNotes) && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" 
            onClick={() => { setActiveCitation(null); setShowNotes(false); }} 
          />
        )}

        {/* Left Panel: Sources */}
        <aside
          style={{ width: sidebarCollapsed ? '0px' : `${sidebarWidth}px`, minWidth: sidebarCollapsed ? '0px' : '200px' }}
          className={`rc-responsive-sidebar shrink-0 flex flex-col overflow-hidden bg-[#101216] border border-white/[0.04] rounded-2xl ${isResizing ? '' : 'transition-all duration-300 ease-in-out'
            } ${sidebarCollapsed ? 'opacity-0 border-none pointer-events-none' : 'opacity-100'}`}
        >
          <div className="p-4 flex items-center justify-between border-b border-white/[0.04]">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Sources</span>
            <div className="flex items-center gap-1">
              <button
                onClick={loadSourceGraph}
                className="p-1.5 hover:bg-white/[0.04] rounded-lg transition text-zinc-400 hover:text-zinc-200"
                title="Connected Knowledge Graph"
              >
                <Network size={14} />
              </button>
              <button onClick={() => setSidebarCollapsed(true)} className="p-1 text-zinc-500 hover:text-zinc-300 transition">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3">
            <button onClick={() => { setShowAddSource(true); setAddMode(''); }} className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-800/80 hover:bg-zinc-800 rounded-full text-xs font-semibold text-white border border-white/[0.06] shadow-sm transition">
              <Plus size={14} strokeWidth={2.5} /> Add sources
            </button>

            {/* Custom search bar */}
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-[#181b21] border border-white/[0.04]">
              <Search size={14} className="text-zinc-500 shrink-0" />
              <input
                value={searchSources}
                onChange={e => setSearchSources(e.target.value)}
                className="bg-transparent text-xs outline-none flex-1 placeholder-zinc-500 text-zinc-200"
                placeholder="Search the web for new sources"
              />
            </div>
          </div>

          {/* List Headers */}
          <div className="px-4 py-1 flex items-center justify-between text-xs text-zinc-500 border-b border-white/[0.02]">
            <button className="flex items-center gap-1 hover:text-zinc-300 transition">
              <Sliders size={12} />
              <span>All Sources</span>
            </button>
            <button onClick={handleSelectAll} className="flex items-center gap-1.5 hover:text-zinc-300 transition font-medium">
              <span>Select all</span>
              <div className={`w-3.5 h-3.5 rounded flex items-center justify-center transition border ${selectedSources.size === sources.filter(s => s.status === 'ready').length ? 'bg-[#7c6af7] border-[#7c6af7]' : 'border-zinc-700'}`}>
                {selectedSources.size === sources.filter(s => s.status === 'ready').length && <Check size={10} className="text-white" strokeWidth={3} />}
              </div>
            </button>
          </div>

          {/* Scrollable Sources List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
            {filteredSources.length === 0 && (
              <div className="h-32 flex flex-col items-center justify-center text-center p-4">
                <FileText size={20} className="text-zinc-600 mb-2" />
                <p className="text-xs text-zinc-500">No sources added yet</p>
              </div>
            )}
            {filteredSources.map(src => {
              const isSelected = selectedSources.has(src._id);
              return (
                <div
                  key={src._id}
                  onClick={() => src.status === 'ready' && toggleSrc(src._id)}
                  className={`group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-zinc-800/40 border-white/[0.04]' : 'bg-transparent border-transparent hover:bg-zinc-900/60'}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${TYPE_COLOR[src.type]}12`, border: `1.5px solid ${TYPE_COLOR[src.type]}18` }}>
                      {SOURCE_ICONS[src.type]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-zinc-200 truncate leading-tight group-hover:text-white transition">{src.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-zinc-500 font-medium">
                        {src.status === 'ready' ? (
                          <span>
                            {src.type.toUpperCase()} {formatSize(src.meta) ? `• ${formatSize(src.meta)}` : ''}
                          </span>
                        ) : src.status === 'failed' ? (
                          <span className="flex items-center gap-1 text-red-500 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                            Failed
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-[#7c6af7] font-semibold">
                            <span className="relative flex h-1.5 w-1.5 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7c6af7] opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#7c6af7]"></span>
                            </span>
                            <span className="capitalize">
                              {src.status === 'pending' && 'Pending...'}
                              {src.status === 'fetching' && 'Fetching...'}
                              {src.status === 'rendering' && 'Rendering...'}
                              {src.status === 'extracting' && 'Extracting...'}
                              {src.status === 'chunking' && 'Splitting...'}
                              {src.status === 'embedding' && 'Embedding...'}
                              {src.status === 'processing' && 'Processing...'}
                              {!['pending', 'fetching', 'rendering', 'extracting', 'chunking', 'embedding', 'processing'].includes(src.status) && 'Processing...'}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {src.status === 'ready' && (
                      <div className={`w-4 h-4 rounded flex items-center justify-center transition ${isSelected ? 'bg-[#7c6af7]' : 'border border-zinc-700'}`}>
                        {isSelected && <Check size={11} className="text-white" strokeWidth={3} />}
                      </div>
                    )}
                    <button onClick={(e) => deleteSrc(src._id, e)} className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-zinc-300 rounded transition">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </aside>

        {/* Resizer Handle */}
        {!sidebarCollapsed && (
          <div
            onMouseDown={startResize}
            className="hidden md:block w-1 cursor-col-resize hover:w-1.5 hover:bg-[#7c6af7]/40 active:bg-[#7c6af7] transition-all rounded-full h-[98%] my-auto shrink-0 z-10"
          />
        )}

        {/* Center Panel: Chat Workspace */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#101216] border border-white/[0.04] rounded-2xl relative">

          {/* Chat Panel Header */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-1.5 hover:bg-white/[0.04] rounded-lg transition text-zinc-400 hover:text-zinc-200 mr-1 flex items-center justify-center"
                title={sidebarCollapsed ? "Show sources" : "Hide sources"}
              >
                <ChevronRight size={15} className={sidebarCollapsed ? "rotate-180" : ""} />
              </button>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Chat</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowNotes(!showNotes);
                  if (!showNotes) {
                    setActiveCitation(null);
                  }
                }}
                className={`p-1.5 rounded-lg transition ${showNotes ? 'bg-[#7c6af7]/20 text-[#7c6af7]' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'}`}
                title="Notebook Notes"
              >
                <StickyNote size={14} />
              </button>

            </div>
          </div>

          {/* Messages view */}
          <div className="flex-1 overflow-y-auto px-6 py-8">
            <div className="max-w-2xl mx-auto mb-4">
              {sources
                .filter(s => s.status === 'pending' || s.status === 'processing')
                .map(src => (
                  <ProcessingStatus
                    key={src._id}
                    sourceId={src._id}
                    notebookId={notebookId}
                    initialSource={src}
                    onComplete={(updatedSrc) => {
                      setSources(prev => prev.map(s => s._id === updatedSrc._id ? updatedSrc : s));
                    }}
                    onError={() => {
                      api.sources.list(notebookId).then(setSources);
                    }}
                  />
                ))}
            </div>

            {messages.length === 0 && !streaming && (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 bg-[#7c6af7]/10 border border-[#7c6af7]/20">
                  <Sparkles size={24} className="text-[#7c6af7]" />
                </div>
                <h2 className="text-lg font-bold text-white mb-2">Ask about your sources</h2>
                <p className="text-sm text-zinc-400 mb-8 max-w-sm">Select sources from the left, then ask a question. Answers cite exactly where each fact came from.</p>
                <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
                  {[
                    'Summarize the key points',
                    'What are the main themes?',
                    'List all key concepts',
                    'Compare ideas across sources'
                  ].map(q => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
                      className="text-left p-4 rounded-2xl text-xs font-semibold transition bg-[#181b21] border border-white/[0.04] hover:bg-[#20242c] hover:border-white/[0.08] text-zinc-300"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="max-w-2xl mx-auto space-y-8">
              {messages.map(msg => (
                <MessageBubble key={msg._id} msg={msg} onCitation={handleCitation} onCopy={copyMsg} copied={copied} />
              ))}

              {streaming && streamBuffer && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-[#7c6af7]/10 border border-[#7c6af7]/20 mt-0.5">
                    <Sparkles size={14} className="text-[#7c6af7]" />
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                      {streamBuffer}
                      <span className="inline-block w-1.5 h-4 ml-1 bg-[#7c6af7] animate-pulse" />
                    </p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>          {/* Message Input bar */}
          <div className="px-4 sm:px-6 pb-4 sm:pb-6 shrink-0 bg-gradient-to-t from-[#101216] via-[#101216] to-transparent">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-end gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-2xl bg-[#181b21] border border-white/[0.05] shadow-lg relative">
                <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-xl text-zinc-400 hover:text-white transition hover:bg-white/[0.02]">
                  <Paperclip size={16} />
                </button>
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                  onKeyDown={handleKey}
                  placeholder="Start typing..."
                  disabled={streaming}
                  className="flex-1 bg-transparent resize-none outline-none text-sm leading-relaxed text-white py-1 placeholder-zinc-500 border-0"
                  style={{ minHeight: '24px', maxHeight: '120px' }}
                />

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold tracking-wide px-2 py-0.5 sm:px-2.5 sm:py-1 bg-zinc-800 text-zinc-400 rounded-full">
                    {selectedSources.size} <span className="hidden xs:inline">{selectedSources.size === 1 ? 'source' : 'sources'}</span>
                  </span>
                  <button
                    onClick={send}
                    disabled={!input.trim() || streaming}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition disabled:opacity-40 shrink-0 ${input.trim() && !streaming ? 'bg-[#7c6af7] hover:scale-105 text-white' : 'bg-zinc-800 text-zinc-500'}`}
                  >
                    {streaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
                  </button>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept=".pdf,.vtt,.txt" className="hidden" onChange={handleUploadFile} />
              <p className="text-[10px] text-zinc-600 text-center mt-3">
                Gemini Notebook can be inaccurate; please double-check its responses.
              </p>
            </div>
          </div>
        </main>

        {/* Right Sidebar - Citation / Document Viewer */}
        {activeCitation !== null && (
          <aside className="rc-responsive-right-sidebar w-80 shrink-0 flex flex-col overflow-hidden bg-[#101216] border border-white/[0.04] rounded-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.04]">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Citation source</span>
              <button onClick={() => setActiveCitation(null)} className="p-1 text-zinc-500 hover:text-zinc-300 transition">
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {citationData ? (
                <div className="space-y-4">
                  {/* YouTube Player Embed with timestamp seeking */}
                  {(() => {
                    const matchedSource = sources.find(s => s._id === citationData.sourceId);
                    const sourceUrl = matchedSource?.originUrl || matchedSource?.meta?.url;
                    if (matchedSource && matchedSource.type === 'youtube' && sourceUrl) {
                      const getYoutubeVideoId = (url) => {
                        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                        const match = url.match(regExp);
                        return (match && match[2].length === 11) ? match[2] : null;
                      };
                      const vidId = getYoutubeVideoId(sourceUrl);
                      if (vidId) {
                        return (
                          <div className="w-full aspect-video rounded-xl overflow-hidden border border-white/[0.06] bg-black shadow-lg">
                            <iframe
                              width="100%"
                              height="100%"
                              src={`https://www.youtube.com/embed/${vidId}?start=${Math.floor(citationData.location?.timestamp || 0)}&autoplay=1`}
                              title="YouTube video player"
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                            />
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}

                  <div className="p-4 rounded-2xl bg-zinc-900 border border-white/[0.02] text-sm text-zinc-200 leading-relaxed shadow-inner">
                    "{citationData.text}"
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-[#7c6af7] px-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#7c6af7] animate-ping" />
                    <span>Fact matched in workspace</span>
                  </div>

                  <div className="pt-3 border-t border-white/[0.04] space-y-2">
                    <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-widest block">Source info</span>
                    {(() => {
                      const matchedSource = sources.find(s => s._id === citationData.sourceId);
                      if (matchedSource) {
                        return (
                          <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/[0.02] space-y-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-white/[0.02]">
                                {matchedSource.type}
                              </span>
                              {citationData.location && (
                                <span className="text-[10px] text-zinc-500 font-semibold">
                                  {typeof citationData.location.pageNumber === 'number' && `Page ${citationData.location.pageNumber}`}
                                  {typeof citationData.location.timestamp === 'number' && `At ${Math.floor(citationData.location.timestamp / 60)}:${(Math.floor(citationData.location.timestamp % 60)).toString().padStart(2, '0')}`}
                                  {typeof citationData.location.paragraphIndex === 'number' && `Paragraph ${citationData.location.paragraphIndex + 1}`}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-semibold text-zinc-200 leading-snug group-hover:text-white transition">
                              {matchedSource.title}
                            </p>
                            {(matchedSource.originUrl || matchedSource.meta?.url) && (
                              <a
                                href={matchedSource.originUrl || matchedSource.meta.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-[#7c6af7] hover:underline font-semibold flex items-center gap-1 truncate mt-1"
                              >
                                View original link
                              </a>
                            )}
                          </div>
                        );
                      }
                      return (
                        <p className="text-xs font-medium text-zinc-400 truncate">
                          Source Ref: {citationData.sourceId?.toString() || 'Reference'}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="h-48 flex flex-col items-center justify-center text-center p-4">
                  <Eye size={18} className="text-zinc-600 mb-2" />
                  <p className="text-xs text-zinc-500">No citation preview data loaded</p>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-white/[0.04] bg-[#0c0e12] flex items-center justify-between shrink-0 text-xs text-zinc-500">
              <div className="flex gap-2">
                <button className="hover:text-white transition"><Bookmark size={14} /></button>
                <button className="hover:text-white transition"><Printer size={14} /></button>
              </div>
              <span>Timestamp ref citation</span>
            </div>
          </aside>
        )}
        {/* Notes Sidebar */}
        {showNotes && (
          <aside className="rc-responsive-right-sidebar w-80 shrink-0 flex flex-col overflow-hidden bg-[#101216] border border-white/[0.04] rounded-2xl animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.04]">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Workspace Notes</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={createNewNote}
                  className="p-1 hover:bg-white/[0.04] rounded transition text-zinc-400 hover:text-zinc-200"
                  title="Create New Note"
                >
                  <Plus size={15} />
                </button>
                <button onClick={() => setShowNotes(false)} className="p-1 text-zinc-500 hover:text-zinc-300 transition">
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Note Selector / List */}
            {notes.length > 0 && (
              <div className="px-3 pt-3 pb-2 border-b border-white/[0.02] flex gap-1 overflow-x-auto scrollbar-none">
                {notes.map(n => (
                  <button
                    key={n._id}
                    onClick={() => setActiveNote(n)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition shrink-0 flex items-center gap-1.5 ${activeNote?._id === n._id ? 'bg-[#7c6af7]/20 border border-[#7c6af7]/30 text-[#8e7ef9]' : 'bg-zinc-900 border border-white/[0.02] text-zinc-400 hover:text-white'}`}
                  >
                    <span>{n.title || 'Untitled'}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNote(n._id); }}
                      className="p-0.5 hover:bg-white/10 rounded transition text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 size={10} />
                    </button>
                  </button>
                ))}
              </div>
            )}

            {/* Note Editor */}
            <div className="flex-1 flex flex-col min-h-0 bg-[#0d0f13]/60">
              {activeNote ? (
                <div className="flex-1 flex flex-col p-4 space-y-3 min-h-0">
                  <div className="flex items-center justify-between shrink-0">
                    <input
                      type="text"
                      value={activeNote.title}
                      onChange={e => handleNoteChange({ title: e.target.value })}
                      placeholder="Note Title..."
                      className="bg-transparent text-sm font-bold text-white outline-none border-b border-transparent focus:border-zinc-800 pb-0.5 w-full"
                    />
                  </div>
                  <textarea
                    value={activeNote.content}
                    onChange={e => handleNoteChange({ content: e.target.value })}
                    placeholder="Start writing notes here... (Autosaves)"
                    className="flex-1 bg-transparent text-xs text-zinc-300 leading-relaxed outline-none resize-none placeholder-zinc-600 border-0 p-0"
                  />
                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.02] text-[10px] text-zinc-600 font-semibold shrink-0">
                    <div className="flex items-center gap-1">
                      <Loader2 size={10} className="animate-pulse" />
                      <span>Autosaved</span>
                    </div>
                    <span>{activeNote.content.length} characters</span>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <StickyNote size={24} className="text-zinc-700" />
                  <div>
                    <h4 className="text-xs font-bold text-zinc-400">No notes in workspace</h4>
                    <p className="text-[10px] text-zinc-600 mt-1">Keep track of key concepts and citations directly in this notebook.</p>
                  </div>
                  <button
                    onClick={createNewNote}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#7c6af7] hover:bg-[#8e7ef9] text-white transition flex items-center gap-1.5 shadow"
                  >
                    <Plus size={13} /> Create Note
                  </button>
                </div>
              )}
            </div>
          </aside>
        )}

      </div>

      {/* Add Source Modal Dialog */}
      {showAddSource && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-2xl bg-[#101216] border border-white/[0.06] rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="relative px-6 pt-8 pb-4">
              <h3 className="text-lg font-bold text-white text-center">
                Add sources to this notebook
              </h3>
              <button
                onClick={() => { setShowAddSource(false); setAddMode(''); setAddForm({ url: '', title: '', content: '' }); }}
                className="absolute right-6 top-6 p-1.5 text-zinc-400 hover:text-white transition rounded-full hover:bg-white/[0.04]"
              >
                <X size={18} />
              </button>
            </div>

            {!addMode ? (
              <div className="bg-[#101216]">
                {/* Dropzone container */}
                <div className="px-6 pb-8">
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDropFile}
                    className="border border-dashed border-white/[0.08] hover:border-[#7c6af7]/50 transition-all rounded-3xl p-10 text-center flex flex-col items-center justify-center bg-zinc-900/10 hover:bg-[#7c6af7]/2"
                  >
                    <span className="text-sm font-semibold text-white mb-1">
                      Drag & drop your files here
                    </span>
                    <span className="text-xs text-zinc-500 mb-8">
                      Supports PDF, TXT, VTT
                    </span>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4.5 py-2.5 rounded-full bg-zinc-800 text-xs font-semibold text-white border border-white/[0.06] hover:bg-zinc-700 transition shadow-sm"
                      >
                        <Upload size={13} />
                        <span>Upload files</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAddMode('url')}
                        className="flex items-center gap-2 px-4.5 py-2.5 rounded-full bg-zinc-800 text-xs font-semibold text-white border border-white/[0.06] hover:bg-zinc-700 transition shadow-sm"
                      >
                        <div className="flex items-center gap-1">
                          <Globe size={13} className="text-emerald-400" />
                          <PlayCircle size={13} className="text-red-500 -ml-1" />
                        </div>
                        <span>Websites</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAddMode('text')}
                        className="flex items-center gap-2 px-4.5 py-2.5 rounded-full bg-zinc-800 text-xs font-semibold text-white border border-white/[0.06] hover:bg-zinc-700 transition shadow-sm"
                      >
                        <FileText size={13} className="text-purple-400" />
                        <span>Copied text</span>
                      </button>
                    </div>
                  </div>

                  {/* Limits bar */}
                  <div className="mt-8 flex items-center justify-between gap-4">
                    <div className="flex-1 h-1 bg-zinc-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#7c6af7] rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (sources.length / 50) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-zinc-600 tracking-wider select-none shrink-0">
                      {sources.length}/50 sources
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddSource} className="p-6 space-y-4 bg-[#101216]">
                {addMode === 'url' && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-2">URL (YouTube or Website Link)</label>
                      <input
                        autoFocus
                        required
                        type="url"
                        value={addForm.url}
                        onChange={e => setAddForm({ ...addForm, url: e.target.value })}
                        placeholder="https://..."
                        className="w-full px-3.5 py-3 rounded-xl text-sm outline-none bg-zinc-900 border border-white/[0.04] text-white placeholder-zinc-600 focus:border-[#7c6af7]/50 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-2">Title (optional)</label>
                      <input
                        value={addForm.title}
                        onChange={e => setAddForm({ ...addForm, title: e.target.value })}
                        placeholder="Auto-detected if empty"
                        className="w-full px-3.5 py-3 rounded-xl text-sm outline-none bg-zinc-900 border border-white/[0.04] text-white placeholder-zinc-600 focus:border-[#7c6af7]/50 transition"
                      />
                    </div>
                  </>
                )}
                {addMode === 'text' && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-2">Title</label>
                      <input
                        required
                        autoFocus
                        value={addForm.title}
                        onChange={e => setAddForm({ ...addForm, title: e.target.value })}
                        placeholder="Source name"
                        className="w-full px-3.5 py-3 rounded-xl text-sm outline-none bg-zinc-900 border border-white/[0.04] text-white placeholder-zinc-600 focus:border-[#7c6af7]/50 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-2">Content</label>
                      <textarea
                        required
                        rows={6}
                        value={addForm.content}
                        onChange={e => setAddForm({ ...addForm, content: e.target.value })}
                        placeholder="Paste your text here..."
                        className="w-full px-3.5 py-3 rounded-xl text-sm outline-none bg-zinc-900 border border-white/[0.04] text-white placeholder-zinc-600 focus:border-[#7c6af7]/50 resize-none transition"
                      />
                    </div>
                  </>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setAddMode('')}
                    className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition border border-white/[0.02]"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex-1 py-3 bg-[#7c6af7] hover:bg-[#8e7ef9] rounded-xl text-xs font-semibold text-white transition flex items-center justify-center gap-2"
                  >
                    {uploading ? <Loader2 size={15} className="animate-spin" /> : 'Add source'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* Knowledge Graph Overlay */}
      {showGraph && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-4xl bg-[#101216] border border-white/[0.06] rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.04] shrink-0">
              <div className="flex items-center gap-2">
                <Network size={18} className="text-[#7c6af7]" />
                <span className="text-sm font-bold text-white tracking-wide">Connected Knowledge Graph</span>
              </div>
              <button
                onClick={() => setShowGraph(false)}
                className="p-1.5 text-zinc-400 hover:text-white transition rounded-full hover:bg-white/[0.04]"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 relative bg-[#0a0c10] overflow-hidden flex items-center justify-center">
              {graphLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={24} className="animate-spin text-[#7c6af7]" />
                  <span className="text-xs text-zinc-500 font-semibold">Computing workspace connections...</span>
                </div>
              ) : graphData.nodes.length === 0 ? (
                <div className="text-center space-y-2 p-6">
                  <Network size={32} className="text-zinc-700 mx-auto" />
                  <h4 className="text-xs font-bold text-zinc-400">Not enough sources ready</h4>
                  <p className="text-[10px] text-zinc-600">Add multiple ready sources to see semantic connections.</p>
                </div>
              ) : (
                <GraphCanvas nodes={graphData.nodes} links={graphData.links} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg, onCitation, onCopy, copied }) {
  const isUser = msg.role === 'user';

  const renderContent = (text) => {
    const lines = text.split('\n');
    return lines.map((line, li) => {
      if (line.startsWith('• ') || line.startsWith('- ')) {
        const content = line.slice(2);
        const parts = content.split(/(\*\*[^*]+\*\*|\[\d+\])/g);
        return (
          <div key={li} className="flex gap-2.5 my-1.5 items-start">
            <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-zinc-600" />
            <span className="text-sm leading-relaxed text-zinc-200">
              {parts.map((p, pi) => {
                if (p.startsWith('**') && p.endsWith('**')) return <strong key={pi} className="font-semibold text-white">{p.slice(2, -2)}</strong>;
                const m = p.match(/^\[(\d+)\]$/);
                if (m) return (
                  <button
                    key={pi}
                    onClick={() => onCitation(parseInt(m[1]))}
                    className="inline-flex items-center justify-center w-4 h-4 rounded bg-[#3b82f6]/20 border border-[#3b82f6]/30 text-[#60a5fa] text-[10px] font-bold mx-0.5 align-middle hover:scale-110 transition"
                  >
                    {m[1]}
                  </button>
                );
                return p;
              })}
            </span>
          </div>
        );
      }
      if (!line.trim()) return <div key={li} className="h-3" />;
      const parts = line.split(/(\*\*[^*]+\*\*|\[\d+\])/g);
      return (
        <p key={li} className="text-sm leading-relaxed text-zinc-200">
          {parts.map((p, pi) => {
            if (p.startsWith('**') && p.endsWith('**')) return <strong key={pi} className="font-semibold text-white">{p.slice(2, -2)}</strong>;
            const m = p.match(/^\[(\d+)\]$/);
            if (m) return (
              <button
                key={pi}
                onClick={() => onCitation(parseInt(m[1]))}
                className="inline-flex items-center justify-center w-4 h-4 rounded bg-[#3b82f6]/20 border border-[#3b82f6]/30 text-[#60a5fa] text-[10px] font-bold mx-0.5 align-middle hover:scale-110 transition"
              >
                {m[1]}
              </button>
            );
            return p;
          })}
        </p>
      );
    });
  };

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-md px-4 py-3 rounded-2xl rounded-tr-sm text-sm bg-zinc-800 border border-white/[0.04] text-white leading-relaxed">
          {msg.text}
        </div>
      </div>
    );
  }

  return (
    <div className="group animate-in fade-in duration-200">
      <div className="flex gap-4">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 bg-[#7c6af7]/10 border border-[#7c6af7]/20">
          <Sparkles size={14} className="text-[#7c6af7]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="space-y-1.5">
            {renderContent(msg.text)}
          </div>

          <div className="flex items-center gap-5 mt-4 opacity-0 group-hover:opacity-100 transition-all duration-200">
            <button className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition">
              <ThumbsUp size={13} />
            </button>
            <button className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition">
              <ThumbsDown size={13} />
            </button>
            <button
              onClick={() => onCopy(msg._id, msg.text)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition"
            >
              {copied === msg._id ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              {copied === msg._id ? 'Copied' : 'Copy'}
            </button>
            <button className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition">
              <RefreshCw size={13} />
            </button>
            <button className="flex items-center gap-1.5 text-xs text-[#7c6af7] font-semibold hover:opacity-80 transition ml-auto">
              <Plus size={12} strokeWidth={2.5} /> Save to note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GraphCanvas({ nodes, links }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    const w = canvas.width / (2 * window.devicePixelRatio);
    const h = canvas.height / (2 * window.devicePixelRatio);

    const simNodes = nodes.map((n, i) => ({
      ...n,
      x: w + (Math.random() - 0.5) * 160,
      y: h + (Math.random() - 0.5) * 160,
      vx: 0,
      vy: 0,
      radius: 9
    }));

    const simLinks = links.map(l => {
      const sourceNode = simNodes.find(n => n.id === l.source);
      const targetNode = simNodes.find(n => n.id === l.target);
      return { ...l, sourceNode, targetNode };
    }).filter(l => l.sourceNode && l.targetNode);

    let animationFrame;
    let hoveredNode = null;
    let dragNode = null;

    const step = () => {
      for (let i = 0; i < simNodes.length; i++) {
        for (let j = i + 1; j < simNodes.length; j++) {
          const dx = simNodes[j].x - simNodes[i].x;
          const dy = simNodes[j].y - simNodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 280) {
            const force = (280 - dist) * 0.08;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            simNodes[i].vx -= fx;
            simNodes[i].vy -= fy;
            simNodes[j].vx += fx;
            simNodes[j].vy += fy;
          }
        }
      }

      simLinks.forEach(link => {
        const dx = link.targetNode.x - link.sourceNode.x;
        const dy = link.targetNode.y - link.sourceNode.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const restLen = 100;
        const k = 0.05 * link.value;
        const force = (dist - restLen) * k;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        link.sourceNode.vx += fx;
        link.sourceNode.vy += fy;
        link.targetNode.vx -= fx;
        link.targetNode.vy -= fy;
      });

      const cx = canvas.width / (2 * window.devicePixelRatio);
      const cy = canvas.height / (2 * window.devicePixelRatio);
      simNodes.forEach(node => {
        const dx = cx - node.x;
        const dy = cy - node.y;
        node.vx += dx * 0.015;
        node.vy += dy * 0.015;
      });

      simNodes.forEach(node => {
        if (node === dragNode) return;
        node.vx *= 0.85;
        node.vy *= 0.85;
        node.x += node.vx;
        node.y += node.vy;
      });

      const currentW = canvas.width / window.devicePixelRatio;
      const currentH = canvas.height / window.devicePixelRatio;
      ctx.clearRect(0, 0, currentW, currentH);

      simLinks.forEach(link => {
        ctx.beginPath();
        ctx.moveTo(link.sourceNode.x, link.sourceNode.y);
        ctx.lineTo(link.targetNode.x, link.targetNode.y);
        ctx.strokeStyle = `rgba(124, 106, 247, ${0.1 + link.value * 0.25})`;
        ctx.lineWidth = 1.5 + link.value * 1.5;
        ctx.stroke();
      });

      simNodes.forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);

        let fill = "#7c6af7";
        if (node.type === "youtube") fill = "#ef4444";
        if (node.type === "weblink") fill = "#10b981";
        if (node.type === "text") fill = "#a855f7";

        ctx.fillStyle = fill;
        ctx.shadowColor = fill;
        ctx.shadowBlur = node === hoveredNode ? 14 : 0;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = node === hoveredNode ? 1.5 : 0;
        if (node === hoveredNode) ctx.stroke();

        if (node === hoveredNode || simNodes.length <= 15) {
          ctx.font = "bold 9px Inter, sans-serif";
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.textAlign = "center";
          const title = node.label.length > 25 ? node.label.slice(0, 22) + "..." : node.label;
          ctx.fillText(title, node.x, node.y - 14);
        }
      });

      animationFrame = requestAnimationFrame(step);
    };
    step();

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    const onMouseMove = (e) => {
      const pos = getPos(e);
      if (dragNode) {
        dragNode.x = pos.x;
        dragNode.y = pos.y;
        return;
      }

      let found = null;
      for (const n of simNodes) {
        const dx = n.x - pos.x;
        const dy = n.y - pos.y;
        if (dx * dx + dy * dy < 160) {
          found = n;
          break;
        }
      }
      hoveredNode = found;
      canvas.style.cursor = found ? 'pointer' : 'default';
    };

    const onMouseDown = (e) => {
      const pos = getPos(e);
      for (const n of simNodes) {
        const dx = n.x - pos.x;
        const dy = n.y - pos.y;
        if (dx * dx + dy * dy < 160) {
          dragNode = n;
          break;
        }
      }
    };

    const onMouseUp = () => {
      dragNode = null;
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
    };
  }, [nodes, links]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}
