import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TASKS_PATH = path.resolve(__dirname, '../../docs/tasks.json');
const BUGS_PATH = path.resolve(__dirname, '../../docs/BUGS.md');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- Helpers ---

async function readTasks() {
  const raw = await fs.readFile(TASKS_PATH, 'utf-8');
  return JSON.parse(raw);
}

async function writeTasks(data: any) {
  await fs.writeFile(TASKS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function findTask(data: any, taskId: string) {
  for (const phase of data.phases) {
    const task = phase.tasks.find((t: any) => t.id === taskId);
    if (task) return { task, phase };
  }
  return null;
}

function nextTaskId(data: any, phaseOrder: number): string {
  const phase = data.phases.find((p: any) => p.order === phaseOrder);
  if (!phase) throw new Error(`Phase ${phaseOrder} not found`);
  const ids = phase.tasks.map((t: any) => parseInt(t.id.split('-')[1], 10));
  const max = Math.max(...ids, phaseOrder * 100);
  return `T-${max + 1}`;
}

// --- Routes ---

app.get('/api/tasks', async (req, res) => {
  try {
    const data = await readTasks();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/tasks/:id', async (req, res) => {
  try {
    const data = await readTasks();
    const result = findTask(data, req.params.id);
    if (!result) return res.status(404).json({ error: 'Task not found' });

    Object.assign(result.task, req.body);
    if (req.body.status === 'done' && !result.task.completedAt) {
      result.task.completedAt = new Date().toISOString();
    }
    if (req.body.status && req.body.status !== 'done') {
      delete result.task.completedAt;
    }

    await writeTasks(data);
    res.json(result.task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const data = await readTasks();
    const phaseOrder = req.body.phaseOrder ?? 0;
    const phase = data.phases.find((p: any) => p.order === phaseOrder);
    if (!phase) return res.status(400).json({ error: 'Invalid phase' });

    const newTask = {
      id: nextTaskId(data, phaseOrder),
      title: req.body.title || 'New task',
      owner: req.body.owner || 'pm',
      status: 'todo',
      priority: req.body.priority || 'normal',
      dependencies: req.body.dependencies || [],
      estimateHours: req.body.estimateHours || 1,
      ...(req.body.description && { description: req.body.description }),
      ...(req.body.notes && { notes: req.body.notes }),
    };

    phase.tasks.push(newTask);
    await writeTasks(data);
    res.json(newTask);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const data = await readTasks();
    let removed = false;
    for (const phase of data.phases) {
      const idx = phase.tasks.findIndex((t: any) => t.id === req.params.id);
      if (idx >= 0) {
        phase.tasks.splice(idx, 1);
        removed = true;
        break;
      }
    }
    if (!removed) return res.status(404).json({ error: 'Task not found' });
    await writeTasks(data);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bugs', async (req, res) => {
  try {
    const raw = await fs.readFile(BUGS_PATH, 'utf-8');
    res.json({ markdown: raw });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- WebSocket for live updates ---

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected' }));
});

function broadcast(msg: any) {
  const payload = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(payload);
  });
}

// Watch tasks.json for external changes (e.g., agents updating it)
const watcher = chokidar.watch(TASKS_PATH, { ignoreInitial: true });
watcher.on('change', () => {
  broadcast({ type: 'tasks-changed' });
});

const PORT = 3002;
server.listen(PORT, () => {
  console.log(`\n  ✦ Ronex dashboard server running on http://localhost:${PORT}`);
  console.log(`  ✦ Watching ${TASKS_PATH}\n`);
});
