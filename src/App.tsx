import { useState, useEffect, useRef } from 'react';
import { useChat } from './hooks/useChat';
import { Send, Shield, Check, CheckCheck, Power, ChevronLeft } from 'lucide-react';

export default function App() {
  const [activePass, setActivePass] = useState(() => localStorage.getItem('chat_p_pass') || '');
  const [passInput, setPassInput] = useState('');
  const [inputText, setInputText] = useState('');
  
  const { isOnline, messages, sendMessage, peerHero, killChat } = useChat(activePass);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  if (!activePass) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#08080a] p-6 font-['Open_Sans'] relative overflow-hidden">
        {/* Google Fonts Import */}
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&display=swap');`}</style>
        
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#1a1a2e_0%,#08080a_100%)] opacity-50" />
        <div className="w-full max-w-sm relative z-10">
          <div className="bg-[#121216]/80 backdrop-blur-2xl border border-white/5 p-10 rounded-[2.5rem] shadow-2xl text-center">
            <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-white/10 shadow-inner">
              <Shield className="text-white/40" size={36} strokeWidth={1} />
            </div>
            <h1 className="text-4xl font-extrabold text-white mb-3 tracking-tight">Tunnel</h1>
            <p className="text-white/40 text-sm mb-10 font-medium">Join an encrypted session</p>
            <div className="space-y-4">
              <input 
                type="password" 
                placeholder="Enter room key"
                className="w-full p-5 rounded-2xl bg-[#161a21] text-white border border-white/5 focus:border-white/20 outline-none transition-all placeholder:text-white/10 text-lg"
                value={passInput} 
                onChange={(e) => setPassInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && passInput.trim() && (localStorage.setItem('chat_p_pass', passInput), setActivePass(passInput))}
              />
              <button 
                onClick={() => { if(passInput.trim()) { localStorage.setItem('chat_p_pass', passInput); setActivePass(passInput); }}}
                className="w-full bg-white text-black py-5 rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-xl"
              >
                Access Channel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#08080a] text-white flex flex-col overflow-hidden relative font-['Open_Sans']">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&display=swap');`}</style>
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_20%,#1a1a2e_0%,#08080a_100%)] opacity-30 pointer-events-none" />
      
      {/* Header */}
      <header className="relative z-10 h-24 flex items-center justify-between px-6 bg-transparent">
        <div className="flex items-center gap-4">
          <button onClick={() => {localStorage.removeItem('chat_p_pass'); window.location.reload();}} className="p-2 text-white/40 hover:text-white">
            <ChevronLeft size={28} />
          </button>
          <div>
            <h2 className="font-bold text-xl tracking-tight leading-tight">{peerHero}</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-indigo-400 shadow-[0_0_10px_#818cf8]' : 'bg-white/10'}`} />
              <p className="text-sm font-semibold text-white/30">{isOnline ? 'Peer Connected' : 'Syncing node'}</p>
            </div>
          </div>
        </div>
        <button onClick={() => window.confirm("Terminate this session?") && killChat()} className="p-4 bg-white/5 border border-white/5 rounded-2xl text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-all">
          <Power size={20} />
        </button>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto p-6 space-y-5 scrollbar-hide">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] sm:max-w-[70%] px-6 py-4 rounded-[1.8rem] text-[16px] border ${
              m.sender === 'me' 
              ? 'bg-[#818cf8]/10 text-white border-[#818cf8]/20 rounded-tr-md' 
              : 'bg-white/5 text-white/80 border-white/5 rounded-tl-md'
            }`}>
              <p className="leading-relaxed">{m.content}</p>
              <div className={`flex items-center justify-end gap-1.5 mt-2 text-white/20 text-xs font-semibold`}>
                {new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                {m.sender === 'me' && (m.status === 'read' ? <CheckCheck size={14} className="text-indigo-400"/> : <Check size={14}/>)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <footer className="relative z-10 p-6 pt-2">
        <div className="max-w-4xl mx-auto bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2rem] flex items-center px-6 py-3 shadow-2xl">
          <input 
            className="bg-transparent flex-1 py-4 outline-none text-white text-lg placeholder:text-white/10"
            placeholder="Type your message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && inputText.trim() && (sendMessage(inputText), setInputText(''))}
          />
          <button 
            disabled={!inputText.trim()}
            onClick={() => {sendMessage(inputText); setInputText('');}}
            className="w-14 h-14 bg-[#818cf8] rounded-2xl flex items-center justify-center text-white hover:bg-[#6366f1] disabled:opacity-5 active:scale-95 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Send size={24} />
          </button>
        </div>
      </footer>
    </div>
  );
}