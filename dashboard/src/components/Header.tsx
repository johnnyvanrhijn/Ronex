import type { Phase, Project } from '../lib/api';
import { OWNER_META } from '../lib/meta';

type View = 'kanban' | 'list' | 'timeline';

interface Props {
  project: Project;
  progress: { done: number; total: number; percent: number };
  currentPhase: Phase | null;
  view: View;
  onViewChange: (v: View) => void;
  filterOwner: string | null;
  onFilterOwnerChange: (v: string | null) => void;
  filterPhase: string | null;
  onFilterPhaseChange: (v: string | null) => void;
  phases: Phase[];
}

export function Header({
  project,
  progress,
  currentPhase,
  view,
  onViewChange,
  filterOwner,
  onFilterOwnerChange,
  filterPhase,
  onFilterPhaseChange,
  phases,
}: Props) {
  return (
    <header className="border-b border-ink-800 bg-ink-900/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-[1600px] mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          {/* Left: brand + project */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-lime-400 rounded-md flex items-center justify-center font-display font-bold text-ink-950">
                R
              </div>
              <div>
                <div className="font-display text-lg font-semibold tracking-tight leading-none">
                  {project.name}
                </div>
                <div className="font-mono text-[10px] text-ink-500 tracking-widest mt-0.5">
                  COCKPIT
                </div>
              </div>
            </div>
            <div className="h-8 w-px bg-ink-700" />
            <div className="text-sm">
              <span className="text-ink-500 font-mono text-xs uppercase tracking-wider mr-2">
                Phase
              </span>
              <span className="font-display font-medium">
                {currentPhase?.name || 'Complete'}
              </span>
            </div>
          </div>

          {/* Right: progress + view switcher */}
          <div className="flex items-center gap-6">
            {/* Progress */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="font-display text-2xl font-semibold leading-none tabular-nums">
                  {progress.percent}%
                </div>
                <div className="font-mono text-[10px] text-ink-500 mt-1 tracking-wider">
                  {progress.done}/{progress.total} TASKS
                </div>
              </div>
              <div className="w-32 h-2 bg-ink-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-lime-400 rounded-full transition-all duration-500"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <select
                className="bg-ink-800 border border-ink-700 rounded-md px-2 py-1.5 text-xs font-mono text-bone-200 cursor-pointer hover:border-ink-600"
                value={filterOwner || ''}
                onChange={(e) => onFilterOwnerChange(e.target.value || null)}
              >
                <option value="">ALL OWNERS</option>
                {Object.entries(OWNER_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label.toUpperCase()}
                  </option>
                ))}
              </select>
              <select
                className="bg-ink-800 border border-ink-700 rounded-md px-2 py-1.5 text-xs font-mono text-bone-200 cursor-pointer hover:border-ink-600"
                value={filterPhase || ''}
                onChange={(e) => onFilterPhaseChange(e.target.value || null)}
              >
                <option value="">ALL PHASES</option>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.order}. {p.name.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* View switcher */}
            <div className="flex items-center bg-ink-800 border border-ink-700 rounded-lg p-0.5">
              {(['kanban', 'list', 'timeline'] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => onViewChange(v)}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-colors ${
                    view === v
                      ? 'bg-ink-700 text-bone-50'
                      : 'text-ink-500 hover:text-bone-200'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
