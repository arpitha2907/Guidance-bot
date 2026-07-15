"use client";

import { useState, useRef, useEffect } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

const CONSENT_KEY = "guidance_consent_accepted";

// Conversation persistence: survives page reloads/tab closes without making
// the backend stateful -- the full client-side state is cached and restored
// from localStorage. A TTL prevents a long-abandoned session from silently
// resurrecting weeks later.
const SESSION_KEY = "guidance_session_v1";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type Domain = "health" | "emotional" | "legal" | "general";
type Resource = { label: string; contact: string };
type ClarifyOption = { label: string; domain: Domain };
type QA = { question: string; answer: string };

type Message = {
  role: "user" | "bot";
  text: string;
  sources?: string[];
  crisis?: boolean;
  resources?: Resource[];
  clarify?: boolean;
  options?: ClarifyOption[];
  notice?: boolean;
};

type PersistedSession = {
  concern: string | null;
  domain: Domain | null;
  history: QA[];
  pendingQuestion: string | null;
  messages: Message[];
  baseMessages: Message[] | null;
  savedAt: number;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const disclaimerTriggerRef = useRef<HTMLButtonElement>(null);
  const disclaimerCloseRef = useRef<HTMLButtonElement>(null);

  // Accessibility: the chat log becomes an aria-live region only after the
  // initial mount/restore has finished rendering, so a restored conversation
  // (potentially many messages) isn't read aloud in bulk by a screen
  // reader -- only genuinely new messages after that point are announced.
  const [liveAnnouncementsEnabled, setLiveAnnouncementsEnabled] = useState(false);

  // Three states: null = still checking localStorage (avoid flashing the
  // full app before we know), false = must show consent gate, true = go ahead.
  const [consented, setConsented] = useState<boolean | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const [concern, setConcern] = useState<string | null>(null);
  const [domain, setDomain] = useState<Domain | null>(null);
  const [history, setHistory] = useState<QA[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");

  // "Your answers so far" is a floating dropdown anchored above the input
  // instead of an always-expanded panel, so it doesn't permanently eat into
  // the space where the conversation is visible -- it only takes up room
  // while the user has actually opened it to review or edit something.
  const [answersOpen, setAnswersOpen] = useState(false);
  const answersPanelRef = useRef<HTMLDivElement>(null);

  // Snapshot of the chat transcript taken right before the FIRST follow-up
  // question is asked (i.e. just the concern + any domain-clarification
  // exchange). Used to rebuild the visible transcript from scratch when an
  // earlier answer is edited, so editing truly truncates-and-replays rather
  // than just patching an answer in place while leaving now-stale
  // downstream Q&A bubbles on screen.
  const baseMessagesRef = useRef<Message[] | null>(null);

  // Guards the persistence-save effect from firing (and overwriting a real
  // saved session with blank initial state) before the restore attempt below
  // has had a chance to run.
  const hydratedRef = useRef(false);

  useEffect(() => {
    try {
      setConsented(localStorage.getItem(CONSENT_KEY) === "true");
    } catch {
      setConsented(false);
    }
  }, []);

  // Restore a previous conversation on mount, if one was saved and hasn't
  // expired. Runs once; hydratedRef is flipped afterward regardless of
  // outcome so the save-effect below knows it's safe to start persisting.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedSession;
        const fresh =
          parsed && typeof parsed.savedAt === "number" && Date.now() - parsed.savedAt < SESSION_TTL_MS;
        if (fresh) {
          setConcern(parsed.concern ?? null);
          setDomain(parsed.domain ?? null);
          setHistory(parsed.history ?? []);
          setPendingQuestion(parsed.pendingQuestion ?? null);
          setMessages(parsed.messages ?? []);
          baseMessagesRef.current = parsed.baseMessages ?? null;
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      }
    } catch {
      // Corrupted or inaccessible storage -- start fresh rather than crash.
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch {}
    } finally {
      hydratedRef.current = true;
      // Small delay so the (possibly bulk) restored transcript finishes
      // rendering before the live region starts announcing new content.
      setTimeout(() => setLiveAnnouncementsEnabled(true), 300);
    }
  }, []);

  // Persist the conversation on every change so a reload/tab-close resumes
  // where the user left off. Skipped until hydration above has completed,
  // so we never clobber a saved session with the blank initial state.
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      const session: PersistedSession = {
        concern,
        domain,
        history,
        pendingQuestion,
        messages,
        baseMessages: baseMessagesRef.current,
        savedAt: Date.now(),
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      // Storage full or unavailable -- non-fatal, conversation just won't
      // survive a reload this time.
    }
  }, [concern, domain, history, pendingQuestion, messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Tracks whether the dialog has actually been opened at least once, so
  // the "restore focus to the trigger" branch doesn't fire on initial page
  // load (showDisclaimer starts false, which would otherwise steal focus
  // away from the textarea right after mount).
  const hasOpenedDisclaimerRef = useRef(false);

  useEffect(() => {
    if (showDisclaimer) {
      hasOpenedDisclaimerRef.current = true;
      disclaimerCloseRef.current?.focus();
    } else if (hasOpenedDisclaimerRef.current) {
      disclaimerTriggerRef.current?.focus();
    }
  }, [showDisclaimer]);

  // Close the answers dropdown on outside click or Escape, same pattern
  // used for the disclaimer dialog.
  useEffect(() => {
    if (!answersOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (answersPanelRef.current && !answersPanelRef.current.contains(e.target as Node)) {
        setAnswersOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setAnswersOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [answersOpen]);

  function closeDisclaimer() {
    setShowDisclaimer(false);
  }

  // Keyboard support for the disclaimer dialog: Escape closes it, and Tab /
  // Shift+Tab are trapped on the single focusable control inside (the Close
  // button) so focus can't silently leave the modal while it's open.
  function onDisclaimerKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeDisclaimer();
    } else if (e.key === "Tab") {
      e.preventDefault();
      disclaimerCloseRef.current?.focus();
    }
  }

  function acceptConsent() {
    try {
      localStorage.setItem(CONSENT_KEY, "true");
    } catch {}
    setConsented(true);
    // Move focus into the chat UI once it mounts, instead of leaving focus
    // stranded on a button that's about to disappear.
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function addBot(msg: Omit<Message, "role">) {
    setMessages((m) => [...m, { role: "bot", ...msg }]);
  }

  async function callBackend(state: {
    concern: string;
    domain?: Domain;
    history: QA[];
    latestAnswer?: string;
  }) {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();

      if (data.crisis) {
        addBot({ text: data.message, crisis: true, resources: data.resources });
        resetConversation();
      } else if (data.clarify) {
        addBot({ text: data.message, clarify: true, options: data.options });
      } else if (data.ask) {
        setDomain(data.domain);
        setPendingQuestion(data.question);
        setMessages((current) => {
          if (!baseMessagesRef.current && history.length === 0) {
            // First question of this conversation -- remember everything
            // before it (concern + optional clarify exchange) as the replay
            // base for future edits.
            baseMessagesRef.current = current;
          }
          return [...current, { role: "bot", text: data.question }];
        });
      } else {
        addBot({ text: data.answer, sources: data.sources });
        resetConversation();
      }
    } catch {
      addBot({
        text:
          "I couldn't reach the guidance service. Check that the backend is running, then try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  function resetConversation() {
    setConcern(null);
    setDomain(null);
    setHistory([]);
    setPendingQuestion(null);
    setEditingIndex(null);
    baseMessagesRef.current = null;
  }

  function send() {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");

    if (pendingQuestion && concern) {
      const newHistory = [...history, { question: pendingQuestion, answer: text }];
      setHistory(newHistory);
      setPendingQuestion(null);
      callBackend({
        concern,
        domain: domain || undefined,
        history: newHistory,
        latestAnswer: text,
      });
    } else {
      setConcern(text);
      setHistory([]);
      callBackend({ concern: text, history: [] });
    }
  }

  function chooseDomain(d: Domain, label: string) {
    if (loading || !concern) return;
    setMessages((m) => [...m, { role: "user", text: label }]);
    setDomain(d);
    callBackend({ concern, domain: d, history });
  }

  function startEdit(index: number) {
    if (loading) return;
    setEditingIndex(index);
    setEditDraft(history[index].answer);
  }

  function cancelEdit() {
    setEditingIndex(null);
    setEditDraft("");
  }

  function saveEdit() {
    if (editingIndex === null) return;
    const text = editDraft.trim();
    if (!text) return;

    // TRUE truncate-and-replay: keep everything up to and including the
    // edited step (with the new answer), and discard every question/answer
    // that came after it -- those were follow-ups to the OLD answer and no
    // longer apply once the answer changes.
    const truncated = history
      .slice(0, editingIndex)
      .concat([{ question: history[editingIndex].question, answer: text }]);

    const stepNum = editingIndex + 1;
    setHistory(truncated);
    setPendingQuestion(null);
    setEditingIndex(null);
    setEditDraft("");

    // Rebuild the visible transcript from the replay base + the truncated
    // Q&A pairs, instead of leaving now-stale bot questions/user answers
    // (from steps after the edited one) sitting in the chat log.
    const base = baseMessagesRef.current ?? [];
    const replayed: Message[] = truncated.flatMap((qa) => [
      { role: "bot", text: qa.question },
      { role: "user", text: qa.answer },
    ]);
    setMessages([
      ...base,
      ...replayed,
      { role: "bot", text: `Conversation updated from step ${stepNum}.`, notice: true },
    ]);

    if (concern) {
      callBackend({
        concern,
        domain: domain || undefined,
        history: truncated,
      });
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const disclaimerText =
    "This tool offers general guidance for informational purposes only. It is not a medical, legal, or mental-health service and does not provide diagnosis or professional advice. It may be inaccurate or incomplete. For any urgent or serious concern, contact a qualified professional or your local emergency services. By continuing, you acknowledge that you understand this.";

  // Still checking localStorage on mount -- render nothing rather than
  // flashing the full chat UI before we know if consent was given.
  if (consented === null) {
    return <div className="h-dvh" />;
  }

  if (!consented) {
    return (
      <div className="mx-auto flex h-dvh max-w-2xl flex-col items-center justify-center px-6">
        <div className="w-full rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            Before you begin
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">{disclaimerText}</p>
          <button
            onClick={acceptConsent}
            className="mt-5 w-full rounded-2xl bg-sage px-5 py-3 text-sm font-medium text-white transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
          >
            I understand and agree
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col px-4">
      <header className="border-b border-line pb-4 pt-6">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Guidance</h1>
        <p className="mt-1 text-sm text-muted">
          General guidance, grounded in trusted sources. Not a substitute for
          professional care.
        </p>
      </header>

      <main
        className="flex-1 space-y-4 overflow-y-auto py-6"
        aria-live={liveAnnouncementsEnabled ? "polite" : "off"}
        aria-relevant="additions"
      >
        {messages.length === 0 && (
          <div className="mt-12 text-center text-sm text-muted">
            Describe what&apos;s going on. I may ask a few questions before
            sharing guidance.
          </div>
        )}

        {messages.map((m, i) => {
          if (m.notice) {
            return (
              <div key={i} className="flex justify-center">
                <span className="rounded-full bg-sage-soft px-3 py-1 text-xs text-muted">
                  {m.text}
                </span>
              </div>
            );
          }

          if (m.crisis) {
            return (
              <div
                key={i}
                role="alert"
                className="rounded-xl border-l-4 p-4 text-sm leading-relaxed"
                style={{ borderColor: "var(--danger)", background: "#fbf0ec", color: "var(--ink)" }}
              >
                <p className="font-medium">{m.text}</p>
                {m.resources && m.resources.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {m.resources.map((r, j) => (
                      <li key={j} className="flex flex-col">
                        <span className="text-xs text-muted">{r.label}</span>
                        <span className="text-base font-semibold tracking-wide">{r.contact}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          }

          if (m.clarify) {
            return (
              <div key={i} className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-white px-4 py-2.5 text-sm leading-relaxed text-ink shadow-sm">
                  <p>{m.text}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.options?.map((o, j) => (
                      <button
                        key={j}
                        onClick={() => chooseDomain(o.domain, o.label)}
                        disabled={loading}
                        className="rounded-full bg-sage-soft px-4 py-1.5 text-sm font-medium text-ink transition hover:bg-line focus:outline-none focus-visible:ring-2 focus-visible:ring-sage disabled:opacity-40"
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "rounded-br-sm bg-user-bubble text-white"
                    : "rounded-bl-sm bg-white text-ink shadow-sm"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.sources && m.sources.length > 0 && (
                  <p className="mt-2 text-xs text-muted">Source: {m.sources.join(", ")}</p>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-sm">
              <span className="flex gap-1" aria-hidden="true">
                <span className="typing-dot h-2 w-2 rounded-full bg-muted" />
                <span className="typing-dot h-2 w-2 rounded-full bg-muted" style={{ animationDelay: "0.2s" }} />
                <span className="typing-dot h-2 w-2 rounded-full bg-muted" style={{ animationDelay: "0.4s" }} />
              </span>
              <span className="sr-only">Assistant is typing…</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </main>

      {history.length > 0 && (
        <div ref={answersPanelRef} className="relative border-t border-line">
          <button
            onClick={() => setAnswersOpen((v) => !v)}
            aria-expanded={answersOpen}
            aria-controls="answers-panel"
            className="flex w-full items-center justify-between py-2 text-xs font-medium uppercase tracking-wide text-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
          >
            <span>Your answers so far ({history.length})</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className={`h-4 w-4 shrink-0 transition-transform ${answersOpen ? "rotate-180" : ""}`}
              fill="currentColor"
            >
              <path d="M5.25 7.5L10 12.25L14.75 7.5H5.25Z" />
            </svg>
          </button>

          {answersOpen && (
            <div
              id="answers-panel"
              role="region"
              aria-label="Your answers so far"
              className="absolute bottom-full left-0 right-0 z-20 mb-1 max-h-64 overflow-y-auto rounded-2xl border border-line bg-white p-3 shadow-lg"
            >
              <ul className="space-y-2">
                {history.map((qa, idx) => (
                  <li key={idx} className="rounded-lg bg-paper px-3 py-2 text-sm shadow-sm">
                    <p className="text-xs text-muted">{qa.question}</p>
                    {editingIndex === idx ? (
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          aria-label="Edit your answer"
                          className="flex-1 rounded-md border border-line px-2 py-1 text-sm focus:border-sage focus:outline-none"
                        />
                        <button
                          onClick={saveEdit}
                          disabled={loading || !editDraft.trim()}
                          className="rounded-md bg-sage px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="rounded-md bg-sage-soft px-3 py-1 text-xs font-medium text-ink"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-ink">{qa.answer}</span>
                        <button
                          onClick={() => startEdit(idx)}
                          disabled={loading}
                          aria-label={`Edit answer to: ${qa.question}`}
                          className="shrink-0 text-xs font-medium text-sage underline underline-offset-2 disabled:opacity-40"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <footer className="border-t border-line py-4">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            aria-label={pendingQuestion ? "Your answer" : "Describe your concern"}
            placeholder={pendingQuestion ? "Type your answer..." : "Describe your concern..."}
            className="flex-1 resize-none rounded-2xl border border-line bg-white px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:border-sage focus:outline-none"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="rounded-2xl bg-sage px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-sage disabled:opacity-40"
          >
            Send
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-muted">
          If this is an emergency, contact local emergency services.{" "}
          <button
            ref={disclaimerTriggerRef}
            onClick={() => setShowDisclaimer(true)}
            className="underline underline-offset-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
          >
            Disclaimer
          </button>
        </p>
      </footer>

      {showDisclaimer && (
        // The backdrop's onClick-to-dismiss and the content wrapper's
        // stopPropagation are pointer-only conveniences. Keyboard users
        // already have full equivalent access via Escape (onKeyDown below)
        // and the explicit Close button, so these aren't made separately
        // "interactive" for keyboard/AT users -- there's nothing meaningful
        // to activate on the backdrop itself beyond what those provide.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 px-6"
          role="dialog"
          aria-modal="true"
          aria-label="Disclaimer"
          onClick={closeDisclaimer}
          onKeyDown={onDisclaimerKeyDown}
        >
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-ink">Disclaimer</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{disclaimerText}</p>
            <button
              ref={disclaimerCloseRef}
              onClick={closeDisclaimer}
              className="mt-5 w-full rounded-2xl bg-sage-soft px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-line focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}