import { useCallback, useEffect, useRef, useState } from "react";
import { chatApi, type ChatSource, type ChatError } from "@/lib/api/chatApi";

// Mirrors backend config.chat (backend/src/config/index.js) by convention —
// kept as two separately-maintained copies, not a shared runtime call,
// since client-side polling timing must keep working even if a config fetch
// failed.
export const POLL_INTERVAL_MS = 3000;
export const MAX_POLL_ATTEMPTS = 20; // 3000 * 20 = 60s

export type PollStatus = "PROCESSING" | "COMPLETED" | "FAILED" | "TIMEOUT";

interface PollState {
  status: PollStatus;
  message: string | null;
  sources: ChatSource[];
  error: ChatError | null;
  attempts: number;
}

const INITIAL_STATE: PollState = { status: "PROCESSING", message: null, sources: [], error: null, attempts: 0 };

/**
 * Isolates all setInterval/timeout logic for short-polling one message's
 * status behind a single hook — the seam that makes swapping to SSE/
 * WebSocket later a change confined to this one file; ChatPanel and the
 * store never need to change. See decisions.md.
 *
 * TIMEOUT is a frontend-only state layered on top of backend status after
 * MAX_POLL_ATTEMPTS — it is never written back to the server, and never
 * implies the backend actually failed (the backend keeps processing
 * independently). `refresh()` re-reads status once and, if still
 * PROCESSING, resumes polling — it NEVER re-sends/duplicates the message.
 */
export function useMessageStatusPoll(conversationId: string | null, messageId: string | null) {
  const [state, setState] = useState<PollState>(INITIAL_STATE);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const check = useCallback(async () => {
    if (!conversationId || !messageId) return;
    try {
      const result = await chatApi.getMessageStatus(conversationId, messageId);
      if (result.status === "COMPLETED") {
        stop();
        setState({ status: "COMPLETED", message: result.message, sources: result.sources, error: null, attempts: 0 });
        return;
      }
      if (result.status === "FAILED") {
        stop();
        setState({ status: "FAILED", message: null, sources: [], error: result.error, attempts: 0 });
        return;
      }
      setState((prev) => {
        const attempts = prev.attempts + 1;
        if (attempts >= MAX_POLL_ATTEMPTS) {
          stop();
          return { ...prev, status: "TIMEOUT", attempts };
        }
        return { ...prev, status: "PROCESSING", attempts };
      });
    } catch {
      // A transient network error while polling shouldn't flip the UI to
      // FAILED — that state is reserved for a backend-persisted failure.
      // Skip this tick, try again on the next interval.
    }
  }, [conversationId, messageId, stop]);

  useEffect(() => {
    stop();
    setState(INITIAL_STATE);
    if (!conversationId || !messageId) return undefined;

    check();
    timerRef.current = setInterval(check, POLL_INTERVAL_MS);
    return stop;
    // Deliberately keyed only on the ids — `check`/`stop` are stable given
    // the same ids, and including them would restart the interval on every
    // render instead of only when the polled message actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, messageId]);

  const refresh = useCallback(() => {
    stop();
    setState((prev) => ({ ...prev, status: "PROCESSING", attempts: 0 }));
    check();
    timerRef.current = setInterval(check, POLL_INTERVAL_MS);
  }, [check, stop]);

  return { ...state, isTimedOut: state.status === "TIMEOUT", refresh };
}
