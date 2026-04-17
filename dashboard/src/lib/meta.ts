import type { Owner, Status, Priority } from './api';

export const OWNER_META: Record<Owner, { label: string; color: string; ring: string; bg: string; symbol: string }> = {
  pm: {
    label: 'PM',
    color: 'text-amber-300',
    ring: 'ring-amber-500/40',
    bg: 'bg-amber-500/10',
    symbol: '◆',
  },
  designer: {
    label: 'Designer',
    color: 'text-violet-300',
    ring: 'ring-violet-500/40',
    bg: 'bg-violet-500/10',
    symbol: '▲',
  },
  backend: {
    label: 'Backend',
    color: 'text-cyan-300',
    ring: 'ring-cyan-500/40',
    bg: 'bg-cyan-500/10',
    symbol: '●',
  },
  copy: {
    label: 'Copy',
    color: 'text-rose-300',
    ring: 'ring-rose-500/40',
    bg: 'bg-rose-500/10',
    symbol: '✎',
  },
  tester: {
    label: 'Tester',
    color: 'text-emerald-300',
    ring: 'ring-emerald-500/40',
    bg: 'bg-emerald-500/10',
    symbol: '◉',
  },
};

export const STATUS_META: Record<Status, { label: string; color: string }> = {
  todo: { label: 'Todo', color: 'text-bone-200' },
  in_progress: { label: 'In progress', color: 'text-lime-400' },
  blocked: { label: 'Blocked', color: 'text-ruby-500' },
  done: { label: 'Done', color: 'text-ink-500' },
};

export const STATUS_COLUMNS: Status[] = ['todo', 'in_progress', 'blocked', 'done'];

export const PRIORITY_META: Record<Priority, { label: string; color: string; bar: string }> = {
  critical: { label: 'Critical', color: 'text-ruby-500', bar: 'bg-ruby-500' },
  high: { label: 'High', color: 'text-ember-500', bar: 'bg-ember-500' },
  normal: { label: 'Normal', color: 'text-bone-200', bar: 'bg-ink-600' },
  low: { label: 'Low', color: 'text-ink-500', bar: 'bg-ink-700' },
};
