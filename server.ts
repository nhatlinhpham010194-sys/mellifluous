import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import {
  initDataStore,
  getAllStories,
  getStoryById,
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

// Ensure audio upload directory exists
const AUDIO_UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads', 'audio');
try {
  fs.mkdirSync(AUDIO_UPLOAD_DIR, { recursive: true });
} catch (err) {
  console.warn('Audio upload dir creation note:', err);
}

// Global CORS & Range Headers for Seamless Audio Playback
app.use((req: Request, res: Response, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Middleware with generous limit for audio uploads
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

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

app.post('/api/sync', (req: Request, res: Response) => {
  try {
    const { stories, chapters, deletedStoryIds, deletedChapterIds } = req.body;
    if (Array.isArray(stories) && stories.length > 0) {
      stories.forEach((s) => saveStory(s));
      broadcastEvent('stories_synced', { count: stories.length });
    }
    if (chapters && typeof chapters === 'object') {
      for (const [sId, list] of Object.entries(chapters)) {
        if (Array.isArray(list)) {
          list.forEach((c: any) => saveChapter(c));
        }
      }
      broadcastEvent('chapters_synced', { count: Object.keys(chapters).length });
    }
    if (Array.isArray(deletedStoryIds)) {
      deletedStoryIds.forEach((id: string) => deleteStory(id));
      broadcastEvent('story_deleted', { ids: deletedStoryIds });
    }
    if (Array.isArray(deletedChapterIds)) {
      deletedChapterIds.forEach(({ storyId, chapterId }: any) => {
        if (storyId && chapterId) deleteChapter(storyId, chapterId);
      });
    }
    res.json({ success: true, timestamp: Date.now() });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Sync failed' });
  }
});

// Active readers endpoint
app.get('/api/active-readers', (req: Request, res: Response) => {
  res.json({ count: Math.max(1, sseClients.length) });
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

  // Send initial welcome & current active readers count
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);
  broadcastEvent('active_readers', { count: Math.max(1, sseClients.length) });

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c.id !== clientId);
    broadcastEvent('active_readers', { count: Math.max(1, sseClients.length) });
  });
});

// --- Stories API ---
app.get('/api/stories', (req: Request, res: Response) => {
  const stories = getAllStories();
  res.json(stories);
});

app.get('/api/stories/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const story = getStoryById(id);
  if (!story) {
    res.status(404).json({ error: 'Story not found' });
    return;
  }
  const chapters = getChaptersByStory(story.id);
  res.json({ story, chapters });
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

// --- Audio Upload, Streaming & Proxy API ---

// 1. Audio Upload Endpoint (supports MP3, M4A, WAV, OGG, AAC, FLAC up to 50MB)
app.post('/api/upload-audio', (req: Request, res: Response) => {
  try {
    const { filename, data, mimeType } = req.body;
    if (!filename || !data) {
      res.status(400).json({ error: 'Missing filename or audio data' });
      return;
    }

    // Strip base64 data prefix if present (e.g. data:audio/mp3;base64,...)
    const base64Data = data.includes(';base64,') ? data.split(';base64,')[1] : data;
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length === 0) {
      res.status(400).json({ error: 'Uploaded audio file is empty' });
      return;
    }

    // Sanitize filename and create unique storage name
    const ext = path.extname(filename) || '.mp3';
    const baseName = path.basename(filename, ext).replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1EA0-\u1EF9]/g, '_').substring(0, 50);
    const uniqueName = `${Date.now()}_${baseName}${ext}`;
    const filePath = path.join(AUDIO_UPLOAD_DIR, uniqueName);

    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/api/audio/${uniqueName}`;
    console.log(`🎵 Audio uploaded successfully: ${uniqueName} (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`);

    res.json({
      success: true,
      url: publicUrl,
      filename: uniqueName,
      originalName: filename,
      sizeBytes: buffer.length,
      mimeType: mimeType || 'audio/mpeg',
    });
  } catch (err: any) {
    console.error('Error in /api/upload-audio:', err);
    res.status(500).json({ error: err.message || 'Failed to process audio upload' });
  }
});

// 2. Audio Streaming Endpoint with Native Range / 206 Partial Content support for smooth seeking
app.get('/api/audio/:filename', (req: Request, res: Response) => {
  try {
    const rawFilename = path.basename(req.params.filename);
    const filePath = path.join(AUDIO_UPLOAD_DIR, rawFilename);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Audio file not found' });
      return;
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Detect MIME type by extension
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.aac': 'audio/aac',
      '.flac': 'audio/flac',
      '.webm': 'audio/webm',
    };
    const contentType = mimeMap[ext] || 'audio/mpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (range) {
      // Parse Range header (e.g. "bytes=1048576-")
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize || start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
        return;
      }

      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunkSize);
      fileStream.pipe(res);
    } else {
      res.status(200);
      res.setHeader('Content-Length', fileSize);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err: any) {
    console.error('Error serving audio:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error streaming audio file' });
    }
  }
});

// 3. Audio Proxy for Google Drive & external streams to enable direct HTMLAudioElement playback & seeking
app.get('/api/proxy-audio', async (req: Request, res: Response) => {
  try {
    const rawUrl = req.query.url;
    if (!rawUrl || typeof rawUrl !== 'string') {
      res.status(400).send('Missing url parameter');
      return;
    }

    let targetUrl = rawUrl.trim();

    // Convert Google Drive links to direct drive.usercontent stream link
    const gDriveMatch = targetUrl.match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+)|uc\?(?:export=[a-z]+&)?id=([a-zA-Z0-9_-]+))/i);
    const gDriveId = gDriveMatch ? (gDriveMatch[1] || gDriveMatch[2] || gDriveMatch[3]) : null;
    if (gDriveId) {
      targetUrl = `https://drive.usercontent.google.com/download?id=${gDriveId}&export=download`;
    }

    // Convert Dropbox links to raw stream
    if (targetUrl.includes('dropbox.com')) {
      targetUrl = targetUrl.replace(/[?&]dl=[01]/g, '').replace(/[?&]raw=[01]/g, '');
      targetUrl += targetUrl.includes('?') ? '&raw=1' : '?raw=1';
    }

    // Forward range header if present for seek support
    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };
    if (req.headers.range) {
      fetchHeaders['range'] = req.headers.range;
    }

    const response = await fetch(targetUrl, {
      headers: fetchHeaders,
      redirect: 'follow',
    });

    res.status(response.status);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Accept-Ranges', 'bytes');
    res.removeHeader('cross-origin-resource-policy');

    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('text/html')) {
      res.setHeader('Content-Type', contentType);
    } else {
      res.setHeader('Content-Type', 'audio/mpeg');
    }

    const contentRange = response.headers.get('content-range');
    if (contentRange) res.setHeader('Content-Range', contentRange);

    const contentLength = response.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    if (!response.body) {
      res.end();
      return;
    }

    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err: any) {
    console.error('Proxy audio error:', err.message);
    if (!res.headersSent) {
      res.status(500).send('Error proxying audio stream');
    }
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
