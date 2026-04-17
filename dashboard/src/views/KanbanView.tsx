import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { TasksData, Task, Status } from '../lib/api';
import { updateTask } from '../lib/api';
import { STATUS_COLUMNS, STATUS_META } from '../lib/meta';
import { TaskCard } from '../components/TaskCard';

interface Props {
  data: TasksData;
  filterOwner: string | null;
  filterPhase: string | null;
  onTaskClick: (t: Task) => void;
  onAddTaskClick: (phaseOrder: number) => void;
  onTasksChange: () => void;
}

export function KanbanView({
  data,
  filterOwner,
  filterPhase,
  onTaskClick,
  onAddTaskClick,
  onTasksChange,
}: Props) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const allTasks = useMemo(
    () => data.phases.flatMap((p) => p.tasks),
    [data]
  );

  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => {
      if (filterOwner && t.owner !== filterOwner) return false;
      if (filterPhase) {
        const phase = data.phases.find((p) => p.tasks.includes(t));
        if (phase?.id !== filterPhase) return false;
      }
      return true;
    });
  }, [allTasks, filterOwner, filterPhase, data.phases]);

  const tasksByStatus = useMemo(() => {
    const map: Record<Status, Task[]> = {
      todo: [],
      in_progress: [],
      blocked: [],
      done: [],
    };
    filteredTasks.forEach((t) => map[t.status].push(t));
    return map;
  }, [filteredTasks]);

  const handleDragStart = (e: DragStartEvent) => {
    const task = allTasks.find((t) => t.id === e.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveTask(null);
    if (!e.over) return;
    const taskId = e.active.id as string;
    const newStatus = e.over.id as Status;
    const task = allTasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    try {
      await updateTask(taskId, { status: newStatus });
      onTasksChange();
    } catch (err) {
      console.error('Failed to update task', err);
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATUS_COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            allTasks={allTasks}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>

      {/* Add task quick button */}
      <div className="mt-6 flex items-center gap-2">
        <span className="font-mono text-xs text-ink-500 uppercase tracking-wider">
          Quick add task to:
        </span>
        {data.phases.map((p) => (
          <button
            key={p.id}
            onClick={() => onAddTaskClick(p.order)}
            className="font-mono text-xs px-2 py-1 rounded bg-ink-800 hover:bg-ink-700 text-ink-500 hover:text-bone-200 border border-ink-700 transition-colors"
          >
            +{String(p.order).padStart(2, '0')}
          </button>
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="drag-overlay">
            <TaskCard task={activeTask} allTasks={allTasks} compact />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  status,
  tasks,
  allTasks,
  onTaskClick,
}: {
  status: Status;
  tasks: Task[];
  allTasks: Task[];
  onTaskClick: (t: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = STATUS_META[status];

  return (
    <div
      ref={setNodeRef}
      className={`card p-3 transition-colors ${
        isOver ? 'ring-2 ring-lime-400/40 bg-ink-800/80' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`font-display font-semibold text-sm ${meta.color}`}>
            {meta.label}
          </span>
          <span className="font-mono text-xs text-ink-500 tabular-nums">
            {tasks.length}
          </span>
        </div>
      </div>
      <div className="space-y-2 min-h-[100px]">
        {tasks.map((task) => (
          <DraggableTask
            key={task.id}
            task={task}
            allTasks={allTasks}
            onClick={() => onTaskClick(task)}
          />
        ))}
        {tasks.length === 0 && (
          <div className="py-6 text-center text-ink-500 text-xs italic">empty</div>
        )}
      </div>
    </div>
  );
}

function DraggableTask({
  task,
  allTasks,
  onClick,
}: {
  task: Task;
  allTasks: Task[];
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });

  return (
    <div ref={setNodeRef} {...attributes} {...listeners}>
      <TaskCard task={task} allTasks={allTasks} onClick={onClick} isDragging={isDragging} />
    </div>
  );
}
