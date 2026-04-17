import type { Task } from '../lib/api';
import { OWNER_META, PRIORITY_META } from '../lib/meta';
import { isUnblocked } from '../lib/api';

interface Props {
  task: Task;
  allTasks: Task[];
  onClick?: () => void;
  isDragging?: boolean;
  compact?: boolean;
}

export function TaskCard({ task, allTasks, onClick, isDragging, compact }: Props) {
  const owner = OWNER_META[task.owner];
  const prio = task.priority ? PRIORITY_META[task.priority] : null;
  const blocked = task.status === 'blocked' || !isUnblocked(task, allTasks);
  const isDone = task.status === 'done';

  return (
    <div
      onClick={onClick}
      className={`group p-3 rounded-lg border transition-all cursor-pointer
        ${
          isDone
            ? 'bg-ink-900/50 border-ink-800 opacity-60'
            : 'bg-ink-800 border-ink-700 hover:border-ink-600 hover:shadow-lg'
        }
        ${isDragging ? 'opacity-40' : ''}
      `}
    >
      <div className="flex items-start gap-2">
        {/* Priority bar */}
        {prio && task.priority !== 'normal' && (
          <div className={`w-0.5 self-stretch rounded-full ${prio.bar} shrink-0`} />
        )}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div
            className={`font-display font-medium text-sm leading-snug ${
              isDone ? 'text-ink-500 line-through' : 'text-bone-50'
            }`}
          >
            {task.title}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span
              className={`pill ${owner.bg} ${owner.color} ring-1 ${owner.ring}`}
            >
              <span>{owner.symbol}</span>
              <span>{owner.label}</span>
            </span>

            {!compact && (
              <span className="font-mono text-[10px] text-ink-500">{task.id}</span>
            )}

            {task.estimateHours && !compact && (
              <span className="font-mono text-[10px] text-ink-500">
                ~{task.estimateHours}h
              </span>
            )}

            {blocked && task.status !== 'done' && (
              <span className="pill bg-ruby-500/10 text-ruby-500 ring-1 ring-ruby-500/30">
                ⚠ blocked
              </span>
            )}

            {task.dependencies && task.dependencies.length > 0 && !compact && (
              <span className="font-mono text-[10px] text-ink-500">
                ↳ {task.dependencies.length} dep{task.dependencies.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Notes preview */}
          {task.notes && !compact && (
            <div className="mt-2 text-xs text-ink-500 line-clamp-2 italic">
              {task.notes}
            </div>
          )}

          {/* Blocked reason */}
          {task.status === 'blocked' && task.blockedReason && (
            <div className="mt-2 text-xs text-ruby-500/80 italic">
              {task.blockedReason}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
