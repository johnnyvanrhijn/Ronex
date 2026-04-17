import { useState, useEffect } from 'react';
import type { Task, Owner, Status, Priority } from '../lib/api';
import { updateTask, deleteTask } from '../lib/api';
import { OWNER_META, STATUS_META, PRIORITY_META } from '../lib/meta';

interface Props {
  task: Task;
  allTasks: Task[];
  onClose: () => void;
  onSave: () => void;
}

export function TaskModal({ task, allTasks, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<Task>({ ...task });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setDraft({ ...task });
  }, [task.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { id, completedAt, ...patch } = draft;
      await updateTask(task.id, patch);
      onSave();
      onClose();
    } catch (err) {
      alert('Failed to save: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    try {
      await deleteTask(task.id);
      onSave();
      onClose();
    } catch (err) {
      alert('Failed to delete: ' + (err as Error).message);
    }
  };

  const dependencyTasks = (draft.dependencies || [])
    .map((id) => allTasks.find((t) => t.id === id))
    .filter((t): t is Task => t !== undefined);

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-950/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-ink-700">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="font-mono text-xs text-ink-500 mb-2">{task.id}</div>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="w-full bg-transparent font-display text-xl font-semibold text-bone-50 focus:outline-none focus:text-lime-400"
              />
            </div>
            <button
              onClick={onClose}
              className="text-ink-500 hover:text-bone-50 text-xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-ink-700"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Status + Owner + Priority row */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Status">
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as Status })}
                className="select"
              >
                {(Object.keys(STATUS_META) as Status[]).map((s) => (
                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                ))}
              </select>
            </Field>
            <Field label="Owner">
              <select
                value={draft.owner}
                onChange={(e) => setDraft({ ...draft, owner: e.target.value as Owner })}
                className="select"
              >
                {(Object.keys(OWNER_META) as Owner[]).map((o) => (
                  <option key={o} value={o}>{OWNER_META[o].label}</option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select
                value={draft.priority || 'normal'}
                onChange={(e) => setDraft({ ...draft, priority: e.target.value as Priority })}
                className="select"
              >
                {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_META[p].label}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Estimate */}
          <Field label="Estimate (hours)">
            <input
              type="number"
              step="0.5"
              min="0"
              value={draft.estimateHours || ''}
              onChange={(e) =>
                setDraft({ ...draft, estimateHours: e.target.value ? parseFloat(e.target.value) : undefined })
              }
              className="input w-32"
            />
          </Field>

          {/* Description */}
          <Field label="Description">
            <textarea
              value={draft.description || ''}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              rows={3}
              className="input"
              placeholder="Optional context for this task..."
            />
          </Field>

          {/* Notes */}
          <Field label="Notes">
            <textarea
              value={draft.notes || ''}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={2}
              className="input"
              placeholder="Working notes, decisions, links..."
            />
          </Field>

          {/* Blocked reason */}
          {draft.status === 'blocked' && (
            <Field label="Why blocked?">
              <input
                type="text"
                value={draft.blockedReason || ''}
                onChange={(e) => setDraft({ ...draft, blockedReason: e.target.value })}
                className="input"
                placeholder="What's needed to unblock?"
              />
            </Field>
          )}

          {/* Dependencies */}
          <Field label={`Dependencies (${dependencyTasks.length})`}>
            <div className="space-y-1.5">
              {dependencyTasks.map((dep) => {
                const isDone = dep.status === 'done';
                return (
                  <div
                    key={dep.id}
                    className={`flex items-center gap-2 text-xs ${isDone ? 'opacity-60' : ''}`}
                  >
                    <span className="font-mono text-ink-500">{dep.id}</span>
                    <span className={isDone ? 'line-through text-ink-500' : 'text-bone-200'}>
                      {dep.title}
                    </span>
                    {!isDone && (
                      <span className="font-mono text-[10px] text-ruby-500">
                        ⚠ {STATUS_META[dep.status].label.toLowerCase()}
                      </span>
                    )}
                    <button
                      onClick={() =>
                        setDraft({
                          ...draft,
                          dependencies: draft.dependencies?.filter((d) => d !== dep.id) || [],
                        })
                      }
                      className="ml-auto text-ink-500 hover:text-ruby-500 text-xs"
                    >
                      remove
                    </button>
                  </div>
                );
              })}
              <DependencyAdder
                allTasks={allTasks}
                currentDeps={draft.dependencies || []}
                taskId={task.id}
                onAdd={(id) =>
                  setDraft({
                    ...draft,
                    dependencies: [...(draft.dependencies || []), id],
                  })
                }
              />
            </div>
          </Field>

          {/* Completed at */}
          {draft.completedAt && (
            <div className="text-xs text-ink-500 font-mono">
              Completed: {new Date(draft.completedAt).toLocaleString()}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-ink-700 flex items-center justify-between gap-3">
          <button
            onClick={handleDelete}
            className={`btn font-mono text-xs uppercase tracking-wider ${
              confirmDelete
                ? 'bg-ruby-500/20 text-ruby-500 border border-ruby-500/40'
                : 'btn-ghost text-ink-500 hover:text-ruby-500'
            }`}
          >
            {confirmDelete ? 'Tap again to confirm' : 'Delete task'}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary">
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          background: rgb(20 22 26);
          border: 1px solid rgb(42 46 53);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          color: rgb(250 250 247);
          font-size: 0.875rem;
        }
        .input:focus {
          outline: none;
          border-color: rgb(212 255 59);
        }
        .select {
          width: 100%;
          background: rgb(20 22 26);
          border: 1px solid rgb(42 46 53);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          color: rgb(250 250 247);
          font-size: 0.875rem;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-mono text-[10px] text-ink-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function DependencyAdder({
  allTasks,
  currentDeps,
  taskId,
  onAdd,
}: {
  allTasks: Task[];
  currentDeps: string[];
  taskId: string;
  onAdd: (id: string) => void;
}) {
  const available = allTasks.filter(
    (t) => t.id !== taskId && !currentDeps.includes(t.id)
  );

  return (
    <select
      value=""
      onChange={(e) => {
        if (e.target.value) onAdd(e.target.value);
      }}
      className="select text-xs mt-1"
    >
      <option value="">+ Add dependency...</option>
      {available.map((t) => (
        <option key={t.id} value={t.id}>
          {t.id} — {t.title.slice(0, 60)}
        </option>
      ))}
    </select>
  );
}
