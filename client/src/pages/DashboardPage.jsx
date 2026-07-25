import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, BookOpen, Search, Trash2, MoreHorizontal, Clock, Loader2, 
  GraduationCap, Laptop, ChevronDown, List, X, Settings, Grid 
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const formatDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

const NOTEBOOK_ICONS = [
  <GraduationCap size={28} className="text-[#a855f7]" />,
  <BookOpen size={28} className="text-[#10b981]" />,
  <Laptop size={28} className="text-[#3b82f6]" />
];

const ICON_BACKGROUNDS = [
  'bg-purple-500/10 border-purple-500/20',
  'bg-emerald-500/10 border-emerald-500/20',
  'bg-blue-500/10 border-blue-500/20'
];

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notebooks, setNotebooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  useEffect(() => {
    api.notebooks.list()
      .then(d => setNotebooks(d?.notebooks || []))
      .finally(() => setLoading(false));
  }, []);

  const createNotebook = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const nb = await api.notebooks.create({ title: newTitle.trim() });
    setNotebooks(prev => [nb, ...prev]);
    setNewTitle('');
    setCreating(false);
    navigate(`/notebook/${nb._id}`);
  };

  const deleteNotebook = async (id) => {
    await api.notebooks.delete(id);
    setNotebooks(prev => prev.filter(n => n._id !== id));
    setActiveMenu(null);
  };

  const filtered = notebooks.filter(n => n.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-[#07080a] text-zinc-300 font-sans select-none antialiased flex flex-col">
      
      {/* Combined Single Header/Navbar matching mockup */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-8 h-16 bg-[#0c0e12] border-b border-white/[0.04]">
        {/* Left Brand + My notebooks Active Tab */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#7c6af7]">
              <BookOpen size={16} className="text-white" />
            </div>
            <span className="font-bold text-sm text-white tracking-wide">ContextLLM</span>
          </div>

          <div className="flex items-center">
            <button className="px-4 py-1.5 rounded-full text-xs font-semibold bg-[#181b21] text-white border border-white/[0.04] shadow-sm transition">
              My notebooks
            </button>
          </div>
        </div>

        {/* Right tools and actions */}
        <div className="flex items-center gap-4 relative">
          {/* Quick Search */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#181b21] border border-white/[0.04]">
            <Search size={13} className="text-zinc-500 shrink-0" />
            <input 
              type="text" 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notebooks..."
              className="bg-transparent text-xs outline-none w-32 md:w-44 text-zinc-200 placeholder-zinc-500 border-none"
            />
          </div>

          {/* Grid/List toggler */}
          <div className="flex items-center bg-[#181b21] border border-white/[0.04] rounded-full p-1 shrink-0">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded-full transition ${viewMode === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Grid size={13} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1 rounded-full transition ${viewMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <List size={13} />
            </button>
          </div>

          {/* Sort selection */}
          <button className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#181b21] border border-white/[0.04] hover:bg-zinc-800 rounded-full text-xs font-medium text-zinc-300 transition shrink-0">
            <span>Most recent</span>
            <ChevronDown size={11} className="text-zinc-500" />
          </button>

          {/* Create notebook button */}
          <button 
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4.5 py-2 bg-white text-[#07080a] hover:bg-zinc-200 rounded-full text-xs font-semibold shadow-lg hover:scale-105 transition duration-150 shrink-0"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>Create new</span>
          </button>

          <span className="h-4 w-px bg-white/[0.08]" />

          {/* Actions & Settings placeholders matching mockup */}
          <button className="p-2 border border-white/[0.08] hover:bg-white/[0.04] transition rounded-full text-zinc-300">
            <Settings size={14} />
          </button>
          <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase">PRO</span>
          
          <button 
            onClick={() => setShowProfile(!showProfile)} 
            className="flex items-center gap-2 p-1 rounded-full hover:bg-white/[0.03] transition-all shrink-0"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#7c6af7] to-[#9b8df9] flex items-center justify-center text-xs font-bold text-white border border-white/10 hover:opacity-90 transition">
              {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
            </div>
          </button>

          {showProfile && (
            <div className="absolute right-0 top-12 rounded-2xl overflow-hidden z-50 w-52 shadow-2xl bg-[#101216] border border-white/[0.06] animate-in fade-in slide-in-from-top-1 duration-150">
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
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-12 overflow-y-auto">
        <h2 className="text-2xl font-bold tracking-tight text-white mb-8 select-none">
          My notebooks
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-52 rounded-[24px] bg-[#101216] border border-white/[0.04] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 && search ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-zinc-900 border border-white/[0.02]">
              <Search size={22} className="text-zinc-600" />
            </div>
            <p className="text-sm font-semibold text-white">No notebooks match your search</p>
            <p className="text-xs text-zinc-500 mt-1">Try searching for another notebook title.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Create Notebook Card Trigger (Card 1, Large/Premium) */}
            {!search && (
              <div 
                onClick={() => setCreating(true)}
                className="group h-52 rounded-[24px] border-2 border-dashed border-white/[0.08] hover:border-[#7c6af7]/40 hover:bg-[#7c6af7]/2 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center text-center gap-4 p-6 bg-zinc-900/5"
              >
                <div className="w-12 h-12 rounded-full bg-zinc-900 border border-white/[0.04] flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:scale-105 transition duration-150 shadow-sm">
                  <Plus size={22} strokeWidth={2.5} />
                </div>
                <span className="text-sm font-bold text-zinc-400 group-hover:text-white transition">
                  Create new notebook
                </span>
              </div>
            )}

            {/* Render Notebooks Grid (Large & Premium spacing) */}
            {filtered.map((nb, index) => {
              const iconIndex = index % NOTEBOOK_ICONS.length;
              return (
                <div 
                  key={nb._id} 
                  className="group relative h-52 rounded-[24px] p-6 bg-[#101216] border border-white/[0.04] hover:border-white/[0.08] transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-md hover:shadow-xl hover:shadow-black/30"
                  onClick={() => navigate(`/notebook/${nb._id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm ${ICON_BACKGROUNDS[iconIndex]}`}>
                      {NOTEBOOK_ICONS[iconIndex]}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === nb._id ? null : nb._id); }}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-xl hover:bg-white/[0.03] transition-all text-zinc-500 hover:text-zinc-300"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </div>

                  <div className="mt-4 flex-1">
                    <h3 className="text-sm font-bold text-white leading-snug line-clamp-2 group-hover:text-[#9b8df9] transition">
                      {nb.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500 font-semibold tracking-wide">
                    <span>{formatDate(nb.createdAt)}</span>
                    <span>•</span>
                    <span className="text-zinc-400">
                      {nb.sourceCount || 0} {nb.sourceCount === 1 ? 'source' : 'sources'}
                    </span>
                  </div>

                  {activeMenu === nb._id && (
                    <div 
                      className="absolute top-14 right-4 rounded-xl overflow-hidden z-20 w-44 shadow-2xl bg-[#101216] border border-white/[0.06] animate-in fade-in duration-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button 
                        onClick={() => deleteNotebook(nb._id)} 
                        className="w-full text-left flex items-center gap-2 px-4.5 py-3.5 text-xs text-red-400 hover:bg-white/[0.02] font-semibold transition"
                      >
                        <Trash2 size={13} /> Delete notebook
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Profile click mask */}
      {showProfile && <div className="fixed inset-0 z-30" onClick={() => setShowProfile(false)} />}
      {activeMenu && <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />}

      {/* Notebook Creation Popup Dialog */}
      {creating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#101216] border border-white/[0.06] rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.04] bg-[#0c0e12]">
              <h3 className="text-sm font-semibold text-white">Create notebook</h3>
              <button 
                onClick={() => { setCreating(false); setNewTitle(''); }} 
                className="p-1 text-zinc-400 hover:text-white transition rounded-lg hover:bg-white/[0.04]"
              >
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={createNotebook} className="p-6 space-y-4 bg-[#101216]">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2">Notebook Name</label>
                <input 
                  autoFocus 
                  required 
                  type="text" 
                  value={newTitle} 
                  onChange={e => setNewTitle(e.target.value)} 
                  placeholder="e.g. Next.js Mastering Course" 
                  className="w-full px-3.5 py-3 rounded-xl text-sm outline-none bg-zinc-900 border border-white/[0.04] text-white placeholder-zinc-600 focus:border-[#7c6af7]/50 transition" 
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => { setCreating(false); setNewTitle(''); }} 
                  className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition border border-white/[0.02]"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-[#7c6af7] hover:bg-[#8e7ef9] rounded-xl text-xs font-semibold text-white transition flex items-center justify-center"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
