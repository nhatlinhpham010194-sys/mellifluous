import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  initDataStore,
  getAllStories,
  saveStory,
  deleteStory,
  getChaptersByStory,
  getAllChaptersMap,
  saveChapter,
  deleteChapter,
  getAllAnnouncements,
  saveAnnouncement,
} from './server/dataStore';

const PORT = 3000;
const app = express();

// Middleware
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Initialize persistent server data store
initDataStore();

// SSE Clients for instant real-time synchronization across all devices
interface SSEClient {
  id: string;
  res: Response;
}
let sseClients: SSEClient[] = [];

const broadcastEvent = (eventType: string, payload: any) => {
  const data = JSON.stringify({ type: eventType, payload, timestamp: Date.now() });
  sseClients.forEach((client) => {
    try {
      client.res.write(`data: ${data}\n\n`);
    } catch {
      // Failed client will be pruned on next tick
    }
  });
};

// Periodic heartbeat for SSE to keep connections active through proxies
setInterval(() => {
  sseClients.forEach((client) => {
    try {
      client.res.write(': heartbeat\n\n');
    } catch {
      // Ignored
    }
  });
}, 20000);

// ==========================================
// API ROUTES
// ==========================================

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    serverTime: new Date().toISOString(),
    connectedClients: sseClients.length,
  });
});

// Full state sync endpoint
app.get('/api/sync', (req: Request, res: Response) => {
  res.json({
    stories: getAllStories(),
    chapters: getAllChaptersMap(),
    announcements: getAllAnnouncements(),
    timestamp: Date.now(),
  });
});

// Realtime SSE endpoint
app.get('/api/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const newClient: SSEClient = { id: clientId, res };
  sseClients.push(newClient);

  // Send initial welcome
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});

// --- Stories API ---
app.get('/api/stories', (req: Request, res: Response) => {
  const stories = getAllStories();
  res.json(stories);
});

app.post('/api/stories', (req: Request, res: Response) => {
  try {
    const story = req.body;
    if (!story || !story.id || !story.title) {
      res.status(400).json({ error: 'Missing story ID or title' });
      return;
    }
    const saved = saveStory(story);
    broadcastEvent('story_saved', saved);
    res.json({ success: true, story: saved });
  } catch (err: any) {
    console.error('Error saving story:', err);
    res.status(500).json({ error: err.message || 'Failed to save story' });
  }
});

app.delete('/api/stories/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    deleteStory(id);
    broadcastEvent('story_deleted', { id });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting story:', err);
    res.status(500).json({ error: err.message || 'Failed to delete story' });
  }
});

// --- Chapters API ---
app.get('/api/chapters', (req: Request, res: Response) => {
  const { storyId } = req.query;
  if (storyId && typeof storyId === 'string') {
    const chapters = getChaptersByStory(storyId);
    res.json(chapters);
  } else {
    const allChapters = getAllChaptersMap();
    res.json(allChapters);
  }
});

app.post('/api/chapters', (req: Request, res: Response) => {
  try {
    const chapter = req.body;
    if (!chapter || !chapter.id || !chapter.storyId || !chapter.title) {
      res.status(400).json({ error: 'Missing chapter ID, story ID, or title' });
      return;
    }
    const saved = saveChapter(chapter);
    broadcastEvent('chapter_saved', saved);
    res.json({ success: true, chapter: saved });
  } catch (err: any) {
    console.error('Error saving chapter:', err);
    res.status(500).json({ error: err.message || 'Failed to save chapter' });
  }
});

app.delete('/api/chapters/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { storyId } = req.query;
    if (!storyId || typeof storyId !== 'string') {
      res.status(400).json({ error: 'Missing storyId query parameter' });
      return;
    }
    deleteChapter(storyId, id);
    broadcastEvent('chapter_deleted', { id, storyId });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting chapter:', err);
    res.status(500).json({ error: err.message || 'Failed to delete chapter' });
  }
});

// --- Announcements API ---
app.get('/api/announcements', (req: Request, res: Response) => {
  res.json(getAllAnnouncements());
});

app.post('/api/announcements', (req: Request, res: Response) => {
  try {
    const ann = req.body;
    const saved = saveAnnouncement(ann);
    broadcastEvent('announcement_saved', saved);
    res.json({ success: true, announcement: saved });
  } catch (err: any) {
    console.error('Error saving announcement:', err);
    res.status(500).json({ error: err.message || 'Failed to save announcement' });
  }
});

// ==========================================
// VITE OR STATIC FRONTEND SERVING
// ==========================================
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌸 Mellifluous server running on http://0.0.0.0:${PORT}`);
  });
}

start();
