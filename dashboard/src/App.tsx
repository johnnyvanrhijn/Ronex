import { useEffect, useMemo, useState } from 'react';
import {
  fetchTasks,
  subscribeToChanges,
  totalProgress,
  currentPhase,
  suggestNext,
  type TasksData,
  type Task,
} from './lib/api';
import { Header } from './components/Header';
import { Cockpit } from './components/Cockpit';
import { KanbanView } from './views/KanbanView';
import { ListView } from './views/ListView';
import { TimelineView } from './views/TimelineView';
import { TaskModal } from './components/TaskModal';
import { CreateTaskModal } from './components/CreateTaskModal';

type View = 'kanban' | 'list' | 'timeline';

export function App() {
  const [data, setData] = useState<TasksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('kanban');
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [createInPhase, setCreateInPhase] = useState<number | null>(null);
  const [filterOwner, setFilterOwner] = useState<string | null>(null);
  const [filterPhase, setFilterPhase] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const fresh = await fetchTasks();
      setData(fresh);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const unsub = subscribeToChanges(() => refresh());
    return unsub;
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    return {
      total: totalProgress(data),
      currentPhase: currentPhase(data),
      suggested: suggestNext(data),
    };
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-ink-500 font-mono text-sm tracking-wider">LOADING...</div>
      </div>
    );
  }

  if (error || !data || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-ruby-500 font-mono text-sm">
          {error || 'Could not load tasks.json'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        project={data.project}
        progress={stats.total}
        currentPhase={stats.currentPhase}
        view={view}
        onViewChange={setView}
        filterOwner={filterOwner}
        onFilterOwnerChange={setFilterOwner}
        filterPhase={filterPhase}
        onFilterPhaseChange={setFilterPhase}
        phases={data.phases}
      />

      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <Cockpit
          data={data}
          suggested={stats.suggested}
          onTaskClick={setEditTask}
        />

        <div className="mt-8">
          {view === 'kanban' && (
            <KanbanView
              data={data}
              filterOwner={filterOwner}
              filterPhase={filterPhase}
              onTaskClick={setEditTask}
              onAddTaskClick={setCreateInPhase}
              onTasksChange={refresh}
            />
          )}
          {view === 'list' && (
            <ListView
              data={data}
              filterOwner={filterOwner}
              filterPhase={filterPhase}
              onTaskClick={setEditTask}
              onAddTaskClick={setCreateInPhase}
            />
          )}
          {view === 'timeline' && (
            <TimelineView
              data={data}
              filterOwner={filterOwner}
              onTaskClick={setEditTask}
            />
          )}
        </div>
      </main>

      {editTask && (
        <TaskModal
          task={editTask}
          allTasks={data.phases.flatMap((p) => p.tasks)}
          onClose={() => setEditTask(null)}
          onSave={refresh}
        />
      )}

      {createInPhase !== null && (
        <CreateTaskModal
          phaseOrder={createInPhase}
          allTasks={data.phases.flatMap((p) => p.tasks)}
          onClose={() => setCreateInPhase(null)}
          onCreated={refresh}
        />
      )}
    </div>
  );
}
