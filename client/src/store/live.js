import { create } from 'zustand';

// Severity hierarchy for ranking and comparisons
const SEVERITY_LEVELS = {
  NONE: 0,
  LOW: 1,
  MED: 2,
  MEDIUM: 2,
  HIGH: 3,
};

// Returns highest severity between two values
const raiseSeverity = (current = 'NONE', incoming = 'NONE') => {
  const currentRank = SEVERITY_LEVELS[String(current).toUpperCase()] ?? 0;
  const incomingRank = SEVERITY_LEVELS[String(incoming).toUpperCase()] ?? 0;
  return incomingRank > currentRank ? incoming.toUpperCase() : current.toUpperCase();
};

const initialSummary = {
  total: 0,
  online: 0,
  flagged: 0,
  high: 0,
  med: 0,
  low: 0,
  focusLost: 0,
};

const initialState = {
  exam: null,
  sessions: {}, // Keyed by sessionId: { id, name, status, focused, maxSeverity, flagCount, pulseAt, ... }
  order: [], // Array of sessionIds for Virtuoso virtualization
  feed: [], // Recent flags array (newest first, capped at 100)
  summary: initialSummary,
  socketConnected: false,
};

// Helper to compute summary counters across all sessions
const computeSummary = (sessionsMap) => {
  const sessions = Object.values(sessionsMap);
  let online = 0;
  let flagged = 0;
  let high = 0;
  let med = 0;
  let low = 0;
  let focusLost = 0;

  for (const s of sessions) {
    if (s.status === 'Online') online++;
    if (s.flagCount > 0 || (s.maxSeverity && s.maxSeverity !== 'NONE')) flagged++;
    if (s.maxSeverity === 'HIGH') high++;
    else if (s.maxSeverity === 'MED' || s.maxSeverity === 'MEDIUM') med++;
    else if (s.maxSeverity === 'LOW') low++;
    if (s.focused === false && s.status === 'Online') focusLost++;
  }

  return {
    total: sessions.length,
    online,
    flagged,
    high,
    med,
    low,
    focusLost,
  };
};

export const useLiveStore = create((set, get) => ({
  ...initialState,

  // Set exam metadata
  setExam: (exam) => set({ exam }),

  // Load initial batch of sessions (up to 500)
  loadSessions: (items = []) => {
    const sessions = {};
    const order = [];

    items.forEach((item) => {
      const id = item.id || item.sessionId;
      order.push(id);
      sessions[id] = {
        ...item,
        id,
        status: item.status || 'Online',
        focused: item.focused !== undefined ? item.focused : true,
        maxSeverity: item.maxSeverity || (item.flagCount > 0 ? 'MED' : 'NONE'),
        flagCount: item.flagCount || 0,
        pulseAt: item.pulseAt || 0,
      };
    });

    const summary = computeSummary(sessions);

    set({
      sessions,
      order,
      summary,
    });
  },

  /**
   * Apply delta status update per SPEC Section 8:
   * - Connection and maxSeverity are separate fields
   * - 'FLAGGED' only raises maxSeverity without breaking connection status
   * - Unknown sessionId returns false so caller can trigger debounced refetch
   */
  applyStatus: ({ sessionId, status, focused, maxSeverity }) => {
    const state = get();
    const existing = state.sessions[sessionId];

    if (!existing) {
      return false; // Unknown sessionId triggers refetch
    }

    // Determine connection status vs flagged severity
    let nextConnectionStatus = existing.status;
    let nextSeverity = existing.maxSeverity;

    if (status) {
      if (status.toUpperCase() === 'FLAGGED') {
        // FLAGGED only raises maxSeverity
        nextSeverity = raiseSeverity(nextSeverity, 'MED');
      } else {
        nextConnectionStatus = status;
      }
    }

    if (maxSeverity) {
      nextSeverity = raiseSeverity(nextSeverity, maxSeverity);
    }

    const updatedSession = {
      ...existing,
      status: nextConnectionStatus,
      focused: focused !== undefined ? focused : existing.focused,
      maxSeverity: nextSeverity,
    };

    const newSessions = {
      ...state.sessions,
      [sessionId]: updatedSession,
    };

    set({
      sessions: newSessions,
      summary: computeSummary(newSessions),
    });

    return true;
  },

  /**
   * Apply incoming real-time flag per SPEC Section 8:
   * - Increments flagCount
   * - Raises maxSeverity
   * - Sets pulseAt: Date.now() for 1.5s visual feedback
   * - Prepends to feed (capped at 100 items)
   */
  applyFlag: (flag) => {
    const state = get();
    const sessionId = flag.sessionId;
    const existing = state.sessions[sessionId];

    let newSessions = state.sessions;

    if (existing) {
      const nextSeverity = raiseSeverity(existing.maxSeverity, flag.severity || 'MED');
      const updatedSession = {
        ...existing,
        flagCount: (existing.flagCount || 0) + 1,
        maxSeverity: nextSeverity,
        pulseAt: Date.now(),
      };

      newSessions = {
        ...state.sessions,
        [sessionId]: updatedSession,
      };
    }

    // Prepend to feed and cap at 100
    const newFeed = [flag, ...state.feed].slice(0, 100);

    set({
      sessions: newSessions,
      feed: newFeed,
      summary: computeSummary(newSessions),
    });
  },

  /**
   * Apply flag updates (e.g. verdict, review status, proctor note)
   */
  applyFlagUpdate: (updatedFlag) => {
    set((state) => ({
      feed: state.feed.map((f) => (f.id === updatedFlag.id ? { ...f, ...updatedFlag } : f)),
    }));
  },

  // Directly set summary statistics from exam:summary event
  setSummary: (summary) => {
    set((state) => ({
      summary: {
        ...state.summary,
        ...summary,
      },
    }));
  },

  // Set socket connection state
  setSocketConnected: (socketConnected) => set({ socketConnected }),

  // Reset store on unmount or navigation
  reset: () => {
    set({ ...initialState, feed: [] });
  },
}));

export default useLiveStore;
