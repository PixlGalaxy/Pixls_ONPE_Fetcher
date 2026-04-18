import { useState, useRef, useEffect, useCallback } from 'react';
import type { KeyboardEvent, ComponentProps, JSX } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  MessageSquare, Send, Bot, User,
  AlertTriangle, Loader2, Zap, CheckCircle2, Radio, Trash2,
} from 'lucide-react';
import { API_BASE } from '../types/election';

/* ── Types ──────────────────────────────────────────────────────────────── */

type ModelStatus = 'idle' | 'loading_model' | 'model_loaded' | 'inference' | 'streaming' | 'done' | 'error';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/* ── localStorage ───────────────────────────────────────────────────────── */

const STORAGE_KEY = 'onpe-chat-history';

function loadSavedMessages(): Message[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Message[];
    const filtered = parsed.filter(m => !(m.role === 'assistant' && !m.content.trim()));
    return filtered.length > 0 ? filtered : null;
  } catch {
    return null;
  }
}

function saveMessages(messages: Message[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {}
}

function clearSavedMessages(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/* ── Status badge ───────────────────────────────────────────────────────── */

const STATUS_CFG: Record<ModelStatus, { label: string; color: string; icon: JSX.Element }> = {
  idle:          { label: 'Listo',            color: '#45e5f3', icon: <MessageSquare size={11} /> },
  loading_model: { label: 'Cargando modelo en Zaylar…', color: '#E6B41A',    icon: <Loader2 size={11} className="animate-spin" /> },
  model_loaded:  { label: 'Modelo Listo',     color: '#22c55e',    icon: <CheckCircle2 size={11} /> },
  inference:     { label: 'Generando…',       color: '#4A90D9',    icon: <Zap size={11} /> },
  streaming:     { label: 'Stremeando',   color: '#4A90D9',    icon: <Radio size={11} /> },
  done:          { label: 'Completado',       color: '#22c55e',    icon: <CheckCircle2 size={11} /> },
  error:         { label: 'Error',            color: '#E04848',    icon: <AlertTriangle size={11} /> },
};

function StatusBadge({ status }: { status: ModelStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
      style={{ background: cfg.color + '22', color: cfg.color }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

/* ── Markdown components ────────────────────────────────────────────────── */

type AnyProps = ComponentProps<'div'> & Record<string, unknown>;

const mdComponents = {
  p: ({ children }: AnyProps) => (
    <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>
  ),
  strong: ({ children }: AnyProps) => (
    <strong style={{ fontWeight: 700, color: 'inherit' }}>{children}</strong>
  ),
  em: ({ children }: AnyProps) => (
    <em style={{ fontStyle: 'italic', color: 'inherit' }}>{children}</em>
  ),
  h1: ({ children }: AnyProps) => (
    <h1 className="text-[15px] font-bold mt-2 mb-1.5" style={{ color: 'var(--tx1)' }}>{children}</h1>
  ),
  h2: ({ children }: AnyProps) => (
    <h2 className="text-[13px] font-bold mt-2 mb-1" style={{ color: 'var(--tx1)' }}>{children}</h2>
  ),
  h3: ({ children }: AnyProps) => (
    <h3 className="text-[12px] font-semibold mt-1.5 mb-1" style={{ color: 'var(--tx1)' }}>{children}</h3>
  ),
  ul: ({ children }: AnyProps) => (
    <ul className="list-disc pl-4 space-y-0.5 mb-1.5">{children}</ul>
  ),
  ol: ({ children }: AnyProps) => (
    <ol className="list-decimal pl-4 space-y-0.5 mb-1.5">{children}</ol>
  ),
  li: ({ children }: AnyProps) => (
    <li className="text-[13px] leading-relaxed">{children}</li>
  ),
  blockquote: ({ children }: AnyProps) => (
    <blockquote
      className="pl-3 my-1.5 border-l-2 italic text-[12px]"
      style={{ borderColor: '#4A90D9', color: 'var(--tx2)' }}
    >
      {children}
    </blockquote>
  ),
  hr: () => (
    <hr className="my-2" style={{ borderColor: 'var(--border)' }} />
  ),
  /* ── Code ── */
  pre: ({ children }: AnyProps) => (
    <pre
      className="rounded-lg p-3 my-1.5 overflow-x-auto text-[11px] leading-relaxed"
      style={{ background: 'var(--bg-alt)', color: 'var(--tx1)', fontFamily: 'ui-monospace, monospace' }}
    >
      {children}
    </pre>
  ),
  code: ({ children, className }: AnyProps) => {
    const isBlock = typeof className === 'string' && className.startsWith('language-');
    if (isBlock) {
      return <code style={{ fontFamily: 'ui-monospace, monospace' }}>{children}</code>;
    }
    return (
      <code
        className="px-1.5 py-0.5 rounded text-[11px]"
        style={{
          background: 'rgba(74,144,217,0.12)',
          color: '#E8943A',
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        {children}
      </code>
    );
  },
  /* ── Tables ── */
  table: ({ children }: AnyProps) => (
    <div
      className="overflow-x-auto my-2 rounded-lg"
      style={{ border: '1px solid var(--border)' }}
    >
      <table className="w-full text-[11px] border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }: AnyProps) => (
    <thead style={{ background: 'var(--bg-alt)' }}>{children}</thead>
  ),
  tbody: ({ children }: AnyProps) => <tbody>{children}</tbody>,
  tr: ({ children }: AnyProps) => (
    <tr className="border-t" style={{ borderColor: 'var(--border)' }}>{children}</tr>
  ),
  th: ({ children }: AnyProps) => (
    <th
      className="text-left px-3 py-2 font-semibold"
      style={{ color: 'var(--tx2)' }}
    >
      {children}
    </th>
  ),
  td: ({ children }: AnyProps) => (
    <td className="px-3 py-1.5" style={{ color: 'var(--tx1)' }}>{children}</td>
  ),
};

/* ── Message bubble ─────────────────────────────────────────────────────── */

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-fade-up`}>
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{
          background: isUser ? 'rgba(74,144,217,0.2)' : 'rgba(230,180,26,0.15)',
          color: isUser ? '#4A90D9' : '#E6B41A',
        }}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      {/* Bubble */}
      <div
        className="max-w-[82%] px-3.5 py-2.5 text-[13px]"
        style={
          isUser
            ? {
                background: 'rgba(74,144,217,0.15)',
                color: 'var(--tx1)',
                borderRadius: '18px 4px 18px 18px',
              }
            : {
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--tx1)',
                borderRadius: '4px 18px 18px 18px',
              }
        }
      >
        {message.content === '' ? (
          /* Typing indicator cuando el stream aún no empezó */
          <span className="inline-flex gap-1 items-center py-1" style={{ color: 'var(--tx3)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        ) : isUser ? (
          /* Mensajes del usuario: texto plano con saltos de línea */
          <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
        ) : (
          /* Mensajes del asistente: markdown renderizado */
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={mdComponents as never}
          >
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

const INITIAL_MESSAGES: Message[] = [
  {
    role: 'assistant',
    content:
      '¡Hola! Soy Bit, tu asistente electoral con acceso a datos en tiempo real del ONPE.\n\n' +
      'Puedes preguntarme sobre **resultados**, **predicciones**, **tendencias por región** o cualquier cosa sobre las elecciones 2026.\n\n' +
      'También puedo hacer tablas comparativas y análisis detallados.',
  },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>(() => loadSavedMessages() ?? INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<ModelStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busy = status !== 'idle' && status !== 'done' && status !== 'error';

  /* Abortar stream al desmontar (navegar) o al refrescar la página */
  useEffect(() => {
    const abort = () => abortRef.current?.abort();
    window.addEventListener('beforeunload', abort);
    return () => {
      abort();
      window.removeEventListener('beforeunload', abort);
    };
  }, []);

  /* Scroll al último mensaje */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* Auto-resize textarea */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [input]);

  /* Guardar en localStorage cuando no hay streaming activo */
  useEffect(() => {
    if (!busy) saveMessages(messages);
  }, [messages, busy]);

  /* Limpiar chat */
  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages(INITIAL_MESSAGES);
    setStatus('idle');
    setError(null);
    clearSavedMessages();
  }, []);

  /* Enviar mensaje */
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;

    const userMsg: Message = { role: 'user', content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setError(null);
    setStatus('loading_model');

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE}/LLM`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error('No response body');

      /* Burbuja vacía del asistente que se irá llenando */
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let evt: Record<string, string>;
          try { evt = JSON.parse(line.slice(6)); } catch { continue; }

          if (evt.type === 'status') {
            setStatus(evt.status as ModelStatus);
          } else if (evt.type === 'token') {
            setStatus('streaming');
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              updated[updated.length - 1] = { ...last, content: last.content + evt.content };
              return updated;
            });
          } else if (evt.type === 'done') {
            setStatus('idle');
          } else if (evt.type === 'error') {
            setError(evt.message);
            setStatus('error');
          }
        }
      }

      setStatus('idle');
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(msg);
      setStatus('error');
      /* Elimina burbuja vacía si no llegó ningún token */
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && !last.content) return prev.slice(0, -1);
        return prev;
      });
    }
  }, [input, messages, busy]);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 180px)', minHeight: '400px' }}>

      {/* ══════════ Header ══════════ */}
      <div
        className="flex items-center justify-between gap-4 flex-wrap pt-5 pb-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="min-w-[140px]">
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--tx1)' }}>
            Asistente Electoral 
          </h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx3)' }}>
            ZaylarAI | Todos los mensajes se guardan localmente como cookies en tu navegador
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <button
            onClick={clearChat}
            title="Limpiar chat"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all hover:opacity-80"
            style={{
              background: 'rgba(224,72,72,0.08)',
              borderColor: 'rgba(224,72,72,0.3)',
              color: '#E04848',
            }}
          >
            <Trash2 size={12} />
            Limpiar Chat
          </button>
        </div>
      </div>

      {/* ══════════ Messages ══════════ */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {error && (
          <div
            className="text-[12px] px-3 py-2 rounded-lg flex items-start gap-2"
            style={{ background: 'rgba(224,72,72,0.1)', color: '#E04848' }}
          >
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ══════════ Input ══════════ */}
      <div className="flex-shrink-0 border-t pt-3 pb-1" style={{ borderColor: 'var(--border)' }}>
        <div
          className="flex gap-2 items-center rounded-xl border px-3 py-2 transition-colors"
          style={{
            background: 'var(--bg-card)',
            borderColor: busy ? 'var(--border)' : '#4A90D9',
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={busy}
            placeholder={busy ? 'Esperando respuesta…' : 'Escribe tu pregunta… (Enter para enviar, Shift+Enter nueva línea)'}
            rows={1}
            className="flex-1 resize-none bg-transparent text-[13px] outline-none"
            style={{
              color: 'var(--tx1)',
              caretColor: '#4A90D9',
              opacity: busy ? 0.5 : 1,
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || busy}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80"
            style={{ background: '#4A90D9', color: '#fff' }}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
        <p className="text-[10px] mt-1.5 text-center" style={{ color: 'var(--tx0)' }}>
          ZaylarAI Puede Cometer Errores · Verifica datos críticos con fuentes oficiales del ONPE 
        </p>
      </div>
    </div>
  );
}
