/**
 * Server-side state manager for grading events.
 * Maintains in-memory state and broadcasts to SSE clients.
 */

import { resolve } from 'path';

export interface GradingEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface Assignment {
  id: number;
  name: string;
  submissions: number;
  ungraded: number;
}

export interface Message {
  id: string;
  action: string;
  result: string;
  timestamp: string;
  failed: boolean;
}

export interface GradingState {
  currentOperation: string | null;
  assignments: Assignment[];
  submissions: Map<string, { status: string; error?: string }>;
  progress: { completed: number; total: number; failed: number };
  plagiarismMatches: Array<{ students: string[]; similarity: number; assignmentId: number }>;
  messages: Map<string, Message[]>;
  errors: string[];
  lastUpdated: string | null;
  workingDirectory: string;
  serverStartedAt: string;
}

// Get project root (parent of 'web' directory) and replace home dir with ~
const projectRoot = resolve(process.cwd(), '..').replace(process.env.HOME || '', '~');

// Server start time (set once when module loads)
const serverStartedAt = new Date().toISOString();

// In-memory state
const state: GradingState = {
  currentOperation: null,
  assignments: [],
  submissions: new Map(),
  progress: { completed: 0, total: 0, failed: 0 },
  plagiarismMatches: [],
  messages: new Map(),
  errors: [],
  lastUpdated: null,
  workingDirectory: projectRoot,
  serverStartedAt
};

// SSE clients - using a Set of controller callbacks
type SSEController = (event: GradingEvent) => void;
const sseClients = new Set<SSEController>();

export function getState(): GradingState {
  return { ...state };
}

export function getStateForClient(): Record<string, unknown> {
  // Convert messages Map to object with arrays
  const messagesObj: Record<string, Message[]> = {};
  for (const [key, msgs] of state.messages) {
    messagesObj[key] = msgs;
  }

  return {
    currentOperation: state.currentOperation,
    assignments: state.assignments,
    submissions: Object.fromEntries(state.submissions),
    progress: state.progress,
    plagiarismMatches: state.plagiarismMatches,
    messages: messagesObj,
    errors: state.errors,
    lastUpdated: state.lastUpdated,
    workingDirectory: state.workingDirectory,
    serverStartedAt: state.serverStartedAt
  };
}

export function registerClient(callback: SSEController): () => void {
  sseClients.add(callback);
  return () => sseClients.delete(callback);
}

export function broadcastEvent(event: GradingEvent): void {
  for (const client of sseClients) {
    try {
      client(event);
    } catch {
      // Client disconnected, will be cleaned up
    }
  }
}

export function handleEvent(event: GradingEvent): void {
  state.lastUpdated = event.timestamp;

  switch (event.type) {
    case 'list:start':
      state.currentOperation = 'list';
      state.assignments = [];
      // Reset all state for new grading session
      state.submissions.clear();
      state.messages.clear();
      state.plagiarismMatches = [];
      state.progress = { completed: 0, total: 0, failed: 0 };
      state.errors = [];
      break;

    case 'list:complete':
      state.currentOperation = null;
      state.assignments = (event.data.assignments as Assignment[]) || [];
      break;

    case 'clone:start':
      state.currentOperation = 'clone';
      state.progress = { completed: 0, total: event.data.total as number, failed: 0 };
      state.submissions.clear();
      break;

    case 'clone:progress': {
      const { student, assignmentId, status, error } = event.data as {
        student: string;
        assignmentId: number;
        status: string;
        error?: string;
      };
      const key = `${student}/${assignmentId}`;
      state.submissions.set(key, { status, error });

      if (status === 'done' || status === 'skipped') {
        state.progress.completed++;
      } else if (status === 'failed') {
        state.progress.failed++;
        state.progress.completed++;
      }
      break;
    }

    case 'clone:complete':
      state.currentOperation = null;
      break;

    case 'plagiarism:start':
      state.currentOperation = 'plagiarism';
      state.plagiarismMatches = [];
      break;

    case 'plagiarism:match': {
      const { students, similarity, assignmentId } = event.data as {
        students: string[];
        similarity: number;
        assignmentId: number;
      };
      state.plagiarismMatches.push({ students, similarity, assignmentId });
      break;
    }

    case 'plagiarism:complete':
      state.currentOperation = null;
      break;

    case 'submit:start':
      state.currentOperation = 'submit';
      state.progress = { completed: 0, total: event.data.total as number, failed: 0 };
      break;

    case 'submit:progress': {
      const { student, assignmentId, status, error } = event.data as {
        student: string;
        assignmentId: number;
        status: string;
        error?: string;
      };
      const key = `${student}/${assignmentId}`;
      state.submissions.set(key, { status, error });

      if (status === 'done') {
        state.progress.completed++;
      } else if (status === 'error') {
        state.progress.failed++;
        state.progress.completed++;
      }
      break;
    }

    case 'submit:complete':
      state.currentOperation = null;
      break;

    case 'list:error':
    case 'clone:error':
    case 'plagiarism:error':
    case 'submit:error':
      state.currentOperation = null;
      state.errors.push(event.data.message as string);
      break;

    case 'submission:message': {
      const { submissionKey, action, result, failed } = event.data as {
        submissionKey: string;
        action: string;
        result: string;
        failed?: boolean;
      };
      const message: Message = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        action,
        result: result || '',
        timestamp: event.timestamp,
        failed: failed || false
      };
      if (!state.messages.has(submissionKey)) {
        state.messages.set(submissionKey, []);
      }
      state.messages.get(submissionKey)!.push(message);
      break;
    }
  }

  // Broadcast the event to all SSE clients
  broadcastEvent(event);
}
