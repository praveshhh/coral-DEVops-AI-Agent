import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Shield, Terminal, Activity, AlertCircle, CheckCircle2, Search, Zap,
  Send, Paperclip, User, Bot, Database, XCircle, Server, GitBranch,
  Layers, ChevronRight, Wifi, Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ── Types ─────────────────────────────────────────────── */

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: string;
  data?: any;
  timestamp: Date;
}

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  category: 'coral' | 'infra' | 'db';
}

/* ── Constants ─────────────────────────────────────────── */

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'query coral context', icon: <Layers className="w-3 h-3" />, category: 'coral' },
  { label: 'check service health', icon: <Activity className="w-3 h-3" />, category: 'coral' },
  { label: 'check deployment risk', icon: <GitBranch className="w-3 h-3" />, category: 'coral' },
  { label: 'ssh into aws', icon: <Lock className="w-3 h-3" />, category: 'infra' },
  { label: 'login to mysql', icon: <Database className="w-3 h-3" />, category: 'db' },
  { label: 'show databases', icon: <Server className="w-3 h-3" />, category: 'db' },
  { label: 'show tables', icon: <Search className="w-3 h-3" />, category: 'db' },
  { label: 'exit', icon: <XCircle className="w-3 h-3" />, category: 'infra' },
];

const CATEGORY_COLORS: Record<string, string> = {
  coral: 'border-coral/30 text-coral hover:bg-coral/10',
  infra: 'border-cyan/30 text-cyan hover:bg-cyan/10',
  db: 'border-success/30 text-success hover:bg-success/10',
};

/* ── Helpers ───────────────────────────────────────────── */

function classifyTerminalLine(line: string): string {
  if (line.startsWith('$') || line.includes('~$')) return 'text-cyan font-bold';
  if (line.startsWith('mysql>')) return 'text-success font-bold';
  if (line.includes('coral sql') || line.includes('coral source')) return 'text-coral font-bold';
  if (line.startsWith('—')) return 'text-coral/70 italic';
  if (line.startsWith('+') && line.endsWith('+')) return 'text-dim';
  if (line.startsWith('|')) return 'text-slate-300';
  if (line.includes('DROP') || line.includes('DANGER')) return 'text-danger font-bold';
  if (line.includes('✓')) return 'text-success';
  if (line.includes('═')) return 'text-coral/60 font-bold';
  if (line.startsWith('  "')) return 'text-warning/80';
  return 'text-slate-400';
}

/* ── App ───────────────────────────────────────────────── */

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1', role: 'assistant',
      content: "Welcome to **CommanderX** — your autonomous DevOps agent powered by **Coral**.\n\nI can execute infrastructure tasks, run cross-source SQL queries via Coral, and manage your cloud resources. Try the quick actions below or type a command.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [activeRequests, setActiveRequests] = useState(0);
  const isLoading = activeRequests > 0;
  const [terminalHistory, setTerminalHistory] = useState<string[]>([
    '$ coral source list',
    '— 4 sources connected:',
    '  ✓ datadog      (service_health, monitors)',
    '  ✓ github       (pulls, deployments)',
    '  ✓ pagerduty    (incidents, services)',
    '  ✓ stripe       (customers, revenue)',
    '',
    '$ _',
  ]);
  const [currentContext, setCurrentContext] = useState<'local' | 'ssh' | 'mysql'>('local');
  const [coralSources, setCoralSources] = useState<string[]>([]);
  const [sessionReady, setSessionReady] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionId = useRef<string>('');

  // Obtain a server-issued session token on mount
  useEffect(() => {
    const apiKey = import.meta.env.VITE_CORAL_API_KEY || '';
    axios.post('http://localhost:8000/session', {}, {
      headers: {
        'X-API-Key': apiKey
      }
    }).then(({ data }) => {
      sessionId.current = data.session_id;
      setSessionReady(true);
    }).catch((err) => {
      console.error("Failed to initialize session with backend:", err);
      setSessionReady(false);
      setMessages(prev => [...prev, {
        id: 'session-fail',
        role: 'assistant',
        content: '⚠️ Connection to backend failed. Ensure the server is running on port 8000.',
        timestamp: new Date(),
      }]);
    });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight, behavior: 'smooth' });
  }, [terminalHistory]);

  const VALID_CONTEXTS = new Set(['local', 'ssh', 'mysql']);

  const handleSend = useCallback(async (text: string = input) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading || !sessionReady) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(), role: 'user',
      content: trimmed, timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg].slice(-100));
    setInput('');
    setActiveRequests(prev => prev + 1);

    try {
      const { data } = await axios.post('http://localhost:8000/chat', {
        message: trimmed,
        session_id: sessionId.current,
      });

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: data.text || 'Command executed.',
        type: data.type, data, timestamp: new Date(),
      };

      if (data.type === 'terminal_action' && Array.isArray(data.terminal_output)) {
        setTerminalHistory(prev => [...prev, ...data.terminal_output].slice(-500));
        if (typeof data.context === 'string' && VALID_CONTEXTS.has(data.context)) {
          setCurrentContext(data.context as 'local' | 'ssh' | 'mysql');
        }
      }

      if (Array.isArray(data.coral_sources) && data.coral_sources.length) {
        setCoralSources(data.coral_sources);
      }

      setMessages(prev => [...prev, botMsg].slice(-100));
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: '⚠️ Connection to backend failed. Ensure the server is running on port 8000.',
        timestamp: new Date(),
      }].slice(-100));
    } finally {
      setActiveRequests(prev => Math.max(0, prev - 1));
    }
  }, [input, isLoading, sessionReady]);

  /* ── Render Markdown-lite ─────────────────────────────── */

  const renderContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g).map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={j} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`'))
          return <code key={j} className="px-1.5 py-0.5 rounded bg-coral/10 text-coral font-mono text-[11px]">{part.slice(1, -1)}</code>;
        return <span key={j}>{part}</span>;
      });
      return <div key={i} className={i > 0 ? 'mt-1' : ''}>{parts}</div>;
    });
  };

  /* ── Context Badge ────────────────────────────────────── */

  const contextConfig = {
    local: { label: 'Local', color: 'bg-muted', dot: 'bg-slate-400' },
    ssh:   { label: 'AWS SSH', color: 'bg-cyan/20 text-cyan', dot: 'bg-cyan animate-pulse' },
    mysql: { label: 'MySQL Live', color: 'bg-success/20 text-success', dot: 'bg-success animate-pulse' },
  }[currentContext];

  return (
    <div className="h-screen flex bg-background text-text font-sans overflow-hidden">

      {/* ═══ LEFT: Chat Panel ═══ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Navbar */}
        <nav className="h-14 border-b border-white/5 bg-surface/60 backdrop-blur-xl flex items-center px-5 gap-3 shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-coral to-primary-dim rounded-lg flex items-center justify-center shadow-lg shadow-coral/20">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">
            Commander<span className="text-coral">X</span>
          </span>
          <span className="text-[9px] font-mono text-muted ml-1 mt-1">v1.0</span>

          <div className="ml-auto flex items-center gap-3">
            {coralSources.length > 0 && (
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-coral/70">
                <Layers className="w-3 h-3" />
                {coralSources.join(' · ')}
              </div>
            )}
            <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest", contextConfig.color)}>
              <div className={cn("w-1.5 h-1.5 rounded-full", contextConfig.dot)} />
              {contextConfig.label}
            </div>
          </div>
        </nav>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
          <AnimatePresence initial={false}>
            {messages.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={cn("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "")}
              >
                <div className={cn(
                  "w-7 h-7 rounded-lg shrink-0 flex items-center justify-center border",
                  msg.role === 'assistant'
                    ? "bg-coral/10 border-coral/20 text-coral"
                    : "bg-white/5 border-white/10 text-slate-400"
                )}>
                  {msg.role === 'assistant' ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                </div>
                <div className={cn(
                  "py-3 px-4 rounded-2xl max-w-[80%] text-[13px] leading-relaxed",
                  msg.role === 'assistant'
                    ? "bg-surface border border-white/5"
                    : "bg-gradient-to-r from-coral to-primary-dim text-white"
                )}>
                  {renderContent(msg.content)}
                  {msg.type === 'terminal_action' && (
                    <div className="mt-2.5 flex items-center gap-1.5 text-[9px] font-black text-success uppercase tracking-widest bg-success/10 px-2 py-1 rounded-md w-fit">
                      <CheckCircle2 className="w-3 h-3" /> Executed
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-coral/10 border border-coral/20 text-coral flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div className="bg-surface border border-white/5 px-4 py-3 rounded-2xl flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-coral rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-coral rounded-full animate-bounce [animation-delay:0.15s]" />
                  <span className="w-1.5 h-1.5 bg-coral rounded-full animate-bounce [animation-delay:0.3s]" />
                </div>
                <span className="text-[10px] text-muted font-mono">processing...</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions + Input */}
        <div className="px-5 pb-4 pt-2 bg-background border-t border-white/5 shrink-0">
          <div className="flex gap-1.5 mb-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.label}
                onClick={() => handleSend(action.label)}
                disabled={isLoading || !sessionReady}
                className={cn(
                  "whitespace-nowrap text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border flex items-center gap-1 transition-all disabled:opacity-30",
                  CATEGORY_COLORS[action.category]
                )}
              >
                {action.icon} {action.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-surface border border-white/10 px-3 py-2 rounded-xl focus-within:border-coral/50 transition-colors">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={sessionReady ? 'Ask CommanderX to execute a task...' : 'Initializing session...'}
              disabled={isLoading || !sessionReady}
              className="flex-1 bg-transparent border-none text-sm py-1 placeholder:text-muted disabled:opacity-50"
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim() || !sessionReady}
              className="p-2 bg-gradient-to-r from-coral to-primary-dim text-white rounded-lg shadow-lg shadow-coral/20 disabled:opacity-30 transition-opacity"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT: Terminal Console ═══ */}
      <div className="w-[460px] bg-[#040810] flex flex-col font-mono text-[11px] border-l border-white/5 shrink-0">
        {/* Terminal Header */}
        <div className="h-10 bg-surface/40 border-b border-white/5 flex items-center px-4 justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Terminal className="w-3 h-3 text-coral/60" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Live Infrastructure Console</span>
          </div>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-danger/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-warning/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-success/50" />
          </div>
        </div>

        {/* Terminal Body */}
        <div
          ref={terminalRef}
          className="flex-1 overflow-y-auto p-4 space-y-0.5 text-slate-300"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}
        >
          {terminalHistory.map((line, i) => (
            <div key={i} className={cn("leading-[1.6]", classifyTerminalLine(line))}>
              {line || '\u00A0'}
            </div>
          ))}
          <div className="flex items-center gap-1 mt-1">
            <span className="text-coral font-bold animate-pulse">▋</span>
          </div>
        </div>

        {/* Terminal Status Bar */}
        <div className="h-9 bg-surface/30 border-t border-white/5 flex items-center px-4 gap-5 text-[9px] text-muted font-bold tracking-widest overflow-hidden shrink-0">
          <div className="flex items-center gap-1">
            <Wifi className="w-3 h-3" />
            <span>LATENCY: 42ms</span>
          </div>
          <div className="flex items-center gap-1">
            <Database className="w-3 h-3" />
            <span className={currentContext === 'mysql' ? 'text-success' : ''}>
              DB: {currentContext === 'mysql' ? 'CONNECTED' : 'IDLE'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Layers className="w-3 h-3 text-coral" />
            <span className="text-coral">CORAL: ACTIVE</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
