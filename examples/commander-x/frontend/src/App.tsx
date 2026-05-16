import React, { useState, useRef, useEffect } from 'react';
import { 
  Shield, 
  Terminal, 
  Activity, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  Zap, 
  ChevronRight,
  Upload,
  Copy,
  LayoutDashboard,
  Send,
  Paperclip,
  User,
  Bot,
  Play,
  XCircle,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'analysis' | 'answer' | 'action' | 'terminal_action';
  data?: any;
  timestamp: Date;
}

const AGENT_ICONS: Record<string, React.ReactNode> = {
  'Log Analyzer': <Search className="w-5 h-5" />,
  'Root Cause Agent': <AlertCircle className="w-5 h-5" />,
  'Severity Agent': <Activity className="w-5 h-5" />,
  'Fix Generator': <Zap className="w-5 h-5" />,
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Welcome to Autonomous Incident Commander. I can execute infrastructure tasks directly. Try 'ssh into aws' or 'login to mysql'.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [terminalHistory, setTerminalHistory] = useState<string[]>(['$ _']);
  const [currentContext, setCurrentContext] = useState<'local' | 'ssh' | 'mysql'>('local');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, analyzing]);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminalHistory]);

  const handleSendMessage = async (text: string = input) => {
    if (!text.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAnalyzing(true);

    try {
      const response = await axios.post('http://localhost:8000/chat', { message: text });
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.text || "Command executed successfully.",
        type: response.data.type,
        data: response.data,
        timestamp: new Date()
      };
      
      if (response.data.type === 'terminal_action') {
        setTerminalHistory(prev => [...prev, ...response.data.terminal_output]);
        setCurrentContext(response.data.context);
      }

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Chat failed', error);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-slate-200 font-sans selection:bg-primary/30 flex overflow-hidden">
      {/* Left Sidebar: Chat */}
      <div className="flex-1 flex flex-col border-r border-white/5">
        <nav className="border-b border-white/5 bg-surface/50 backdrop-blur-md h-16 flex items-center px-6 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white uppercase italic">Commander<span className="text-primary font-black">X</span></span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              currentContext === 'local' ? "bg-slate-500" : "bg-success"
            )} />
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
              {currentContext === 'local' ? 'Local' : currentContext === 'ssh' ? 'AWS SSH' : 'MySQL Live'}
            </span>
          </div>
        </nav>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {messages.map((msg) => (
            <motion.div 
              key={msg.id}
              initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "")}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg shrink-0 flex items-center justify-center border",
                msg.role === 'assistant' ? "bg-primary/10 border-primary/20 text-primary" : "bg-white/5 border-white/10 text-slate-400"
              )}>
                {msg.role === 'assistant' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              <div className={cn(
                "p-4 rounded-2xl max-w-[80%] text-sm leading-relaxed",
                msg.role === 'assistant' ? "bg-surface border border-white/5" : "bg-primary text-white"
              )}>
                {msg.content}
                
                {msg.type === 'terminal_action' && (
                  <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-success uppercase tracking-widest bg-success/10 px-2 py-1 rounded-md w-fit">
                    <CheckCircle2 className="w-3 h-3" /> Autonomous Action Success
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {analyzing && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-surface border border-white/5 p-3 rounded-2xl flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-1 h-1 bg-primary rounded-full animate-bounce" />
                  <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-background border-t border-white/5">
          <div className="relative group">
            <div className="absolute -top-10 left-0 flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {['ssh into aws', 'login to mysql', 'drop table users', 'exit'].map(tag => (
                <button 
                  key={tag}
                  onClick={() => handleSendMessage(tag)}
                  className="whitespace-nowrap text-[9px] font-black uppercase tracking-tighter px-3 py-1 rounded-md bg-white/5 border border-white/10 text-slate-500 hover:bg-primary/20 hover:text-primary transition-all"
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 bg-surface border border-white/10 p-2 rounded-xl focus-within:border-primary transition-all">
              <button className="p-2 text-slate-500 hover:text-white"><Paperclip className="w-5 h-5" /></button>
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask CommanderX to execute a task..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2"
              />
              <button onClick={() => handleSendMessage()} className="p-2 bg-primary text-white rounded-lg shadow-lg shadow-primary/20">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar: Terminal Output */}
      <div className="w-[450px] bg-black flex flex-col font-mono text-[11px] border-l border-white/10 shadow-2xl">
        <div className="h-10 bg-surface/50 border-b border-white/10 flex items-center px-4 justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Terminal className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Live Infrastructure Console</span>
          </div>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-danger/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-warning/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-success/50" />
          </div>
        </div>
        <div ref={terminalRef} className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar text-slate-300">
          {terminalHistory.map((line, i) => (
            <div key={i} className={cn(
              "leading-relaxed",
              line.startsWith('$') || line.includes('~') || line.includes('mysql>') ? "text-primary font-bold" : "text-slate-400",
              line.includes('DROP') || line.includes('DANGER') ? "text-danger" : ""
            )}>
              {line}
            </div>
          ))}
          <div className="flex items-center gap-2">
             <span className="text-primary font-bold animate-pulse">_</span>
          </div>
        </div>
        <div className="h-12 bg-white/5 border-t border-white/10 flex items-center px-4 gap-4 text-[9px] text-slate-500 font-bold tracking-widest overflow-hidden shrink-0">
          <div className="flex items-center gap-1"><Activity className="w-3 h-3" /> LATENCY: 42ms</div>
          <div className="flex items-center gap-1"><Database className="w-3 h-3" /> DB_STAT: CONNECTED</div>
          <div className="flex items-center gap-1 text-danger animate-pulse"><XCircle className="w-3 h-3" /> ROOT_ACCESS: ENABLED</div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default App;
