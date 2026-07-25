import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, BookOpen, Globe, PlayCircle, Star } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

// Background mock cards to simulate "knowledge-based AI" exactly like the screenshot
const MOCK_BG_CARDS = [
  { title: "But what is a neural network? | Deep learning...", type: "youtube", tags: ["AI", "Neural Networks"], site: "YOUTUBE.COM" },
  { title: "Acquired Podcast: Acquired", type: "spotify", tags: ["Tech", "Business"], site: "OPEN.SPOTIFY.COM" },
  { title: "Intro to Large Language Models", type: "youtube", tags: ["AI", "LLMs"], site: "YOUTUBE.COM" },
  { title: "arXiv: Attention Is All You Need", type: "weblink", tags: ["Transformers", "NLP"], site: "ARXIV.ORG" },
  { title: "Bryan Johnson: Blueprint Protocol", type: "youtube", tags: ["Health", "Longevity"], site: "YOUTUBE.COM" },
  { title: "Latent Space: The AI Engineer Podcast", type: "spotify", tags: ["AI", "Research"], site: "OPEN.SPOTIFY.COM" },
  { title: "High-Protein Meal Prep: Healthy 5-Day Menu", type: "weblink", tags: ["Recipes", "Health"], site: "FEELINGFABULOUS.COM" },
  { title: "What is ChatGPT Doing... and Why Does It Work?", type: "weblink", tags: ["AI", "Explainer"], site: "STEPHENWOLFRAM.COM" },
  { title: "Machine Learning Street Talk", type: "spotify", tags: ["ML", "Philosophy"], site: "OPEN.SPOTIFY.COM" },
  { title: "Next.js Folder Structure Design Patterns", type: "weblink", tags: ["Dev", "Architecture"], site: "NEXTJS.ORG" },
  { title: "AI just officially took our jobs - Fireship", type: "youtube", tags: ["AI", "Developer Tools"], site: "YOUTUBE.COM" },
  { title: "Founder Mode - Paul Graham essay summary", type: "weblink", tags: ["Startup", "Leadership"], site: "PAULGRAHAM.COM" }
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fn = mode === 'login' ? api.auth.login : api.auth.register;
      const data = await fn(form);
      login({ accessToken: data.accessToken, refreshToken: data.refreshToken }, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-screen bg-[#07080a] text-zinc-300 font-sans select-none antialiased flex items-center justify-center overflow-hidden">
      
      {/* 1. Behind-the-scenes mock Knowledge cards grid (low opacity and blurred) */}
      <div className="absolute inset-0 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-8 opacity-25 filter blur-[0.5px] pointer-events-none select-none overflow-hidden">
        {MOCK_BG_CARDS.map((card, i) => (
          <div key={i} className="bg-[#101216] border border-white/[0.04] rounded-2xl p-5 flex flex-col justify-between h-44 shadow">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-600 flex items-center gap-1">
                {card.type === 'youtube' && <PlayCircle size={10} className="text-red-500" />}
                {card.type === 'spotify' && <Star size={10} className="text-emerald-500" />}
                {card.type === 'weblink' && <Globe size={10} className="text-blue-500" />}
                {card.site}
              </span>
            </div>
            <h4 className="text-xs font-bold text-zinc-400 mt-3 line-clamp-2 leading-relaxed">
              {card.title}
            </h4>
            <div className="flex gap-1.5 mt-auto">
              {card.tags.map((tag, ti) => (
                <span key={ti} className="text-[9px] font-bold px-2 py-0.5 rounded bg-zinc-900 text-zinc-500">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 2. Top-level backdrop overlay matching screenshot */}
      <div className="absolute inset-0 bg-[#07080a]/80 backdrop-blur-[3px] z-10" />

      {/* 3. Brand Logo (Top Left, z-index 30) */}
      <div className="absolute top-6 left-8 z-30 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#ff4f1a]">
          <BookOpen size={14} className="text-white" />
        </div>
        <span className="font-bold text-xs text-white tracking-wide">ContextLLM</span>
      </div>

      {/* 4. Login Container Form Card (z-index 20) */}
      <div className="w-full max-w-[440px] px-6 z-20">
        <div className="bg-[#101216]/90 border border-white/[0.08] backdrop-blur-xl rounded-[32px] p-8 md:p-10 shadow-2xl flex flex-col">
          {/* Card Title & Description */}
          <h2 className="text-2xl font-bold text-white text-center tracking-tight">
            {mode === 'login' ? 'Log in' : 'Create account'}
          </h2>
          <p className="text-xs text-zinc-500 text-center mt-2.5 mb-8 font-medium">
            Turn Your Knowledge Into Your Edge
          </p>

          {/* Social Sign-in row matching layout */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <a
              href={api.auth.googleUrl()}
              className="flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-full text-[11px] font-bold bg-[#181b21] border border-white/[0.04] hover:bg-zinc-800 hover:border-white/[0.08] text-white transition-all shadow-sm"
            >
              <svg width="13" height="13" viewBox="0 0 48 48" className="shrink-0">
                <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3L37.5 9.4C34.2 6.4 29.3 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5 44.5 36.3 44.5 25c0-1.7-.2-3.3-.9-4.9z" />
                <path fill="#FF3D00" d="M6.3 15.1l6.6 4.8C14.6 16.1 19 13 24 13c3.1 0 5.8 1.1 7.9 3L37.5 9.4C34.2 6.4 29.3 4.5 24 4.5c-7.7 0-14.3 4.4-17.7 10.6z" />
                <path fill="#4CAF50" d="M24 45.5c5.2 0 9.9-1.8 13.5-4.8l-6.2-5.2C29.4 37 26.8 38 24 38c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.7 41 16.4 45.5 24 45.5z" />
                <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.5l6.2 5.2C43 35.2 44.5 30.5 44.5 25c0-1.7-.2-3.3-.9-4.9z" />
              </svg>
              <span>Google</span>
            </a>
            
            <button
              onClick={() => alert("Apple authentication is currently unavailable.")}
              className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-full text-[11px] font-bold bg-[#181b21] border border-white/[0.04] hover:bg-zinc-800 hover:border-white/[0.08] text-white transition-all shadow-sm"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-white">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-.96.04-2.13.64-2.82 1.45-.6.69-1.12 1.83-.98 2.94 1.07.08 2.15-.52 2.81-1.33z" />
              </svg>
              <span>Apple</span>
            </button>
          </div>

          {/* OR separator */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-white/[0.04]" />
            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-white/[0.04]" />
          </div>

          {/* Form */}
          <form onSubmit={handle} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2">Display Name</label>
                <input
                  type="text"
                  required
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="Your name"
                  className="w-full px-4 py-3 rounded-xl text-xs outline-none bg-[#181b21] border border-white/[0.04] text-white placeholder-zinc-600 focus:border-[#7c6af7]/40 transition-all"
                />
              </div>
            )}
            
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-2">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Enter your email address..."
                className="w-full px-4 py-3 rounded-xl text-xs outline-none bg-[#181b21] border border-white/[0.04] text-white placeholder-zinc-600 focus:border-[#7c6af7]/40 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-10 rounded-xl text-xs outline-none bg-[#181b21] border border-white/[0.04] text-white placeholder-zinc-600 focus:border-[#7c6af7]/40 transition-all"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPw(!showPw)} 
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl text-xs font-semibold bg-red-950/20 border border-red-500/20 text-red-400 animate-shake">
                {error}
              </div>
            )}

            {/* Accent Continue button matching orange-red screenshot styling */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-full text-xs font-bold mt-4 bg-[#ff4f1a] hover:bg-[#ff6234] text-white shadow-lg shadow-[#ff4f1a]/10 hover:scale-[1.01] transition-all duration-150 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin text-white" />
              ) : (
                'Continue'
              )}
            </button>
          </form>

          {/* Toggle form mode footer link */}
          <p className="text-center text-xs text-zinc-400 mt-6 select-none">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button 
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} 
              className="font-bold text-[#ff4f1a] hover:text-[#ff6234] transition hover:underline ml-0.5"
            >
              {mode === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </p>

          {/* Bottom small T&C note */}
          <p className="text-center text-[10px] text-zinc-600 leading-normal mt-8 max-w-[280px] mx-auto select-none">
            By continuing, you acknowledge that you understand and agree to the <span className="hover:underline cursor-pointer">Terms & Conditions</span> and <span className="hover:underline cursor-pointer">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
}
