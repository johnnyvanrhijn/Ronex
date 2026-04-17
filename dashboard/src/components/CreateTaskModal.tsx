import { useState } from 'react';
import type { Task, Owner, Priority } from '../lib/api';
import { createTask } from '../lib/api';
import { OWNER_META, PRIORITY_META } from '../lib/meta';

interface Props {
  phaseOrder: number;
  allTasks: Task[];
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTaskModal({ phaseOrder, allTasks, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState<Owner>('pm');
  const [priority, setPriority] = useState<Priority>('normal');
  const [estimateHours, setEstimateHours] = useState<number>(1);
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      await createTask({
        phaseOrder,
        title: title.trim(),
        owner,
        priority,
        estimateHours,
        description: description.trim() || undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      alert('Failed to create: ' + (err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-950/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-ink-700 flex items-center justify-between">
          <div>
            <div className="font-mono text-xs text-ink-500 mb-1">
              PHASE {String(phaseOrder).padStart(2, '0')}
            </div>
            <h2 className="font-display text-lg font-semibold">New task</h2>
          </div>
          <button
            onClick={onClose}
            className="text-ink-500 hover:text-bone-50 text-xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-ink-700"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block font-mono text-[10px] text-ink-500 uppercase tracking-wider mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              placeholder="What needs to be done?"
              className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-bone-50 font-display focus:outline-none focus:border-lime-400"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-mono text-[10px] text-ink-500 uppercase tracking-wider mb-1.5">
                Owner
              </label>
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value as Owner)}
                className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2 text-bone-50 text-sm cursor-pointer focus:outline-none focus:border-lime-400"
              >
                {(Object.keys(OWNER_META) as Owner[]).map((o) => (
                  <option key={o} value={o}>{OWNER_META[o].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[10px] text-ink-500 uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2 text-bone-50 text-sm cursor-pointer focus:outline-none focus:border-lime-400"
              >
                {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_META[p].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[10px] text-ink-500 uppercase tracking-wider mb-1.5">
                Estimate (h)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={estimateHours}
                onChange={(e) => setEstimateHours(parseFloat(e.target.value) || 0)}
                className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2 text-bone-50 text-sm focus:outline-none focus:border-lime-400"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-[10px] text-ink-500 uppercase tracking-wider mb-1.5">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2 text-bone-50 text-sm focus:outline-none focus:border-lime-400"
            />
          </div>
        </div>

        <div className="p-6 border-t border-ink-700 flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || creating}
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : 'Create task'}
          </button>
        </div>
      </div>
    </div>
  );
}
