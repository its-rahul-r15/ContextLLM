import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, BookOpen, Search, Trash2, MoreHorizontal, Clock, Loader2,
  GraduationCap, X, Sun, Moon
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
  <GraduationCap size={28} className="text-[#3b82f6]" />
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

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

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

  const filtered = notebooks.filter(n => (n.title || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div id="dashboard-root" className="min-h-screen bg-[#07080a] text-zinc-300 font-sans select-none antialiased flex flex-col">
      <style>{`
        /* ============================================================
           Light theme — warm off-white surface, single deepened violet
           accent, soft layered shadows instead of flat borders.
           Kept as one scoped block so dark mode (default) is untouched.
        ============================================================ */
        .light {
          --lt-bg: #f7f6fb;
          --lt-bg-soft: #f0eef8;
          --lt-surface: #ffffff;
          --lt-surface-sunken: #f4f3f9;
          --lt-border: #e6e3f0;
          --lt-border-strong: #d9d5ea;
          --lt-text-strong: #17151f;
          --lt-text: #3f3d4d;
          --lt-text-soft: #78748c;
          --lt-text-faint: #a6a2b8;
          --lt-accent: #6a4fe0;
          --lt-accent-strong: #5b3fd1;
          --lt-accent-wash: #6a4fe012;
          --lt-shadow-sm: 0 1px 2px rgba(30, 20, 60, 0.05);
          --lt-shadow-md: 0 4px 14px rgba(37, 22, 78, 0.07), 0 1px 2px rgba(37, 22, 78, 0.04);
          --lt-shadow-lg: 0 16px 36px -8px rgba(37, 22, 78, 0.16), 0 2px 8px rgba(37, 22, 78, 0.05);
        }

        .light #dashboard-root {
          background-color: var(--lt-bg) !important;
          color: var(--lt-text) !important;
          background-image: radial-gradient(circle at 12% 0%, #6a4fe00d 0%, transparent 45%);
        }

        .light #dashboard-header {
          background-color: rgba(255, 255, 255, 0.82) !important;
          border-bottom: 1px solid var(--lt-border) !important;
          box-shadow: var(--lt-shadow-sm) !important;
        }

        .light h2, .light h3, .light .text-white, .light .text-zinc-100 {
          color: var(--lt-text-strong) !important;
        }
        .light .text-zinc-200, .light .text-zinc-300 {
          color: var(--lt-text) !important;
        }
        .light .text-zinc-400 {
          color: var(--lt-text-soft) !important;
        }
        .light .text-zinc-500, .light .text-zinc-600 {
          color: var(--lt-text-faint) !important;
        }

        /* Brand wordmark keeps a touch of contrast instead of flattening to grey */
        .light .bg-gradient-to-r.bg-clip-text {
          background-image: linear-gradient(90deg, var(--lt-text-strong), var(--lt-text-soft)) !important;
        }

        /* Search pill */
        .light .bg-zinc-900\/50 {
          background-color: var(--lt-surface-sunken) !important;
          border-color: var(--lt-border) !important;
        }
        .light .focus-within\:border-\[\#7c6af7\]\/50:focus-within {
          border-color: var(--lt-accent) !important;
          background-color: var(--lt-surface) !important;
        }

        /* Primary "Create new" pill — deepened for AA contrast on light */
        .light .bg-gradient-to-r.from-\[\#7c6af7\] {
          background-image: none !important;
          background-color: var(--lt-accent) !important;
          box-shadow: 0 6px 16px -4px var(--lt-accent-wash), 0 2px 4px rgba(37, 22, 78, 0.08) !important;
        }
        .light .bg-gradient-to-r.from-\[\#7c6af7\]:hover {
          background-color: var(--lt-accent-strong) !important;
        }

        /* Theme toggle + icon buttons */
        .light .border-white\/\[0\.08\] {
          border-color: var(--lt-border-strong) !important;
        }
        .light .hover\:bg-white\/\[0\.04\]:hover,
        .light .hover\:bg-white\/\[0\.03\]:hover,
        .light .hover\:bg-white\/\[0\.02\]:hover {
          background-color: var(--lt-bg-soft) !important;
        }

        /* Profile dropdown */
        .light .bg-\[\#12141a\] {
          background-color: var(--lt-surface) !important;
          border-color: var(--lt-border) !important;
          box-shadow: var(--lt-shadow-lg) !important;
        }
        .light .bg-\[\#0c0e12\] {
          background-color: var(--lt-surface-sunken) !important;
        }
        .light .border-white\/\[0\.04\], .light .border-white\/\[0\.06\] {
          border-color: var(--lt-border) !important;
        }
        .light .hover\:bg-red-500\/\[0\.04\]:hover {
          background-color: #fef2f2 !important;
        }

        /* Notebook cards */
        .light .bg-\[\#0f1115\] {
          background-color: var(--lt-surface) !important;
          border-color: var(--lt-border) !important;
          box-shadow: var(--lt-shadow-md) !important;
        }
        .light .hover\:border-white\/\[0\.08\]:hover {
          border-color: var(--lt-border-strong) !important;
        }
        .light .group:hover .bg-\[\#0f1115\],
        .light .group.hover\:shadow-xl:hover {
          box-shadow: var(--lt-shadow-lg) !important;
        }
        .light .border-white\/\[0\.02\] {
          border-color: var(--lt-border) !important;
        }

        /* Sources badge */
        .light .bg-zinc-900.border-white\/\[0\.02\] {
          background-color: var(--lt-accent-wash) !important;
          border-color: transparent !important;
        }
        .light .text-\[\#7c6af7\] {
          color: var(--lt-accent-strong) !important;
        }
        .light .bg-\[\#7c6af7\]\/5 {
          background-color: var(--lt-accent-wash) !important;
        }

        /* Icon tiles keep their tint but sit better on white */
        .light .bg-purple-500\/10 { background-color: #6a4fe014 !important; border-color: #6a4fe022 !important; }
        .light .bg-blue-500\/10 { background-color: #3b82f614 !important; border-color: #3b82f622 !important; }
        .light .bg-emerald-500\/10 { background-color: #10b98114 !important; border-color: #10b98122 !important; }

        /* Create-notebook dashed card */
        .light .border-dashed {
          border-color: var(--lt-border-strong) !important;
          background-color: transparent !important;
        }
        .light .border-dashed:hover {
          border-color: var(--lt-accent) !important;
          background-color: var(--lt-accent-wash) !important;
        }
        .light .bg-\[\#0c0e12\]\/20 {
          background-color: transparent !important;
        }
        .light .bg-zinc-900\/60 {
          background-color: var(--lt-surface-sunken) !important;
          border-color: var(--lt-border) !important;
        }
        .light .group:hover .text-zinc-500.group-hover\:text-\[\#7c6af7\] {
          color: var(--lt-accent) !important;
        }

        /* Empty search state + skeleton loaders */
        .light .bg-zinc-900 {
          background-color: var(--lt-bg-soft) !important;
        }
        .light .bg-\[\#101216\] {
          background-color: var(--lt-bg-soft) !important;
        }

        /* Create-notebook modal */
        .light .bg-black\/75 {
          background-color: rgba(23, 21, 31, 0.45) !important;
        }
        .light .bg-\[\#0f1115\].rounded-3xl {
          box-shadow: var(--lt-shadow-lg) !important;
        }
        .light input {
          color: var(--lt-text-strong) !important;
        }
        .light .placeholder-zinc-600::placeholder {
          color: var(--lt-text-faint) !important;
        }
        .light .bg-zinc-900\/80 {
          background-color: var(--lt-surface-sunken) !important;
        }
        .light .hover\:bg-zinc-800:hover {
          background-color: var(--lt-bg-soft) !important;
        }
        .light .bg-\[\#7c6af7\] {
          background-color: var(--lt-accent) !important;
        }
        .light .hover\:bg-\[\#8e7ef9\]:hover {
          background-color: var(--lt-accent-strong) !important;
        }
      `}</style>

      {/* Combined Single Header/Navbar matching mockup */}
      <header id="dashboard-header" className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-8 h-16 bg-[#0c0e12]/80 backdrop-blur-md border-b border-white/[0.04]">
        {/* Left Brand */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#7c6af7] to-[#5b4af2] shadow-lg shadow-[#7c6af7]/10">
            <BookOpen size={14} className="text-white" />
          </div>
          <span className="font-bold text-sm sm:text-base text-white tracking-wide bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">ContextLLM</span>
        </div>

        {/* Right tools and actions */}
        <div className="flex items-center gap-2 sm:gap-4 relative">
          {/* Quick Search */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-zinc-900/50 border border-white/[0.04] focus-within:border-[#7c6af7]/50 focus-within:bg-zinc-900 transition-all duration-200 w-28 xs:w-36 sm:w-44 md:w-56">
            <Search size={12} className="text-zinc-500 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="bg-transparent text-[10px] sm:text-xs outline-none w-full text-zinc-200 placeholder-zinc-500 border-none"
            />
          </div>

          {/* Create notebook button */}
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 px-3 sm:px-5 py-1.5 sm:py-2 bg-gradient-to-r from-[#7c6af7] to-[#6b58f9] hover:from-[#8e7ef9] hover:to-[#7c6af7] text-white rounded-full text-[10px] sm:text-xs font-bold shadow-md shadow-[#7c6af7]/10 hover:scale-[1.02] active:scale-95 transition-all duration-150 shrink-0"
          >
            <Plus size={12} strokeWidth={2.5} />
            <span className="hidden xs:inline">Create new</span>
            <span className="inline xs:hidden">New</span>
          </button>

          <span className="h-4 w-px bg-white/[0.08] hidden xs:inline" />

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.04] text-zinc-400 hover:text-white transition shrink-0"
            title="Toggle theme"
          >
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          </button>

          {/* User Profile Trigger */}
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 p-0.5 rounded-full hover:bg-white/[0.03] border border-transparent hover:border-white/[0.06] transition-all shrink-0"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-[#7c6af7] to-[#9b8df9] flex items-center justify-center text-xs font-bold text-white border border-white/10 shadow-inner">
              {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
            </div>
          </button>

          {showProfile && (
            <div className="absolute right-0 top-12 rounded-2xl overflow-hidden z-50 w-52 sm:w-56 shadow-2xl bg-[#12141a] border border-white/[0.06] animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-white/[0.04] bg-[#0c0e12]">
                <p className="text-xs font-bold text-white truncate">{user?.displayName || 'User profile'}</p>
                <p className="text-[10px] text-zinc-500 truncate mt-0.5">{user?.email}</p>
              </div>
              <button
                onClick={() => { setShowProfile(false); logout().then(() => navigate('/login')); }}
                className="w-full text-left px-4 sm:px-5 py-3 sm:py-3.5 text-xs text-red-400 hover:bg-red-500/[0.04] hover:text-red-300 transition font-semibold"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-12 overflow-y-auto">
        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white mb-6 sm:mb-8 select-none">
          My notebooks
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-52 rounded-3xl bg-[#101216] border border-white/[0.04] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 && search ? (
          <div className="flex flex-col items-center justify-center py-20 sm:py-28 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-4 bg-zinc-900 border border-white/[0.02]">
              <Search size={20} className="text-zinc-600" />
            </div>
            <p className="text-sm font-semibold text-white">No notebooks match your search</p>
            <p className="text-xs text-zinc-500 mt-1">Try searching for another notebook title.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Create Notebook Card Trigger (Card 1, Large/Premium) */}
            {!search && (
              <div
                onClick={() => setCreating(true)}
                className="group h-48 sm:h-52 rounded-3xl border border-dashed border-white/[0.08] hover:border-[#7c6af7]/40 bg-[#0c0e12]/20 hover:bg-[#7c6af7]/[0.02] transition-all duration-300 cursor-pointer flex flex-col items-center justify-center text-center gap-3 p-5 sm:p-6"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-zinc-900/60 border border-white/[0.04] flex items-center justify-center text-zinc-400 group-hover:text-[#7c6af7] group-hover:border-[#7c6af7]/30 group-hover:scale-105 transition duration-300 shadow-inner">
                  <Plus size={18} strokeWidth={2} />
                </div>
                <span className="text-xs font-bold tracking-wide text-zinc-500 group-hover:text-zinc-300 transition duration-300">
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
                  className="group relative h-48 sm:h-52 rounded-3xl p-5 sm:p-6 bg-[#0f1115] border border-white/[0.04] hover:border-white/[0.08] transition-all duration-300 cursor-pointer flex flex-col justify-between shadow-lg shadow-black/10 hover:shadow-xl hover:shadow-black/35 hover:-translate-y-0.5"
                  onClick={() => navigate(`/notebook/${nb._id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center border shadow-sm transition-all duration-300 group-hover:scale-105 ${ICON_BACKGROUNDS[iconIndex]}`}>
                      {NOTEBOOK_ICONS[iconIndex]}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === nb._id ? null : nb._id); }}
                      className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-2 rounded-xl hover:bg-white/[0.04] transition-all text-zinc-500 hover:text-zinc-300"
                    >
                      <MoreHorizontal size={15} />
                    </button>
                  </div>

                  <div className="mt-4 flex-1 flex flex-col justify-center">
                    <h3 className="text-sm font-bold text-zinc-100 leading-snug line-clamp-2 group-hover:text-white transition duration-200">
                      {nb.title}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/[0.02] pt-4 mt-2">
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-semibold tracking-wide uppercase">
                      <Clock size={10} className="text-zinc-600" />
                      <span>{formatDate(nb.createdAt)}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 bg-zinc-900 border border-white/[0.02] rounded-full text-[#7c6af7] bg-[#7c6af7]/5">
                      {nb.sourceCount || 0} {nb.sourceCount === 1 ? 'source' : 'sources'}
                    </span>
                  </div>

                  {activeMenu === nb._id && (
                    <div
                      className="absolute top-14 right-4 rounded-xl overflow-hidden z-20 w-44 shadow-2xl bg-[#12141a] border border-white/[0.06] animate-in fade-in duration-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => deleteNotebook(nb._id)}
                        className="w-full text-left flex items-center gap-2 px-4 py-3 text-xs text-red-400 hover:bg-red-500/[0.04] hover:text-red-300 font-bold transition"
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
          <div className="w-full max-w-md bg-[#0f1115] border border-white/[0.06] rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.04] bg-[#0c0e12]">
              <h3 className="text-sm font-bold text-white">Create new notebook</h3>
              <button
                onClick={() => { setCreating(false); setNewTitle(''); }}
                className="p-1.5 text-zinc-400 hover:text-white transition rounded-full hover:bg-white/[0.04]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={createNotebook} className="p-6 space-y-5 bg-[#0f1115]">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wide">Notebook Name</label>
                <input
                  autoFocus
                  required
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Next.js Mastering Course"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none bg-zinc-900/60 border border-white/[0.04] text-white placeholder-zinc-600 focus:border-[#7c6af7]/50 focus:bg-zinc-950 transition duration-200"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setCreating(false); setNewTitle(''); }}
                  className="flex-1 py-3 bg-zinc-900/80 hover:bg-zinc-800 rounded-xl text-xs font-bold text-zinc-400 hover:text-white transition border border-white/[0.02]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#7c6af7] hover:bg-[#8e7ef9] rounded-xl text-xs font-bold text-white transition flex items-center justify-center shadow-lg shadow-[#7c6af7]/10"
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