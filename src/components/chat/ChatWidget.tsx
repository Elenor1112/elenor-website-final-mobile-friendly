'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  ArrowDown,
  Check,
  Copy,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { Markdown } from './markdown';
import { useChat, type ChatMessage } from './use-chat';

/**
 * Floating assistant.
 *
 * Rendered by ChatWidgetLoader, which lazy-loads this module so none of it
 * (or the markdown renderer) lands in the initial homepage bundle.
 */

const SUGGESTED_QUESTIONS = [
  'What services do you offer?',
  'Can you build ecommerce websites?',
  'Tell me about your SEO services.',
  'Show your latest work.',
  'What industries do you specialize in?',
];

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / permissions) — fail quietly.
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-md p-1.5 text-white/40 opacity-0 transition hover:bg-white/10 hover:text-white/80 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow/60 group-hover:opacity-100"
      aria-label={copied ? 'Copied to clipboard' : 'Copy message'}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-2" aria-label="Elenor AI is typing">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-glow/70"
          style={{ animationDelay: `${delay}ms`, animationDuration: '1.2s' }}
        />
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`group flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        aria-hidden
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-semibold ${
          isUser
            ? 'bg-white/10 text-white/70'
            : 'bg-gradient-to-br from-brand to-brand-cyan text-ink'
        }`}
      >
        {isUser ? 'You' : <Sparkles className="h-3.5 w-3.5" />}
      </div>

      <div className={`flex min-w-0 max-w-[85%] flex-col gap-1 ${isUser ? 'items-end' : ''}`}>
        <div
          className={`rounded-2xl px-3.5 py-2.5 ${
            isUser
              ? 'rounded-tr-sm bg-brand/15 text-[0.9375rem] leading-relaxed text-white/90'
              : 'rounded-tl-sm border border-white/10 bg-white/[0.04]'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <Markdown content={message.content} />
          )}
        </div>

        {/* Citations — only shown when the answer actually used sources. */}
        {!isUser && message.sources && message.sources.length > 0 && message.content && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {message.sources
              .filter((source) => source.url)
              .slice(0, 3)
              .map((source) => (
                <a
                  key={source.chunkId}
                  href={source.url ?? '#'}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[0.6875rem] text-white/55 transition hover:border-brand-glow/40 hover:text-brand-glow"
                >
                  {source.title}
                </a>
              ))}
          </div>
        )}

        <div
          className={`flex items-center gap-1 px-1 ${isUser ? 'flex-row-reverse' : ''}`}
        >
          <time className="text-[0.6875rem] text-white/30" dateTime={new Date(message.createdAt).toISOString()}>
            {formatTime(message.createdAt)}
          </time>
          {!isUser && message.content && <CopyButton text={message.content} />}
        </div>
      </div>
    </div>
  );
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [showScrollButton, setShowScrollButton] = useState(false);

  const { messages, isStreaming, isThinking, error, send, retry, clear, stop, hydrated } =
    useChat();

  const panelId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** Suppresses auto-scroll while the visitor is reading earlier messages. */
  const pinnedToBottom = useRef(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior });
    pinnedToBottom.current = true;
    setShowScrollButton(false);
  }, []);

  const handleScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    pinnedToBottom.current = distance < 60;
    setShowScrollButton(distance > 120);
  }, []);

  useEffect(() => {
    if (isOpen && pinnedToBottom.current) scrollToBottom(isStreaming ? 'auto' : 'smooth');
  }, [messages, isOpen, isStreaming, scrollToBottom]);

  // Focus management: move focus into the panel on open, restore on close.
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(timer);
    }
    triggerRef.current?.focus();
    return undefined;
  }, [isOpen]);

  // `inert` keeps the closed panel out of the tab order and the accessibility
  // tree. Set imperatively because React 18's DOM typings predate the
  // attribute; the property is supported by every browser that ships it, and
  // the Tab trap above covers the rest.
  useEffect(() => {
    const node = panelRef.current;
    if (!node) return;
    if (isOpen) node.removeAttribute('inert');
    else node.setAttribute('inert', '');
  }, [isOpen]);

  // Escape closes; Tab is trapped inside the panel while it is open.
  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setIsOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea, a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const submit = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    send(text);
    setInput('');
    pinnedToBottom.current = true;
    // Reset the autosized textarea.
    if (inputRef.current) inputRef.current.style.height = 'auto';
  }, [input, isStreaming, send]);

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter inserts a newline.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <>
      {/* Launcher */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={isOpen ? 'Close Elenor AI assistant' : 'Open Elenor AI assistant'}
        // Hook for the mobile layer, which recedes the launcher while the page
        // is scrolling so it stops sitting on top of content (see mobile.css).
        data-chat-launcher
        className={`fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full shadow-[0_8px_30px_-6px_rgba(0,0,0,0.6)] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow focus-visible:ring-offset-2 focus-visible:ring-offset-ink motion-safe:hover:scale-105 ${
          isOpen
            ? 'bg-white/10 text-white backdrop-blur-xl'
            : 'bg-gradient-to-br from-brand to-brand-cyan text-ink'
        }`}
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Panel */}
      <div
        id={panelId}
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-label="Elenor AI assistant"
        aria-hidden={!isOpen}
        className={`glass fixed z-[59] flex flex-col overflow-hidden rounded-2xl shadow-[0_20px_70px_-15px_rgba(0,0,0,0.8)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none bottom-24 right-5 h-[min(600px,calc(100dvh-8rem))] w-[min(400px,calc(100vw-2.5rem))] max-sm:bottom-0 max-sm:right-0 max-sm:h-[85dvh] max-sm:w-full max-sm:rounded-b-none ${
          isOpen
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-4 scale-95 opacity-0'
        }`}
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-cyan text-ink"
            >
              <Sparkles className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-display text-sm font-semibold text-white">Elenor AI</span>
              <span className="block text-[0.6875rem] text-white/45">
                {isStreaming ? 'Typing…' : 'Ask about our work and services'}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-1">
            {!isEmpty && (
              <button
                type="button"
                onClick={clear}
                className="rounded-lg p-2 text-white/40 transition hover:bg-white/10 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow/60"
                aria-label="Clear conversation"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-2 text-white/40 transition hover:bg-white/10 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow/60"
              aria-label="Close assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Transcript */}
        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="h-full space-y-4 overflow-y-auto overscroll-contain px-4 py-4"
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-busy={isStreaming}
          >
            {!hydrated ? (
              <div className="space-y-3" aria-hidden>
                {[0, 1].map((i) => (
                  <div key={i} className="flex gap-2.5">
                    <span className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-white/[0.06]" />
                    <span
                      className="h-16 flex-1 animate-pulse rounded-2xl bg-white/[0.04]"
                      style={{ animationDelay: `${i * 120}ms` }}
                    />
                  </div>
                ))}
              </div>
            ) : isEmpty ? (
              <div className="flex flex-col gap-4 pt-2">
                <p className="text-[0.9375rem] leading-relaxed text-white/70">
                  Hi — I&apos;m Elenor AI. I can tell you about our services, our work, and how we
                  might help with your project. What would you like to know?
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTED_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => send(question)}
                      className="rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5 text-left text-[0.875rem] text-white/70 transition hover:border-brand-glow/40 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow/60"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                {isThinking && (
                  <div className="flex gap-2.5">
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-cyan text-ink"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <TypingIndicator />
                  </div>
                )}
              </>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/10 px-3.5 py-2.5"
              >
                <p className="text-[0.8125rem] text-red-200/90">{error}</p>
                <button
                  type="button"
                  onClick={retry}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-300/30 px-2.5 py-1.5 text-[0.75rem] font-medium text-red-100 transition hover:bg-red-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/60"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </button>
              </div>
            )}
          </div>

          {showScrollButton && (
            <button
              type="button"
              onClick={() => scrollToBottom()}
              className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/15 bg-ink-soft/90 px-3 py-1.5 text-[0.75rem] text-white/75 shadow-lg backdrop-blur-md transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow/60"
            >
              <ArrowDown className="h-3 w-3" />
              Latest
            </button>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-white/10 p-3">
          <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 transition focus-within:border-brand-glow/40">
            <label htmlFor={`${panelId}-input`} className="sr-only">
              Ask Elenor AI a question
            </label>
            <textarea
              id={`${panelId}-input`}
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                // Autosize up to ~5 rows.
                const node = event.target;
                node.style.height = 'auto';
                node.style.height = `${Math.min(node.scrollHeight, 120)}px`;
              }}
              onKeyDown={onInputKeyDown}
              placeholder="Ask about our services…"
              disabled={isStreaming}
              className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent text-base md:text-[0.9375rem] text-white placeholder:text-white/30 focus:outline-none disabled:opacity-50"
            />

            {isStreaming ? (
              <button
                type="button"
                onClick={stop}
                aria-label="Stop generating"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/80 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow/60"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!input.trim()}
                aria-label="Send message"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-ink transition hover:bg-brand-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow focus-visible:ring-offset-1 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <p className="mt-1.5 px-1 text-center text-[0.6875rem] text-white/25">
            Elenor AI can make mistakes. Verify important details with our team.
          </p>
        </div>
      </div>
    </>
  );
}
