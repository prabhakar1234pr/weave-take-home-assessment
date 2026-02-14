'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import { X, Send, Bot, User, Sparkles } from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  'Who is the best engineer?',
  'Who reviews the most code?',
  'Who merges PRs the fastest?',
  'Compare the top 3 engineers',
  'Give me a team summary',
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function ChatBot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const sendMessage = async (text: string) => {
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    const assistantId = `a-${Date.now()}`;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        throw new Error(`Chat API returned ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let accumulated = '';

      // Add empty assistant message
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const current = accumulated;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: current } : m))
        );
      }
    } catch (err) {
      console.error('Chat error:', err);
      // Only add error message if we haven't already added an assistant message with content
      setMessages((prev) => {
        const lastMsg = prev.find((m) => m.id === assistantId);
        if (lastMsg && lastMsg.content) return prev; // already got a response
        const filtered = prev.filter((m) => m.id !== assistantId);
        return [
          ...filtered,
          {
            id: assistantId,
            role: 'assistant' as const,
            content: 'Sorry, something went wrong. Please try again.',
          },
        ];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput('');
    sendMessage(text);
  };

  const handleSuggestion = (question: string) => {
    if (isLoading) return;
    setInput('');
    sendMessage(question);
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95"
        >
          <Sparkles className="size-5" />
          <span className="text-sm font-medium">Ask AI</span>
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex w-[400px] max-w-[calc(100vw-3rem)] flex-col rounded-2xl border bg-card shadow-2xl"
          style={{ height: 'min(600px, calc(100vh - 6rem))' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                <Bot className="size-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Dashboard AI</h3>
                <p className="text-[11px] text-muted-foreground">Ask anything about the data</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {messages.length === 0 && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="size-3.5 text-primary" />
                  </div>
                  <div className="rounded-xl rounded-tl-sm bg-muted px-3 py-2 text-sm">
                    Hi! I can answer questions about the Engineering Impact Dashboard. Try asking me something below.
                  </div>
                </div>
                <div className="space-y-1.5 pl-9">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSuggestion(q)}
                      className="block w-full rounded-lg border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                    m.role === 'user' ? 'bg-blue-500/10' : 'bg-primary/10'
                  }`}
                >
                  {m.role === 'user' ? (
                    <User className="size-3.5 text-blue-500" />
                  ) : (
                    <Bot className="size-3.5 text-primary" />
                  )}
                </div>
                <div
                  className={`rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'rounded-tr-sm bg-blue-500 text-white'
                      : 'rounded-tl-sm bg-muted'
                  }`}
                >
                  {m.content || '\u00A0'}
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-2">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="size-3.5 text-primary" />
                </div>
                <div className="rounded-xl rounded-tl-sm bg-muted px-3 py-2">
                  <div className="flex gap-1">
                    <span className="size-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="size-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="size-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="border-t px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about engineers..."
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/20"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="size-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
