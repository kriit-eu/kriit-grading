import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export interface Assignment {
  id: number;
  name: string;
  submissions: number;
  ungraded: number;
}

export interface GradingState {
  currentOperation: string | null;
  assignments: Assignment[];
  submissions: Record<string, { status: string; error?: string }>;
  progress: { completed: number; total: number; failed: number };
  plagiarismMatches: Array<{ students: string[]; similarity: number; assignmentId: number }>;
  errors: string[];
  connected: boolean;
  lastUpdated: string | null;
}

const initialState: GradingState = {
  currentOperation: null,
  assignments: [],
  submissions: {},
  progress: { completed: 0, total: 0, failed: 0 },
  plagiarismMatches: [],
  errors: [],
  connected: false,
  lastUpdated: null
};

function createGradingStore() {
  const { subscribe, set, update } = writable<GradingState>(initialState);

  let eventSource: EventSource | null = null;

  return {
    subscribe,

    connect() {
      if (!browser) return;
      if (eventSource) return; // Already connected

      eventSource = new EventSource('/api/events');

      eventSource.onopen = () => {
        update(s => ({ ...s, connected: true }));
      };

      eventSource.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          this.handleEvent(event);
        } catch (error) {
          console.error('Failed to parse SSE event:', error);
        }
      };

      eventSource.onerror = () => {
        update(s => ({ ...s, connected: false }));
        // EventSource will auto-reconnect
      };
    },

    disconnect() {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
        update(s => ({ ...s, connected: false }));
      }
    },

    handleEvent(event: { type: string; data: Record<string, unknown>; timestamp: string }) {
      update(s => {
        const newState = { ...s, lastUpdated: event.timestamp };

        switch (event.type) {
          case 'state:full':
            return {
              ...newState,
              currentOperation: event.data.currentOperation as string | null,
              assignments: event.data.assignments as Assignment[],
              submissions: event.data.submissions as Record<string, { status: string; error?: string }>,
              progress: event.data.progress as { completed: number; total: number; failed: number },
              plagiarismMatches: event.data.plagiarismMatches as Array<{ students: string[]; similarity: number; assignmentId: number }>,
              errors: event.data.errors as string[],
              connected: true
            };

          case 'list:start':
            return { ...newState, currentOperation: 'list', assignments: [] };

          case 'list:complete':
            return {
              ...newState,
              currentOperation: null,
              assignments: event.data.assignments as Assignment[]
            };

          case 'clone:start':
            return {
              ...newState,
              currentOperation: 'clone',
              progress: { completed: 0, total: event.data.total as number, failed: 0 },
              submissions: {}
            };

          case 'clone:progress': {
            const { student, assignmentId, status, error } = event.data as {
              student: string;
              assignmentId: number;
              status: string;
              error?: string;
            };
            const key = `${student}/${assignmentId}`;
            const submissions = { ...newState.submissions, [key]: { status, error } };
            const progress = { ...newState.progress };

            if (status === 'done' || status === 'skipped') {
              progress.completed++;
            } else if (status === 'failed') {
              progress.failed++;
              progress.completed++;
            }

            return { ...newState, submissions, progress };
          }

          case 'clone:complete':
            return { ...newState, currentOperation: null };

          case 'plagiarism:start':
            return { ...newState, currentOperation: 'plagiarism', plagiarismMatches: [] };

          case 'plagiarism:match': {
            const { students, similarity, assignmentId } = event.data as {
              students: string[];
              similarity: number;
              assignmentId: number;
            };
            return {
              ...newState,
              plagiarismMatches: [...newState.plagiarismMatches, { students, similarity, assignmentId }]
            };
          }

          case 'plagiarism:complete':
            return { ...newState, currentOperation: null };

          case 'submit:start':
            return {
              ...newState,
              currentOperation: 'submit',
              progress: { completed: 0, total: event.data.total as number, failed: 0 }
            };

          case 'submit:progress': {
            const { student, assignmentId, status, error } = event.data as {
              student: string;
              assignmentId: number;
              status: string;
              error?: string;
            };
            const key = `${student}/${assignmentId}`;
            const submissions = { ...newState.submissions, [key]: { status, error } };
            const progress = { ...newState.progress };

            if (status === 'done') {
              progress.completed++;
            } else if (status === 'error') {
              progress.failed++;
              progress.completed++;
            }

            return { ...newState, submissions, progress };
          }

          case 'submit:complete':
            return { ...newState, currentOperation: null };

          case 'list:error':
          case 'clone:error':
          case 'plagiarism:error':
          case 'submit:error':
            return {
              ...newState,
              currentOperation: null,
              errors: [...newState.errors, event.data.message as string]
            };

          default:
            return newState;
        }
      });
    },

    reset() {
      set(initialState);
    }
  };
}

export const gradingStore = createGradingStore();

// Derived stores for convenience
export const progressPercent = derived(
  gradingStore,
  $s => $s.progress.total > 0 ? ($s.progress.completed / $s.progress.total) * 100 : 0
);

export const isOperationRunning = derived(
  gradingStore,
  $s => $s.currentOperation !== null
);

export const totalSubmissions = derived(
  gradingStore,
  $s => $s.assignments.reduce((sum, a) => sum + a.submissions, 0)
);

export const totalUngraded = derived(
  gradingStore,
  $s => $s.assignments.reduce((sum, a) => sum + a.ungraded, 0)
);
