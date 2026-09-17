// Ambient Background Music Engine using Web Audio API + HTMLAudioElement + Iframe Audio Widget
// Supports direct MP3/M4A/WAV, SoundCloud, Google Drive, YouTube, and gentle built-in Lofi Synth.

import { db, doc, setDoc, deleteDoc, onSnapshot, collection } from '../lib/firebase';

export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  duration?: string;
  mood?: string;
  audioUrl?: string; // Direct audio URL, SoundCloud, Google Drive, YouTube, Dropbox, etc.
  addedBy?: string;
  createdAt?: string;
}

export type AudioSourceType = 'synth' | 'direct' | 'soundcloud' | 'gdrive' | 'youtube';

export interface ResolvedAudioSource {
  sourceType: AudioSourceType;
  streamUrl?: string;
  embedUrl?: string;
  parsedDuration?: number;
}

export interface AudioPlaybackState {
  isPlaying: boolean;
  track: AudioTrack;
  volume: number;
  tracks: AudioTrack[];
  currentTime: number; // in seconds
  duration: number; // in seconds
  sourceType: AudioSourceType;
  embedUrl?: string;
  isMuted: boolean;
  error?: string | null;
}

/**
 * Universal audio URL resolver that converts Google Drive, SoundCloud,
 * YouTube, Dropbox, OneDrive sharing links into playable formats.
 */
export function resolveAudioSource(rawUrl?: string, fallbackDuration = '03:30'): ResolvedAudioSource {
  const parsedDuration = parseDurationToSeconds(fallbackDuration);

  if (!rawUrl || !rawUrl.trim()) {
    return { sourceType: 'synth', parsedDuration };
  }

  const url = rawUrl.trim();

  // 1. SoundCloud links
  if (url.includes('soundcloud.com')) {
    // If it is already a direct audio cdn stream
    if (url.includes('sndcdn.com') || url.endsWith('.mp3')) {
      return { sourceType: 'direct', streamUrl: url, parsedDuration };
    }
    // Web SoundCloud link -> generate clean SoundCloud Widget Player Embed URL
    const encoded = encodeURIComponent(url);
    const embedUrl = `https://w.soundcloud.com/player/?url=${encoded}&color=%23f43f5e&auto_play=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false`;
    return { sourceType: 'soundcloud', embedUrl, parsedDuration };
  }

  // 2. Google Drive links
  // Pattern A: https://drive.google.com/file/d/FILE_ID/view...
  // Pattern B: https://drive.google.com/open?id=FILE_ID
  // Pattern C: https://drive.google.com/uc?id=FILE_ID
  const gDriveMatch = url.match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+)|uc\?(?:export=[a-z]+&)?id=([a-zA-Z0-9_-]+))/i);
  const gDriveId = gDriveMatch ? (gDriveMatch[1] || gDriveMatch[2] || gDriveMatch[3]) : null;
  if (gDriveId) {
    const streamUrl = `https://docs.google.com/uc?export=open&id=${gDriveId}`;
    const embedUrl = `https://drive.google.com/file/d/${gDriveId}/preview`;
    return { sourceType: 'gdrive', streamUrl, embedUrl, parsedDuration };
  }

  // 3. YouTube links
  // Pattern A: https://www.youtube.com/watch?v=VIDEO_ID
  // Pattern B: https://youtu.be/VIDEO_ID
  // Pattern C: https://www.youtube.com/shorts/VIDEO_ID
  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    const ytId = ytMatch[1];
    const embedUrl = `https://www.youtube.com/embed/${ytId}?autoplay=1&controls=0&loop=1&playlist=${ytId}&enablejsapi=1&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}`;
    return { sourceType: 'youtube', embedUrl, parsedDuration };
  }

  // 4. Dropbox links
  if (url.includes('dropbox.com')) {
    let streamUrl = url.replace(/[?&]dl=0/, '').replace(/[?&]dl=1/, '');
    streamUrl += streamUrl.includes('?') ? '&raw=1' : '?raw=1';
    return { sourceType: 'direct', streamUrl, parsedDuration };
  }

  // 5. OneDrive links
  if (url.includes('1drv.ms') || url.includes('onedrive.live.com')) {
    const streamUrl = url.replace('redir?', 'download?');
    return { sourceType: 'direct', streamUrl, parsedDuration };
  }

  // 6. Direct HTTP/HTTPS audio file or stream
  return { sourceType: 'direct', streamUrl: url, parsedDuration };
}

/**
 * Parses time string formatted as "MM:SS" or "HH:MM:SS" into total seconds.
 */
export function parseDurationToSeconds(durationStr?: string): number {
  if (!durationStr) return 210; // 3m 30s default
  const parts = durationStr.split(':').map((p) => parseInt(p.trim(), 10));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  const numeric = parseFloat(durationStr);
  return !isNaN(numeric) && numeric > 0 ? numeric : 210;
}

/**
 * Formats total seconds into "MM:SS".
 */
export function formatSecondsToTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const DEFAULT_TRACK_LIST: AudioTrack[] = [
  {
    id: 'track-1',
    title: 'Gió Thổi Mùa Hạ (夏天的风)',
    artist: 'Mellifluous Lofi Chill',
    duration: '03:45',
    mood: 'Rhodes Piano & Gió mùa hạ',
  },
  {
    id: 'track-2',
    title: 'Mùa Hè Năm Ấy (那年夏天)',
    artist: 'Acoustic Piano & Music Box',
    duration: '04:12',
    mood: 'Tiếng đàn êm dịu tuổi thanh xuân',
  },
  {
    id: 'track-3',
    title: 'Tớ Thích Cậu (我喜欢你)',
    artist: 'Sweet Warm Chords',
    duration: '03:30',
    mood: 'Giai điệu ngọt ngào chữa lành',
  },
  {
    id: 'track-4',
    title: 'Ký Ức Mùa Mưa Rào',
    artist: 'Ambient Rain & Chimes',
    duration: '02:58',
    mood: 'Chuông gió & giọt mưa tí tách',
  },
];

export let TRACK_LIST: AudioTrack[] = [...DEFAULT_TRACK_LIST];

// Pentatonic note frequencies for sweet romantic melodies
const PENTATONIC_FREQS = [
  261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5,
];

// Chord roots & harmonies
const CHORD_PROGRESSIONS = [
  [
    [130.81, 261.63, 329.63, 392.0, 493.88],
    [110.0, 220.0, 261.63, 329.63, 392.0],
    [87.31, 174.61, 261.63, 329.63, 349.23],
    [98.0, 196.0, 261.63, 293.66, 392.0],
  ],
  [
    [87.31, 174.61, 261.63, 329.63, 392.0],
    [82.41, 164.81, 246.94, 329.63, 392.0],
    [73.42, 146.83, 220.0, 261.63, 329.63],
    [65.41, 130.81, 196.0, 246.94, 329.63],
  ],
  [
    [98.0, 196.0, 246.94, 293.66, 392.0],
    [92.5, 185.0, 220.0, 293.66, 369.99],
    [82.41, 164.81, 246.94, 329.63, 392.0],
    [65.41, 130.81, 196.0, 261.63, 329.63],
  ],
  [
    [130.81, 196.0, 261.63, 329.63, 392.0],
    [98.0, 146.83, 196.0, 246.94, 293.66],
    [110.0, 164.81, 220.0, 261.63, 329.63],
    [87.31, 130.81, 174.61, 220.0, 261.63],
  ],
];

class BackgroundMusicEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private currentTrackIndex = 0;
  private volume = 0.4;
  private masterGain: GainNode | null = null;
  private intervalId: number | null = null;
  private progressTimerId: number | null = null;
  private step = 0;
  private audioEl: HTMLAudioElement | null = null;
  private tracks: AudioTrack[] = [...DEFAULT_TRACK_LIST];
  private currentTime = 0;
  private duration = 225; // in seconds
  private currentSource: ResolvedAudioSource = { sourceType: 'synth', parsedDuration: 225 };
  private listeners: Array<(state: AudioPlaybackState) => void> = [];
  private fallbackTimeoutId: number | null = null;

  constructor() {
    this.loadTracksFromStorage();
    this.initFirestoreSync();

    try {
      const savedVolume = localStorage.getItem('better_bgm_volume');
      if (savedVolume !== null) {
        this.volume = Math.max(0, Math.min(1, parseFloat(savedVolume)));
      }
      const savedTrack = localStorage.getItem('better_bgm_track');
      if (savedTrack !== null) {
        const idx = parseInt(savedTrack, 10);
        if (idx >= 0 && idx < this.tracks.length) {
          this.currentTrackIndex = idx;
        }
      }
    } catch {
      // safe fallback
    }

    // Set initial duration
    const track = this.getCurrentTrack();
    this.currentSource = resolveAudioSource(track.audioUrl, track.duration);
    this.duration = this.currentSource.parsedDuration || parseDurationToSeconds(track.duration);
  }

  private initFirestoreSync() {
    try {
      const playlistDoc = doc(db, 'site_stats', 'music_playlist');
      onSnapshot(
        playlistDoc,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            if (Array.isArray(data?.tracks) && data.tracks.length > 0) {
              this.tracks = data.tracks;
              TRACK_LIST = this.tracks;
              this.saveTracksToStorage();
              this.notify();
            }
          }
        },
        (err) => {
          console.warn('Firestore music_playlist subscription note:', err.message);
        }
      );

      // Also listen to legacy collection if accessible
      const tracksCol = collection(db, 'music_tracks');
      onSnapshot(
        tracksCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteTracks: AudioTrack[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              remoteTracks.push({
                id: docSnap.id,
                title: data.title || 'Giai điệu',
                artist: data.artist || 'Mellifluous',
                duration: data.duration || '03:30',
                mood: data.mood || 'Thư giãn',
                audioUrl: data.audioUrl || '',
                addedBy: data.addedBy || 'Tác giả',
                createdAt: data.createdAt || new Date().toISOString(),
              });
            });

            remoteTracks.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

            if (remoteTracks.length > 0 && this.tracks.length === 0) {
              this.tracks = remoteTracks;
              TRACK_LIST = this.tracks;
              this.saveTracksToStorage();
              this.notify();
            }
          }
        },
        () => {}
      );
    } catch (e) {
      console.warn('Firestore sync init error:', e);
    }
  }

  private loadTracksFromStorage() {
    try {
      const raw = localStorage.getItem('better_bgm_custom_playlist');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.tracks = parsed;
          TRACK_LIST = this.tracks;
          return;
        }
      }
    } catch {}
    this.tracks = [...DEFAULT_TRACK_LIST];
    TRACK_LIST = this.tracks;
  }

  private saveTracksToStorage() {
    try {
      localStorage.setItem('better_bgm_custom_playlist', JSON.stringify(this.tracks));
      TRACK_LIST = this.tracks;
    } catch {}
  }

  public getTracks(): AudioTrack[] {
    return [...this.tracks];
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getCurrentTrack(): AudioTrack {
    return this.tracks[this.currentTrackIndex] || this.tracks[0] || DEFAULT_TRACK_LIST[0];
  }

  public getPlaybackState(): AudioPlaybackState {
    const track = this.getCurrentTrack();
    return {
      isPlaying: this.isPlaying,
      track,
      volume: this.volume,
      tracks: this.getTracks(),
      currentTime: this.currentTime,
      duration: this.duration > 0 ? this.duration : parseDurationToSeconds(track.duration),
      sourceType: this.currentSource.sourceType,
      embedUrl: this.currentSource.embedUrl,
      isMuted: this.volume === 0,
    };
  }

  public subscribe(fn: (state: AudioPlaybackState) => void) {
    this.listeners.push(fn);
    fn(this.getPlaybackState());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notify() {
    const state = this.getPlaybackState();
    this.listeners.forEach((fn) => fn(state));
  }

  public async addTrack(track: Omit<AudioTrack, 'id'>): Promise<AudioTrack> {
    const newTrack: AudioTrack = {
      ...track,
      id: `track-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    this.tracks.push(newTrack);
    this.saveTracksToStorage();
    this.notify();

    try {
      await setDoc(doc(db, 'site_stats', 'music_playlist'), { tracks: this.tracks, updatedAt: new Date().toISOString() }, { merge: true });
      await setDoc(doc(db, 'music_tracks', newTrack.id), newTrack).catch(() => {});
    } catch (err) {
      console.warn('Error saving track to Firestore:', err);
    }

    return newTrack;
  }

  public async updateTrack(trackId: string, updates: Partial<AudioTrack>): Promise<boolean> {
    const index = this.tracks.findIndex((t) => t.id === trackId);
    if (index === -1) return false;

    this.tracks[index] = {
      ...this.tracks[index],
      ...updates,
    };
    this.saveTracksToStorage();

    if (this.currentTrackIndex === index && this.isPlaying) {
      this.play(index);
    } else {
      this.notify();
    }

    try {
      await setDoc(doc(db, 'site_stats', 'music_playlist'), { tracks: this.tracks, updatedAt: new Date().toISOString() }, { merge: true });
      await setDoc(doc(db, 'music_tracks', trackId), this.tracks[index], { merge: true }).catch(() => {});
    } catch (err) {
      console.warn('Error updating track in Firestore:', err);
    }
    return true;
  }

  public async removeTrack(trackId: string): Promise<boolean> {
    if (this.tracks.length <= 1) return false;
    const indexToRemove = this.tracks.findIndex((t) => t.id === trackId);
    if (indexToRemove === -1) return false;

    const wasPlayingCurrent = this.isPlaying && this.currentTrackIndex === indexToRemove;
    this.tracks = this.tracks.filter((t) => t.id !== trackId);
    this.saveTracksToStorage();

    if (this.currentTrackIndex >= this.tracks.length) {
      this.currentTrackIndex = Math.max(0, this.tracks.length - 1);
    }

    if (wasPlayingCurrent) {
      this.play(this.currentTrackIndex);
    } else {
      this.notify();
    }

    try {
      await setDoc(doc(db, 'site_stats', 'music_playlist'), { tracks: this.tracks, updatedAt: new Date().toISOString() }, { merge: true });
      await deleteDoc(doc(db, 'music_tracks', trackId)).catch(() => {});
    } catch (err) {
      console.warn('Error removing track from Firestore:', err);
    }

    return true;
  }

  public async resetToDefaultTracks(): Promise<void> {
    this.stopExternalAudio();
    const oldTracks = [...this.tracks];
    this.tracks = [...DEFAULT_TRACK_LIST];
    this.saveTracksToStorage();
    this.currentTrackIndex = 0;
    if (this.isPlaying) {
      this.play(0);
    } else {
      this.notify();
    }

    try {
      await setDoc(doc(db, 'site_stats', 'music_playlist'), { tracks: this.tracks, updatedAt: new Date().toISOString() }, { merge: true });
      for (const t of oldTracks) {
        if (!DEFAULT_TRACK_LIST.some((def) => def.id === t.id)) {
          await deleteDoc(doc(db, 'music_tracks', t.id)).catch(() => {});
        }
      }
      for (const def of DEFAULT_TRACK_LIST) {
        await setDoc(doc(db, 'music_tracks', def.id), def).catch(() => {});
      }
    } catch (err) {
      console.warn('Error syncing default tracks to Firestore:', err);
    }
  }

  private initAudioContext() {
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.masterGain && this.ctx) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
  }

  public togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  private stopExternalAudio() {
    if (this.fallbackTimeoutId) {
      window.clearTimeout(this.fallbackTimeoutId);
      this.fallbackTimeoutId = null;
    }
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.removeAttribute('src');
      this.audioEl.load();
      this.audioEl = null;
    }
  }

  public play(trackIndex?: number) {
    if (trackIndex !== undefined && trackIndex >= 0 && trackIndex < this.tracks.length) {
      this.currentTrackIndex = trackIndex;
      this.currentTime = 0;
      try {
        localStorage.setItem('better_bgm_track', trackIndex.toString());
      } catch {}
    }

    const currentTrack = this.getCurrentTrack();
    this.currentSource = resolveAudioSource(currentTrack.audioUrl, currentTrack.duration);
    this.duration = this.currentSource.parsedDuration || parseDurationToSeconds(currentTrack.duration);

    this.stopExternalAudio();
    this.stopProgressTimer();

    // CASE 1: Embedded Player (SoundCloud / YouTube)
    if (this.currentSource.sourceType === 'soundcloud' || this.currentSource.sourceType === 'youtube') {
      this.isPlaying = true;
      this.startProgressSimulation();
      this.notify();
      return;
    }

    // CASE 2: Google Drive Audio
    if (this.currentSource.sourceType === 'gdrive') {
      this.isPlaying = true;
      // Try playing via direct stream first
      if (this.currentSource.streamUrl) {
        this.attemptDirectAudio(this.currentSource.streamUrl, () => {
          // If direct Google Drive audio fails (e.g. CORS/redirect), keep playing via embed preview
          console.log('Google Drive direct stream redirected; switched to background player.');
          this.currentSource.sourceType = 'gdrive';
          this.startProgressSimulation();
          this.notify();
        });
      } else {
        this.startProgressSimulation();
        this.notify();
      }
      return;
    }

    // CASE 3: Direct Streaming URL (MP3/M4A/WAV/Dropbox/OneDrive)
    if (this.currentSource.sourceType === 'direct' && this.currentSource.streamUrl) {
      this.attemptDirectAudio(this.currentSource.streamUrl, () => {
        // Fallback to ambient soft synth if direct URL is invalid or blocked
        console.warn('Direct stream unreachable, playing ambient soothing synth.');
        this.currentSource = { sourceType: 'synth', parsedDuration: this.duration };
        this.playSynth();
      });
      return;
    }

    // CASE 4: Soft Built-in Ambient Synth
    this.currentSource = { sourceType: 'synth', parsedDuration: this.duration };
    this.playSynth();
  }

  private attemptDirectAudio(streamUrl: string, onFallback: () => void) {
    try {
      this.audioEl = new Audio();
      this.audioEl.preload = 'auto';
      this.audioEl.crossOrigin = 'anonymous';
      this.audioEl.src = streamUrl;
      this.audioEl.volume = this.volume;
      this.audioEl.currentTime = this.currentTime;

      // Event listeners for seek and progress bar
      this.audioEl.addEventListener('timeupdate', () => {
        if (this.audioEl && !isNaN(this.audioEl.currentTime)) {
          this.currentTime = this.audioEl.currentTime;
          if (!isNaN(this.audioEl.duration) && this.audioEl.duration > 0) {
            this.duration = this.audioEl.duration;
          }
          this.notify();
        }
      });

      this.audioEl.addEventListener('loadedmetadata', () => {
        if (this.audioEl && !isNaN(this.audioEl.duration) && this.audioEl.duration > 0) {
          this.duration = this.audioEl.duration;
          this.notify();
        }
      });

      this.audioEl.addEventListener('ended', () => {
        this.nextTrack();
      });

      this.audioEl.addEventListener('error', (e) => {
        console.warn('Audio tag error:', e);
        this.stopExternalAudio();
        onFallback();
      });

      // Set safety timeout in case the external stream hangs
      this.fallbackTimeoutId = window.setTimeout(() => {
        if (this.isPlaying && this.audioEl && this.audioEl.readyState === 0) {
          console.warn('Audio stream timeout; using fallback.');
          this.stopExternalAudio();
          onFallback();
        }
      }, 7000);

      const playPromise = this.audioEl.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            if (this.fallbackTimeoutId) {
              window.clearTimeout(this.fallbackTimeoutId);
              this.fallbackTimeoutId = null;
            }
            this.isPlaying = true;
            this.notify();
          })
          .catch((err) => {
            console.warn('Audio play request rejected:', err);
            this.stopExternalAudio();
            onFallback();
          });
      }
    } catch (e) {
      console.warn('Direct audio creation failed:', e);
      this.stopExternalAudio();
      onFallback();
    }
  }

  private playSynth() {
    this.initAudioContext();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.isPlaying = true;
    this.startProgressSimulation();
    this.notify();

    if (this.intervalId) {
      window.clearInterval(this.intervalId);
    }

    this.step = Math.floor(this.currentTime / 0.75) % 16;
    this.playStep();
    this.intervalId = window.setInterval(() => {
      this.playStep();
    }, 750);
  }

  private startProgressSimulation() {
    this.stopProgressTimer();
    this.progressTimerId = window.setInterval(() => {
      if (this.isPlaying) {
        this.currentTime += 0.5;
        if (this.currentTime >= this.duration) {
          this.currentTime = 0;
          this.nextTrack();
        } else {
          this.notify();
        }
      }
    }, 500);
  }

  private stopProgressTimer() {
    if (this.progressTimerId) {
      window.clearInterval(this.progressTimerId);
      this.progressTimerId = null;
    }
  }

  public pause() {
    this.isPlaying = false;
    this.stopProgressTimer();

    if (this.audioEl) {
      this.audioEl.pause();
    }
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.notify();
  }

  /**
   * Seek directly to target seconds in the track
   */
  public seek(seconds: number) {
    const target = Math.max(0, Math.min(seconds, this.duration));
    this.currentTime = target;

    if (this.audioEl && !isNaN(this.audioEl.duration)) {
      try {
        this.audioEl.currentTime = target;
      } catch (err) {
        console.warn('Audio seek error:', err);
      }
    }

    if (this.currentSource.sourceType === 'synth') {
      this.step = Math.floor(target / 0.75) % 16;
    }

    this.notify();
  }

  public nextTrack() {
    if (this.tracks.length === 0) return;
    const nextIdx = (this.currentTrackIndex + 1) % this.tracks.length;
    this.play(nextIdx);
  }

  public prevTrack() {
    if (this.tracks.length === 0) return;
    const prevIdx = (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length;
    this.play(prevIdx);
  }

  public setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.volume = clamped;
    if (this.audioEl) {
      this.audioEl.volume = clamped;
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }
    try {
      localStorage.setItem('better_bgm_volume', clamped.toString());
    } catch {}
    this.notify();
  }

  private playStep() {
    if (!this.ctx || !this.masterGain || !this.isPlaying || this.currentSource.sourceType !== 'synth') return;

    const chords = CHORD_PROGRESSIONS[this.currentTrackIndex % CHORD_PROGRESSIONS.length];
    const chordIndex = Math.floor(this.step / 4) % chords.length;
    const currentChord = chords[chordIndex];

    if (this.step % 4 === 0) {
      this.playChord(currentChord, 3.2);
    }

    const melodyPitch = this.pickMelodyNote(currentChord);
    this.playMelodyNote(melodyPitch, 1.4);

    if (Math.random() > 0.4) {
      const sparklePitch = PENTATONIC_FREQS[Math.floor(Math.random() * PENTATONIC_FREQS.length)];
      setTimeout(() => {
        if (this.isPlaying && this.currentSource.sourceType === 'synth') {
          this.playBellNote(sparklePitch, 1.2);
        }
      }, 350);
    }

    this.step = (this.step + 1) % 16;
  }

  private pickMelodyNote(currentChord: number[]): number {
    const chordNotes = currentChord.filter((freq) => freq > 250);
    if (Math.random() > 0.3 && chordNotes.length > 0) {
      return chordNotes[Math.floor(Math.random() * chordNotes.length)];
    }
    return PENTATONIC_FREQS[Math.floor(Math.random() * PENTATONIC_FREQS.length)];
  }

  private playMelodyNote(freq: number, duration: number) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.exponentialRampToValueAtTime(0.09, now + 0.08);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(noteGain);
    noteGain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);
  }

  private playBellNote(freq: number, duration: number) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq * 2, now);

    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.exponentialRampToValueAtTime(0.035, now + 0.02);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(noteGain);
    noteGain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);
  }

  private playChord(chordFreqs: number[], duration: number) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    chordFreqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.045 / chordFreqs.length, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + duration);
    });
  }
}

export const bgmEngine = new BackgroundMusicEngine();
