import { useState, useEffect, useRef } from "react";
import { ArrowRight, FileText, Mic, Newspaper, MessageSquare, ShieldCheck, Network, Sparkles, CheckCircle2 } from "lucide-react";

const Youtube = ({ size = 24, color = "currentColor", ...props }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    stroke={color}
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
);

/* ───────────────────────────────────────────────────────────────────────────
   NOTE for integration into your app:
   This artifact preview stands alone (no react-router / AuthContext), so
   <a> tags replace <Link> and a local `loggedIn` flag replaces useAuth().
   When you drop this into your codebase, swap the two back:
     import { Link } from "react-router-dom";
     import { useAuth } from "../contexts/AuthContext";
     const { user } = useAuth();
     ... <Link to={user ? "/dashboard" : "/login"}> ...
─────────────────────────────────────────────────────────────────────────── */

/* ─ Palette ──────────────────────────────────────────────────────────────── */
const C = {
  ink: "#12141C",
  ink2: "#1A1E2C",
  paper: "#F2EFE7",
  paper2: "#E8E3D6",
  line: "rgba(18,20,28,0.12)",
  lineD: "rgba(242,239,231,0.12)",
  indigo: "#3D4FE0",
  amber: "#E8A429",
  coral: "#E85A3F",
  teal: "#178272",
  violet: "#7C5CE0",
  sage: "#4C8F63",
};

/* ─ Content ──────────────────────────────────────────────────────────────── */
const STEPS = [
  { n: "01", title: "Save a source", desc: "Drop in a YouTube link, podcast, PDF or article — anything you'd otherwise lose in a tab.", color: C.indigo, Icon: Newspaper },
  { n: "02", title: "ContextLLM reads it", desc: "Every sentence is indexed and cross-referenced against everything else you've saved.", color: C.violet, Icon: Sparkles },
  { n: "03", title: "Ask in plain words", desc: "No search operators. Just ask the way you'd ask a well-read friend.", color: C.teal, Icon: MessageSquare },
  { n: "04", title: "Get a cited answer", desc: "Every claim links straight back to the minute, page or paragraph it came from.", color: C.coral, Icon: CheckCircle2 },
];

const FEATURES = [
  { code: "F—01", Icon: ShieldCheck, title: "Answers you can check", desc: "Every line ContextLLM writes traces back to a source you actually saved — click it, and you land on the exact minute or paragraph.", color: C.indigo },
  { code: "F—02", Icon: Youtube, title: "Reads everything", desc: "YouTube, podcasts, PDFs, newsletters, plain links — transcribed, parsed and indexed within seconds of adding.", color: C.coral },
  { code: "F—03", Icon: MessageSquare, title: "Talks like a person", desc: "Ask follow-up questions the way you would in conversation. No boolean search, no keyword guessing.", color: C.teal },
  { code: "F—04", Icon: Sparkles, title: "Finds it fast", desc: "Semantic ContextLLM across hundreds of saved sources, back in the time it takes to finish typing.", color: C.amber },
  { code: "F—05", Icon: Network, title: "Connects the dots", desc: "Ideas across unrelated sources get linked automatically, surfacing patterns you'd never cross-reference by hand.", color: C.violet },
  { code: "F—06", Icon: ShieldCheck, title: "Stays yours", desc: "Nothing you save trains a model that isn't yours. Private by default, exportable any time.", color: C.sage },
];

const SOURCES = [
  { title: "Huberman Lab — sleep & alcohol", kind: "Podcast", img: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?auto=format&fit=crop&w=480&q=80", color: C.violet, q: "How does a drink before bed affect sleep?", a: "Alcohol shortens the time it takes to fall asleep but fragments the second half of the night — REM density drops and awakenings rise, which cancels out the sedative benefit.", src: "Huberman Lab, 41:12" },
  { title: "Tiago Forte — the PARA method", kind: "YouTube", img: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=480&q=80", color: C.coral, q: "What is the PARA method, briefly?", a: "PARA sorts everything you save into four buckets — Projects, Areas, Resources, Archive — organised by how soon you'll act on it rather than by topic.", src: "Tiago Forte, 6:40" },
  { title: "Karpathy — state of GPT", kind: "YouTube", img: "https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=480&q=80", color: C.indigo, q: "What are the stages of GPT training?", a: "Four stages in sequence: pre-training on raw text, supervised fine-tuning on curated examples, reward modelling, then reinforcement learning from that reward model.", src: "Karpathy, Microsoft Build" },
  { title: "Paul Graham — founder mode", kind: "Essay", img: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=480&q=80", color: C.amber, q: "What does founder mode actually mean?", a: "Founders stay close to operational detail rather than fully delegating — running skip-level conversations and pushing back on the standard managerial playbook.", src: "paulgraham.com" },
];

const TESTIMONIALS = [
  { name: "Priya Sharma", role: "Product manager, reads 40+ articles a week", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80", text: "I stopped screenshotting things I'd never find again. Now I just ask." },
  { name: "James Okoro", role: "PhD researcher, 200+ papers in one library", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80", text: "It cross-references papers I'd forgotten I'd even read." },
  { name: "Sofia Marchetti", role: "Video essayist, researches every episode", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=160&q=80", text: "Six hours of research turned into forty-five minutes." },
  { name: "Daniel Yuen", role: "CTO, replaced four separate tools", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=160&q=80", text: "Every citation checks out. That's the whole pitch, honestly." },
];

/* ─ Hooks ────────────────────────────────────────────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => e.isIntersecting && setInView(true), { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

/* ─ Small building blocks ────────────────────────────────────────────────── */
function Mark({ children, color = C.amber, dark }) {
  const [ref, inView] = useInView(0.4);
  return (
    <span ref={ref} style={{ position: "relative", display: "inline-block", whiteSpace: "nowrap" }}>
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
      <span
        aria-hidden="true"
        style={{
          position: "absolute", left: "-3%", right: "-3%", bottom: "6%", height: "34%",
          background: color, opacity: dark ? 0.85 : 0.55, transform: "rotate(-1deg)",
          zIndex: 0, borderRadius: "2px",
          clipPath: inView ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)",
          transition: "clip-path 0.7s cubic-bezier(0.65,0,0.35,1) 0.15s",
        }}
      />
    </span>
  );
}

function Eyebrow({ children, color, dark }) {
  return (
    <p style={{
      fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 500,
      letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "18px",
      color: color || (dark ? "rgba(242,239,231,0.55)" : "rgba(18,20,28,0.5)"),
    }}>
      {children}
    </p>
  );
}

function Reveal({ children, delay = 0, y = 22 }) {
  const [ref, inView] = useInView(0.1);
  return (
    <div ref={ref} style={{
      transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : `translateY(${y}px)`,
    }}>
      {children}
    </div>
  );
}

/* ─ Main ─────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const loggedIn = false; // stand-in for useAuth().user in this preview
  const ctaHref = loggedIn ? "/dashboard" : "/login";

  const [selIdx, setSelIdx] = useState(0);
  const [typeTxt, setTypeTxt] = useState("");
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    setThinking(true); setTypeTxt("");
    const start = setTimeout(() => {
      setThinking(false);
      const full = SOURCES[selIdx].a;
      let i = 0;
      const iv = setInterval(() => {
        i++; setTypeTxt(full.slice(0, i));
        if (i >= full.length) clearInterval(iv);
      }, 10);
      return () => clearInterval(iv);
    }, 420);
    return () => clearTimeout(start);
  }, [selIdx]);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", width: "100%", overflowX: "hidden", color: C.ink, background: C.paper }}>
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap");
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        .rc-serif { font-family: 'Fraunces', serif; }
        .rc-mono { font-family: 'IBM Plex Mono', monospace; }
        .rc-btn { transition: transform .18s cubic-bezier(.16,1,.3,1), box-shadow .18s ease, background .18s ease; }
        .rc-btn:hover { transform: translateY(-2px); }
        .rc-btn:active { transform: translateY(0px) scale(0.98); }
        .rc-card { transition: transform .25s cubic-bezier(.16,1,.3,1), border-color .25s ease, box-shadow .25s ease; }
        .rc-card:hover { transform: translateY(-4px); }
        .rc-chip { transition: transform .3s ease; }
        .rc-nav-link { position: relative; text-decoration: none; }
        .rc-nav-link::after { content: ""; position: absolute; left: 0; bottom: -4px; width: 0; height: 1px; background: currentColor; transition: width .25s ease; }
        .rc-nav-link:hover::after { width: 100%; }
        @keyframes rc-float { 0%,100% { transform: translateY(0) rotate(var(--r,0deg)); } 50% { transform: translateY(-8px) rotate(var(--r,0deg)); } }
        .rc-float { animation: rc-float 5s ease-in-out infinite; }
        @keyframes rc-blink { 0%,50% { opacity: 1; } 51%,100% { opacity: 0; } }
        .rc-caret { animation: rc-blink 1s step-end infinite; }
        @keyframes rc-dot { 0%,80%,100% { transform: scale(0.7); opacity: .4; } 40% { transform: scale(1); opacity: 1; } }
        .rc-dot { animation: rc-dot 1.2s ease-in-out infinite; }
        ::selection { background: ${C.amber}; color: ${C.ink}; }
        @media (prefers-reduced-motion: reduce) {
          .rc-float, .rc-caret, .rc-dot { animation: none !important; }
          * { transition-duration: 0.01ms !important; }
        }
        a:focus-visible, button:focus-visible { outline: 2px solid ${C.indigo}; outline-offset: 2px; border-radius: 4px; }

        /* Responsive styling */
        .rc-hero-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 56px;
          align-items: center;
        }
        .rc-demo-grid {
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 24px;
        }
        .rc-source-catalog-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        @media (max-width: 900px) {
          .rc-hero-grid {
            grid-template-columns: 1fr;
            gap: 40px;
            text-align: center;
          }
          .rc-hero-img-container {
            display: none !important;
          }
          .rc-hero-text-container {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .rc-hero-text-container p {
            max-width: 100% !important;
            margin-left: auto;
            margin-right: auto;
          }
          .rc-hero-buttons {
            justify-content: center !important;
          }
          .rc-demo-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
          .rc-source-catalog-container {
            flex-direction: row;
            overflow-x: auto;
            padding-bottom: 12px;
            gap: 12px;
            -webkit-overflow-scrolling: touch;
            border-bottom: 1px solid ${C.line};
          }
          .rc-source-catalog-container button {
            flex-shrink: 0;
            width: 240px;
          }
        }
        @media (max-width: 768px) {
          .rc-nav-links {
            display: none !important;
          }
          .rc-footer-mono {
            flex-direction: column !important;
            text-align: center !important;
            gap: 16px !important;
          }
          .rc-footer-links {
            justify-content: center !important;
          }
        }
        @media (max-width: 600px) {
          header nav {
            padding: 16px 20px !important;
          }
          section, footer, .rc-hero-grid, .rc-demo-grid {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }
          .rc-hero-grid {
            padding-top: 48px !important;
            padding-bottom: 48px !important;
          }
        }
      `}</style>

      {/* ═══ NAV ═══ */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(242,239,231,0.88)", backdropFilter: "blur(14px)", borderBottom: `1px solid ${C.line}` }}>
        <nav style={{ maxWidth: "1160px", margin: "0 auto", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="#top" className="rc-serif" style={{ fontSize: "20px", fontWeight: 600, color: C.ink, textDecoration: "none", letterSpacing: "-0.01em" }}>ContextLLM</a>
          <div className="rc-mono rc-nav-links" style={{ display: "flex", alignItems: "center", gap: "28px", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            <a href="#features" className="rc-nav-link" style={{ color: "rgba(18,20,28,0.65)" }}>Features</a>
            <a href="#how" className="rc-nav-link" style={{ color: "rgba(18,20,28,0.65)", display: "none" }}>How it works</a>
            <a href="#demo" className="rc-nav-link" style={{ color: "rgba(18,20,28,0.65)" }}>Demo</a>
            <a href="#stories" className="rc-nav-link" style={{ color: "rgba(18,20,28,0.65)", display: "none" }}>Stories</a>
          </div>
          <a href={ctaHref} className="rc-btn" style={{
            padding: "9px 20px", borderRadius: "999px", background: C.ink, color: C.paper,
            fontSize: "12px", fontWeight: 600, textDecoration: "none", letterSpacing: "0.02em",
          }}>Get started</a>
        </nav>
      </header>

      {/* ═══ S1 · HERO (ink) ═══ */}
      <section id="top" style={{ background: C.ink, color: C.paper, position: "relative", overflow: "hidden" }}>
        <div className="rc-hero-grid" style={{ maxWidth: "1160px", margin: "0 auto", padding: "88px 32px 96px" }}>
          <div className="rc-hero-text-container">
            <Reveal>
              <Eyebrow color="rgba(232,164,41,0.85)">Grounded knowledge, not guesses</Eyebrow>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="rc-serif" style={{ fontSize: "clamp(38px,5vw,58px)", lineHeight: 1.05, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: "24px" }}>
                Everything you've read.<br />
                One mind that <Mark color={C.amber} dark>remembers it</Mark>.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p style={{ fontSize: "16px", lineHeight: 1.7, color: "rgba(242,239,231,0.6)", maxWidth: "440px", marginBottom: "36px" }}>
                Save the videos, podcasts and papers you actually read. Ask questions in plain
                language. Get answers with a citation attached to every claim — not a guess
                dressed up as one.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="rc-hero-buttons" style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
                <a href={ctaHref} className="rc-btn" style={{
                  display: "inline-flex", alignItems: "center", gap: "8px", padding: "13px 26px",
                  borderRadius: "999px", background: C.amber, color: C.ink, fontSize: "13px",
                  fontWeight: 600, textDecoration: "none",
                }}>Start for free <ArrowRight size={15} /></a>
                <a href="#how" style={{ fontSize: "13px", fontWeight: 500, color: "rgba(242,239,231,0.65)", textDecoration: "none", borderBottom: `1px solid rgba(242,239,231,0.3)`, paddingBottom: "2px" }}>
                  See how it works
                </a>
              </div>
            </Reveal>
          </div>

          {/* Right: real photo + floating citation chips */}
          <Reveal delay={200} y={16}>
            <div className="rc-hero-img-container" style={{ position: "relative", maxWidth: "420px", margin: "0 auto" }}>
              <div style={{ borderRadius: "18px", overflow: "hidden", border: `1px solid rgba(242,239,231,0.14)`, boxShadow: "0 40px 90px rgba(0,0,0,0.45)" }}>
                <img
                  src="https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=800&q=80"
                  alt="Open notebook and laptop with research notes"
                  style={{ width: "100%", display: "block", aspectRatio: "4/5", objectFit: "cover" }}
                />
              </div>
              <div className="rc-float" style={{ "--r": "-2deg", position: "absolute", top: "-14px", left: "-22px", background: C.paper, color: C.ink, borderRadius: "10px", padding: "8px 12px", boxShadow: "0 12px 24px rgba(0,0,0,0.3)" }}>
                <span className="rc-mono" style={{ fontSize: "11px", fontWeight: 500 }}>[1] Huberman Lab</span>
              </div>
              <div className="rc-float" style={{ "--r": "1.5deg", animationDelay: "1.1s", position: "absolute", bottom: "40px", right: "-26px", background: C.indigo, color: "#EDEEFC", borderRadius: "10px", padding: "8px 12px", boxShadow: "0 12px 24px rgba(0,0,0,0.3)" }}>
                <span className="rc-mono" style={{ fontSize: "11px", fontWeight: 500 }}>[2] Karpathy — GPT</span>
              </div>
              <div className="rc-float" style={{ "--r": "-1deg", animationDelay: "2.2s", position: "absolute", bottom: "-16px", left: "18px", background: C.teal, color: "#E4F4EF", borderRadius: "10px", padding: "8px 12px", boxShadow: "0 12px 24px rgba(0,0,0,0.3)" }}>
                <span className="rc-mono" style={{ fontSize: "11px", fontWeight: 500 }}>[3] PARA Method</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ S2 · HOW IT WORKS (paper) ═══ */}
      <section id="how" style={{ background: C.paper, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "96px 32px" }}>
          <Reveal>
            <Eyebrow color={C.indigo}>How it works</Eyebrow>
          </Reveal>
          <Reveal delay={60}>
            <h2 className="rc-serif" style={{ fontSize: "clamp(28px,3.4vw,40px)", fontWeight: 600, letterSpacing: "-0.01em", maxWidth: "620px", marginBottom: "56px" }}>
              Four steps, in order — the same order every source takes.
            </h2>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "18px" }}>
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div className="rc-card" style={{
                  background: "#fff", border: `1px solid ${C.line}`, borderRadius: "14px",
                  padding: "26px 22px", height: "100%", position: "relative",
                }}>
                  <div style={{ position: "absolute", top: "18px", right: "18px", width: "9px", height: "9px", borderRadius: "50%", background: C.paper2, border: `1px solid ${C.line}` }} />
                  <span className="rc-mono" style={{ fontSize: "12px", color: s.color, fontWeight: 500, letterSpacing: "0.05em" }}>{s.n}</span>
                  <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: s.color + "1A", display: "flex", alignItems: "center", justifyContent: "center", margin: "16px 0 18px" }}>
                    <s.Icon size={18} color={s.color} />
                  </div>
                  <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "8px" }}>{s.title}</h3>
                  <p style={{ fontSize: "13px", lineHeight: 1.6, color: "rgba(18,20,28,0.58)" }}>{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ S3 · FEATURES (ink) ═══ */}
      <section id="features" style={{ background: C.ink, color: C.paper }}>
        <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "96px 32px" }}>
          <Reveal>
            <Eyebrow color="rgba(232,164,41,0.85)">What you get</Eyebrow>
          </Reveal>
          <Reveal delay={60}>
            <h2 className="rc-serif" style={{ fontSize: "clamp(28px,3.4vw,40px)", fontWeight: 600, letterSpacing: "-0.01em", maxWidth: "640px", marginBottom: "56px" }}>
              Built so every answer <Mark color={C.teal} dark>traces back</Mark> to something real.
            </h2>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1px", background: C.lineD, border: `1px solid ${C.lineD}`, borderRadius: "16px", overflow: "hidden" }}>
            {FEATURES.map((f, i) => (
              <div key={f.code} className="rc-card" style={{ background: C.ink2, padding: "30px 26px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: f.color + "22", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <f.Icon size={19} color={f.color} />
                  </div>
                  <span className="rc-mono" style={{ fontSize: "11px", color: "rgba(242,239,231,0.35)" }}>{f.code}</span>
                </div>
                <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "9px" }}>{f.title}</h3>
                <p style={{ fontSize: "13px", lineHeight: 1.65, color: "rgba(242,239,231,0.52)" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ S4 · DEMO (paper) ═══ */}
      <section id="demo" style={{ background: C.paper, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "96px 32px" }}>
          <Reveal>
            <Eyebrow color={C.coral}>See it work</Eyebrow>
          </Reveal>
          <Reveal delay={60}>
            <h2 className="rc-serif" style={{ fontSize: "clamp(28px,3.4vw,40px)", fontWeight: 600, letterSpacing: "-0.01em", maxWidth: "640px", marginBottom: "48px" }}>
              Pick a source. Ask it something. Watch the footnote land.
            </h2>
          </Reveal>

          <div className="rc-demo-grid">
            {/* Source catalog list */}
            <Reveal delay={100}>
              <div>
                <p className="rc-mono" style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(18,20,28,0.4)", marginBottom: "10px" }}>Your sources</p>
                <div className="rc-source-catalog-container">
                  {SOURCES.map((s, i) => {
                    const active = i === selIdx;
                    return (
                      <button key={s.title} onClick={() => setSelIdx(i)} style={{
                        display: "flex", alignItems: "center", gap: "10px", padding: "10px",
                        borderRadius: "10px", textAlign: "left", cursor: "pointer",
                        background: active ? "#fff" : "transparent",
                        border: `1px solid ${active ? s.color : "transparent"}`,
                        transition: "all .2s ease",
                      }}>
                        <img src={s.img} alt={s.title} style={{ width: "34px", height: "34px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</div>
                          <div className="rc-mono" style={{ fontSize: "10px", color: s.color, marginTop: "2px" }}>{s.kind}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Reveal>

            {/* Answer margin card */}
            <Reveal delay={160}>
              <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: "16px", padding: "28px", minHeight: "300px", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "20px" }}>
                  <div style={{ background: C.paper2, borderRadius: "12px 12px 2px 12px", padding: "11px 16px", maxWidth: "340px" }}>
                    <p style={{ fontSize: "13px", margin: 0 }}>{SOURCES[selIdx].q}</p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "12px", flex: 1 }}>
                  <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: SOURCES[selIdx].color + "22", display: "flex", alignItems: "center", justifycontent: "center", flexShrink: 0, marginTop: "2px" }}>
                    <Sparkles size={13} color={SOURCES[selIdx].color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    {thinking ? (
                      <div style={{ display: "flex", gap: "5px", padding: "8px 0" }}>
                        {[0, 1, 2].map(i => (
                          <span key={i} className="rc-dot" style={{ width: "6px", height: "6px", borderRadius: "50%", background: SOURCES[selIdx].color, animationDelay: `${i * 0.15}s`, display: "inline-block" }} />
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: "14px", lineHeight: 1.75, margin: 0 }}>
                        {typeTxt}<span className="rc-caret" style={{ display: "inline-block", width: "2px", height: "14px", background: C.ink, marginLeft: "2px", verticalAlign: "middle" }} />
                      </p>
                    )}
                  </div>
                </div>
                {!thinking && typeTxt && (
                  <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="rc-mono" style={{ fontSize: "10px", color: "rgba(18,20,28,0.4)" }}>Sourced from</span>
                    <span className="rc-mono" style={{ fontSize: "11px", fontWeight: 500, padding: "3px 10px", borderRadius: "999px", background: SOURCES[selIdx].color + "1A", color: SOURCES[selIdx].color }}>
                      {SOURCES[selIdx].src}
                    </span>
                  </div>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══ S5 · TESTIMONIALS (ink) ═══ */}
      <section id="stories" style={{ background: C.ink, color: C.paper }}>
        <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "96px 32px" }}>
          <Reveal>
            <Eyebrow color="rgba(232,164,41,0.85)">Who's using it</Eyebrow>
          </Reveal>
          <Reveal delay={60}>
            <h2 className="rc-serif" style={{ fontSize: "clamp(28px,3.4vw,40px)", fontWeight: 600, letterSpacing: "-0.01em", marginBottom: "56px" }}>
              Notes from people who read for a living.
            </h2>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 80}>
                <div className="rc-card" style={{ background: C.ink2, border: `1px solid ${C.lineD}`, borderRadius: "14px", padding: "24px" }}>
                  <p className="rc-serif" style={{ fontStyle: "italic", fontSize: "16px", lineHeight: 1.55, marginBottom: "22px", color: "rgba(242,239,231,0.88)" }}>
                    "{t.text}"
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <img src={t.avatar} alt={t.name} style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }} />
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600 }}>{t.name}</div>
                      <div style={{ fontSize: "11px", color: "rgba(242,239,231,0.42)", marginTop: "1px" }}>{t.role}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ S6 · CTA + FOOTER (paper) ═══ */}
      <section style={{ background: C.paper }}>
        <div style={{ maxWidth: "760px", margin: "0 auto", padding: "112px 32px 64px", textAlign: "center" }}>
          <Reveal>
            <Eyebrow color={C.indigo}>Get started</Eyebrow>
          </Reveal>
          <Reveal delay={60}>
            <h2 className="rc-serif" style={{ fontSize: "clamp(32px,4.4vw,52px)", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.08, marginBottom: "22px" }}>
              Stop re-reading things<br />you already <Mark color={C.amber}>read once</Mark>.
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p style={{ fontSize: "15px", color: "rgba(18,20,28,0.6)", lineHeight: 1.7, maxWidth: "440px", margin: "0 auto 36px" }}>
              Free to start. No card required. Bring your first five sources and ask
              ContextLLM something only they would know.
            </p>
          </Reveal>
          <Reveal delay={180}>
            <a href={ctaHref} className="rc-btn" style={{
              display: "inline-flex", alignItems: "center", gap: "8px", padding: "14px 30px",
              borderRadius: "999px", background: C.ink, color: C.paper, fontSize: "13px",
              fontWeight: 600, textDecoration: "none",
            }}>Start building for free <ArrowRight size={15} /></a>
          </Reveal>
        </div>

        <div style={{ borderTop: `1px solid ${C.line}` }}>
          <div className="rc-mono rc-footer-mono" style={{
            maxWidth: "1160px", margin: "0 auto", padding: "26px 32px", display: "flex",
            flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "14px",
            fontSize: "11px", color: "rgba(18,20,28,0.42)", letterSpacing: "0.02em",
          }}>
            <span>ContextLLM — a second brain, footnoted</span>
            <span>© 2026, all sources cited</span>
            <div className="rc-footer-links" style={{ display: "flex", gap: "18px" }}>
              <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Privacy</a>
              <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Terms</a>
              <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Contact</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}