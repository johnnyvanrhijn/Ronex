export type Owner = 'pm' | 'designer' | 'backend' | 'copy' | 'tester';
export type Status = 'todo' | 'in_progress' | 'blocked' | 'done';
export type Priority = 'low' | 'normal' | 'high' | 'critical';

export interface Task {
  id: string;
  title: string;
  description?: string;
  owner: Owner;
  status: Status;
  priority?: Priority;
  dependencies?: string[];
  estimateHours?: number;
  blockedReason?: string;
  notes?: string;
  completedAt?: string;
}

export interface Phase {
  id: string;
  name: string;
  order: number;
  goal: string;
  estimatedWeeks?: number;
  exitCriteria?: string;
  tasks: Task[];
}

export interface Project {
  name: string;
  startDate: string;
  targetLaunchDate: string;
  currentPhase?: string;
}

export interface TasksData {
  project: Project;
  phases: Phase[];
}

const BASE = '/api';

export async function fetchTasks(): Promise<TasksData> {
  const r = await fetch(`${BASE}/tasks`);
  if (!r.ok) throw new Error('Failed to fetch tasks');
  return r.json();
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<Task> {
  const r = await fetch(`${BASE}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error('Failed to update task');
  return r.json();
}

export async function createTask(input: {
  phaseOrder: number;
  title: string;
  owner: Owner;
  priority?: Priority;
  dependencies?: string[];
  estimateHours?: number;
  description?: string;
  notes?: string;
}): Promise<Task> {
  const r = await fetch(`${BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error('Failed to create task');
  return r.json();
}

export async function deleteTask(id: string): Promise<void> {
  const r = await fetch(`${BASE}/tasks/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error('Failed to delete task');
}

export function subscribeToChanges(onChange: () => void): () => void {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'tasks-changed') onChange();
    } catch {}
  };
  return () => ws.close();
}

// --- Computed helpers ---

export function isUnblocked(task: Task, allTasks: Task[]): boolean {
  if (!task.dependencies || task.dependencies.length === 0) return true;
  return task.dependencies.every((depId) => {
    const dep = allTasks.find((t) => t.id === depId);
    return dep?.status === 'done';
  });
}

export function suggestNext(data: TasksData): Task[] {
  const allTasks = data.phases.flatMap((p) => p.tasks);
  // Find current phase = first phase with non-done tasks
  const currentPhase = data.phases.find((p) =>
    p.tasks.some((t) => t.status !== 'done')
  );
  if (!currentPhase) return [];

  const candidates = currentPhase.tasks.filter(
    (t) => (t.status === 'todo' || t.status === 'in_progress') && isUnblocked(t, allTasks)
  );

  const priorityRank: Record<Priority, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
  };

  return candidates
    .sort((a, b) => {
      const pa = priorityRank[a.priority || 'normal'];
      const pb = priorityRank[b.priority || 'normal'];
      if (pa !== pb) return pa - pb;
      return a.id.localeCompare(b.id);
    })
    .slice(0, 5);
}

export function phaseProgress(phase: Phase): { done: number; total: number; percent: number } {
  const total = phase.tasks.length;
  const done = phase.tasks.filter((t) => t.status === 'done').length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function totalProgress(data: TasksData): { done: number; total: number; percent: number } {
  const all = data.phases.flatMap((p) => p.tasks);
  const total = all.length;
  const done = all.filter((t) => t.status === 'done').length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function currentPhase(data: TasksData): Phase | null {
  return data.phases.find((p) => p.tasks.some((t) => t.status !== 'done')) || null;
}
