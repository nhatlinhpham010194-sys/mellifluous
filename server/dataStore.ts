import fs from 'fs';
import path from 'path';
import { Story, Chapter, Announcement } from '../src/types';
import { STORIES, SAMPLE_CHAPTERS, ANNOUNCEMENTS } from '../src/data/mockData';

const DATA_DIR = path.join(process.cwd(), 'data');
const STORIES_FILE = path.join(DATA_DIR, 'stories.json');
const CHAPTERS_FILE = path.join(DATA_DIR, 'chapters.json');
const ANNOUNCEMENTS_FILE = path.join(DATA_DIR, 'announcements.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create data directory:', err);
  }
}

// In-memory caches for high performance
let cachedStories: Story[] = [];
let cachedChapters: Record<string, Chapter[]> = {};
let cachedAnnouncements: Announcement[] = [];

// Helper to write JSON safely
const writeJsonSafe = (filePath: string, data: any) => {
  try {
    const tempFile = `${filePath}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, filePath);
  } catch (err) {
    console.error(`Failed to write file ${filePath}:`, err);
  }
};

// Initialize or load stories
export const initDataStore = () => {
  // 1. Stories
  if (fs.existsSync(STORIES_FILE)) {
    try {
      const content = fs.readFileSync(STORIES_FILE, 'utf-8');
      cachedStories = JSON.parse(content);
    } catch {
      cachedStories = [...STORIES];
      writeJsonSafe(STORIES_FILE, cachedStories);
    }
  } else {
    cachedStories = [...STORIES];
    writeJsonSafe(STORIES_FILE, cachedStories);
  }

  // 2. Chapters (grouped by storyId)
  if (fs.existsSync(CHAPTERS_FILE)) {
    try {
      const content = fs.readFileSync(CHAPTERS_FILE, 'utf-8');
      cachedChapters = JSON.parse(content);
    } catch {
      cachedChapters = { ...SAMPLE_CHAPTERS };
      writeJsonSafe(CHAPTERS_FILE, cachedChapters);
    }
  } else {
    cachedChapters = { ...SAMPLE_CHAPTERS };
    writeJsonSafe(CHAPTERS_FILE, cachedChapters);
  }

  // 3. Announcements
  if (fs.existsSync(ANNOUNCEMENTS_FILE)) {
    try {
      const content = fs.readFileSync(ANNOUNCEMENTS_FILE, 'utf-8');
      cachedAnnouncements = JSON.parse(content);
    } catch {
      cachedAnnouncements = [...ANNOUNCEMENTS];
      writeJsonSafe(ANNOUNCEMENTS_FILE, cachedAnnouncements);
    }
  } else {
    cachedAnnouncements = [...ANNOUNCEMENTS];
    writeJsonSafe(ANNOUNCEMENTS_FILE, cachedAnnouncements);
  }

  console.log(`[DataStore] Initialized with ${cachedStories.length} stories, ${Object.keys(cachedChapters).length} chapter sets, ${cachedAnnouncements.length} announcements.`);
};

// Vietnamese Slug Helper for Robust URL Lookup
export const toSlug = (str: string = ''): string => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Stories Operations
export const getAllStories = (): Story[] => {
  return [...cachedStories];
};

export const getStoryById = (id: string): Story | undefined => {
  if (!id) return undefined;
  const decodedId = decodeURIComponent(id).trim();
  const slugId = toSlug(decodedId);

  // 1. Exact ID match
  const exact = cachedStories.find((s) => s.id === decodedId || s.id === id);
  if (exact) return exact;

  // 2. Alias match for special stories
  if (decodedId === 'anh-dao-5cm' || slugId === 'anh-dao-5cm') {
    const alias = cachedStories.find((s) => s.id === 'anh-dao-nam-centimet' || s.id === 'anh-dao-5cm');
    if (alias) return alias;
  }
  if (decodedId === 'anh-dao-nam-centimet' || slugId === 'anh-dao-nam-centimet') {
    const alias = cachedStories.find((s) => s.id === 'anh-dao-5cm' || s.id === 'anh-dao-nam-centimet');
    if (alias) return alias;
  }

  // 3. Match by slugified ID, title, or original title
  return cachedStories.find((s) => {
    return (
      toSlug(s.id) === slugId ||
      toSlug(s.title) === slugId ||
      toSlug(s.originalTitle) === slugId
    );
  });
};

export const saveStory = (story: Story): Story => {
  const index = cachedStories.findIndex((s) => s.id === story.id);
  if (index >= 0) {
    cachedStories[index] = { ...cachedStories[index], ...story };
  } else {
    cachedStories = [story, ...cachedStories];
  }
  writeJsonSafe(STORIES_FILE, cachedStories);
  return story;
};

export const deleteStory = (storyId: string): boolean => {
  cachedStories = cachedStories.filter((s) => s.id !== storyId);
  delete cachedChapters[storyId];
  writeJsonSafe(STORIES_FILE, cachedStories);
  writeJsonSafe(CHAPTERS_FILE, cachedChapters);
  return true;
};

// Chapters Operations
export const getChaptersByStory = (storyId: string): Chapter[] => {
  if (!storyId) return [];
  const decodedId = decodeURIComponent(storyId).trim();
  const directList = cachedChapters[decodedId] || cachedChapters[storyId];
  if (directList && directList.length > 0) return directList;

  // Alias lookup
  if (decodedId === 'anh-dao-5cm') return cachedChapters['anh-dao-nam-centimet'] || [];
  if (decodedId === 'anh-dao-nam-centimet') return cachedChapters['anh-dao-5cm'] || [];

  // If queried by slug, find the resolved story first
  const resolved = getStoryById(decodedId);
  if (resolved && resolved.id !== decodedId) {
    return cachedChapters[resolved.id] || [];
  }

  return [];
};

export const getAllChaptersMap = (): Record<string, Chapter[]> => {
  return { ...cachedChapters };
};

export const saveChapter = (chapter: Chapter): Chapter => {
  const storyId = chapter.storyId;
  const list = cachedChapters[storyId] ? [...cachedChapters[storyId]] : [];
  
  const targetPart = chapter.partType || (chapter.isExtra ? 'extra' : 'main');
  const existingIdx = list.findIndex((c) => {
    const cPart = c.partType || (c.isExtra ? 'extra' : 'main');
    return c.id === chapter.id || (c.chapterNumber === chapter.chapterNumber && cPart === targetPart);
  });
  if (existingIdx >= 0) {
    list[existingIdx] = { ...list[existingIdx], ...chapter };
  } else {
    list.push(chapter);
  }

  list.sort((a, b) => a.chapterNumber - b.chapterNumber);
  cachedChapters[storyId] = list;
  writeJsonSafe(CHAPTERS_FILE, cachedChapters);

  // Automatically update story's completed chapters count and update timestamp
  const storyIdx = cachedStories.findIndex((s) => s.id === storyId);
  if (storyIdx >= 0) {
    cachedStories[storyIdx].completedChapters = list.length;
    cachedStories[storyIdx].updatedAt = new Date().toISOString();
    writeJsonSafe(STORIES_FILE, cachedStories);
  }

  return chapter;
};

export const deleteChapter = (storyId: string, chapterId: string): boolean => {
  if (cachedChapters[storyId]) {
    cachedChapters[storyId] = cachedChapters[storyId].filter((c) => c.id !== chapterId);
    writeJsonSafe(CHAPTERS_FILE, cachedChapters);

    // Update story completed chapters count
    const storyIdx = cachedStories.findIndex((s) => s.id === storyId);
    if (storyIdx >= 0) {
      cachedStories[storyIdx].completedChapters = cachedChapters[storyId].length;
      cachedStories[storyIdx].updatedAt = new Date().toISOString();
      writeJsonSafe(STORIES_FILE, cachedStories);
    }
    return true;
  }
  return false;
};

// Announcements Operations
export const getAllAnnouncements = (): Announcement[] => {
  return [...cachedAnnouncements];
};

export const saveAnnouncement = (ann: Announcement): Announcement => {
  const index = cachedAnnouncements.findIndex((a) => a.id === ann.id);
  if (index >= 0) {
    cachedAnnouncements[index] = { ...cachedAnnouncements[index], ...ann };
  } else {
    cachedAnnouncements = [ann, ...cachedAnnouncements];
  }
  writeJsonSafe(ANNOUNCEMENTS_FILE, cachedAnnouncements);
  return ann;
};
