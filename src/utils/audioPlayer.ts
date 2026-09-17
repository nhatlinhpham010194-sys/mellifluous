// Unified HTML5 Background Music Engine for Mellifluous
// Plays audio files stored in Firebase Storage and direct streamable audio files
// Provides seamless playback, play/pause, seek, volume, auto-next, and real-time Firestore sync.

import { db, doc, setDoc, deleteDoc, onSnapshot, collection } from '../lib/firebase';
import { deleteStorageFile, formatSecondsToTime } from './audioStorage';

export { formatSecondsToTime };

export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  audioUrl: string; // Firebase Storage public URL or direct audio stream URL
  storagePath?: string; // Firebase Storage reference path (e.g. music_tracks/...)
  coverUrl?: string; // Optional cover art image URL
  coverStoragePath?: string;
  duration?: string; // e.g. "03:15"
  durationSeconds?: number;
  mood?: string;
  fileSize?: number;
  addedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type AudioSourceType = 'storage' | 'direct' | 'synth';

export interface AudioPlaybackState {
  isPlaying: boolean;
  isLoading: boolean;
  track: AudioTrack;
  tracks: AudioTrack[];
  currentTrackIndex: number;
  currentTime: number; // in seconds
  duration: number; // in seconds
  volume: number; // 0 to 1
  isMuted: boolean;
  sourceType: AudioSourceType;
  embedUrl?: string; // Kept for backwards-compatibility; always undefined in HTML5 player
  error?: string | null;
}

export function parseDurationToSeconds(durationStr?: string): number {
  if (!durationStr) return 210;
  const parts = durationStr.split(':').map((p) => parseInt(p, 10));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 210;
}

// Gentle, calming ambient tracks for reader relaxation
export const DEFAULT_TRACK_LIST: AudioTrack[] = [
  {
    id: 'default_track_1',
    title: 'Giai Điệu Hạ Êm Đềm',
    artist: 'Mellifluous Piano',
    audioUrl: 'https://actions.google.com/sounds/v1/ambiences/outdoor_summer_ambient.ogg',
    duration: '03:15',
    durationSeconds: 195,
    mood: 'Gió hạ thanh bình',
    addedBy: 'Mellifluous Mặc định',
  },
  {
    id: 'default_track_2',
    title: 'Ký Ức Mưa Đầu Hạ',
    artist: 'Mellifluous Serenity',
    audioUrl: 'https://actions.google.com/sounds/v1/weather/rain_heavy.ogg',
    duration: '02:40',
    durationSeconds: 160,
    mood: 'Mưa rơi êm dịu',
    addedBy: 'Mellifluous Mặc định',
  },
  {
    id: 'default_track_3',
    title: 'Chuông Gió Hoa Anh Đào',
    artist: 'Mellifluous Wind',
    audioUrl: 'https://actions.google.com/sounds/v1/foley/wind_chimes_breeze.ogg',
    duration: '02:18',
    durationSeconds: 138,
    mood: 'Thanh thản sâu lắng',
    addedBy: 'Mellifluous Mặc định',
  },
  {
    id: 'default_track_4',
    title: 'Bình Minh Trên Đồi Trà',
    artist: 'Mellifluous Nature',
    audioUrl: 'https://actions.google.com/sounds/v1/ambiences/meadow_morning.ogg',
    duration: '03:05',
    durationSeconds: 185,
    mood: 'Dịu dàng sớm mai',
    addedBy: 'Mellifluous Mặc định',
  },
];

export const TRACK_LIST = DEFAULT_TRACK_LIST;

export class BackgroundMusicEngine {
  private audio: HTMLAudioElement;
  private isPlaying = false;
  private isLoading = false;
  private currentTrackIndex = 0;
  private volume = 0.45;
  private isMuted = false;
  private prevVolume = 0.45;
  private currentTime = 0;
  private duration = 195;
  private tracks: AudioTrack[] = [...DEFAULT_TRACK_LIST];
  private errorMessage: string | null = null;
  private listeners: Set<(state: AudioPlaybackState) => void> = new Set();
  private hasInitializedFirestore = false;
  private isSeeking = false;

  constructor() {
    // Restore persistent volume and track choice
    try {
      const savedVol = localStorage.getItem('mellifluous_bgm_vol');
      if (savedVol !== null) {
        const v = parseFloat(savedVol);
        if (!isNaN(v) && v >= 0 && v <= 1) {
          this.volume = v;
          this.prevVolume = v;
        }
      }
      const savedTrack = localStorage.getItem('mellifluous_bgm_track_idx');
      if (savedTrack !== null) {
        const idx = parseInt(savedTrack, 10);
        if (!isNaN(idx) && idx >= 0) {
          this.currentTrackIndex = idx;
        }
      }
    } catch {}

    // Initialize single, unified HTML5 Audio instance
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';
    this.audio.volume = this.volume;

    this.bindAudioEvents();
    this.initFirestoreSync();
  }

  private bindAudioEvents() {
    this.audio.addEventListener('timeupdate', () => {
      if (!this.isSeeking && !isNaN(this.audio.currentTime)) {
        this.currentTime = this.audio.currentTime;
      }
      if (!isNaN(this.audio.duration) && this.audio.duration > 0 && Math.abs(this.duration - this.audio.duration) > 0.5) {
        this.duration = this.audio.duration;
      }
      this.notify();
    });

    this.audio.addEventListener('loadedmetadata', () => {
      if (!isNaN(this.audio.duration) && this.audio.duration > 0) {
        this.duration = this.audio.duration;
      }
      this.notify();
    });

    this.audio.addEventListener('durationchange', () => {
      if (!isNaN(this.audio.duration) && this.audio.duration > 0) {
        this.duration = this.audio.duration;
      }
      this.notify();
    });

    this.audio.addEventListener('playing', () => {
      this.isPlaying = true;
      this.isLoading = false;
      this.errorMessage = null;
      this.notify();
    });

    this.audio.addEventListener('waiting', () => {
      this.isLoading = true;
      this.notify();
    });

    this.audio.addEventListener('canplay', () => {
      this.isLoading = false;
      this.notify();
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.isLoading = false;
      this.notify();
    });

    this.audio.addEventListener('ended', () => {
      this.nextTrack();
    });

    this.audio.addEventListener('error', () => {
      this.isLoading = false;
      this.isPlaying = false;
      const mediaErr = this.audio.error;
      console.warn('Audio tag error code:', mediaErr?.code, mediaErr?.message);
      this.errorMessage = 'Không thể tải tệp âm thanh này. Vui lòng kiểm tra lại file hoặc mạng.';
      this.notify();
    });
  }

  private initFirestoreSync() {
    if (this.hasInitializedFirestore) return;
    this.hasInitializedFirestore = true;

    try {
      // 1. Listen to individual tracks in music_tracks collection
      const tracksRef = collection(db, 'music_tracks');
      onSnapshot(
        tracksRef,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: AudioTrack[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              if (data && data.title && data.audioUrl) {
                list.push({
                  id: docSnap.id,
                  title: data.title,
                  artist: data.artist || 'Mellifluous',
                  audioUrl: data.audioUrl,
                  storagePath: data.storagePath,
                  coverUrl: data.coverUrl,
                  coverStoragePath: data.coverStoragePath,
                  duration: data.duration || '03:30',
                  durationSeconds: data.durationSeconds || parseDurationToSeconds(data.duration),
                  mood: data.mood || 'Thư giãn',
                  fileSize: data.fileSize,
                  addedBy: data.addedBy,
                  createdAt: data.createdAt,
                  updatedAt: data.updatedAt,
                });
              }
            });

            if (list.length > 0) {
              this.tracks = list;
              if (this.currentTrackIndex >= this.tracks.length) {
                this.currentTrackIndex = 0;
              }
              this.notify();
            }
          }
        },
        (err) => {
          console.warn('Firestore music_tracks collection snapshot note:', err.message);
        }
      );

      // 2. Also listen to site_stats/music_playlist document for fast atomic updates
      const playlistRef = doc(db, 'site_stats', 'music_playlist');
      onSnapshot(
        playlistRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            if (Array.isArray(data.tracks) && data.tracks.length > 0) {
              this.tracks = data.tracks;
              if (this.currentTrackIndex >= this.tracks.length) {
                this.currentTrackIndex = 0;
              }
              this.notify();
            }
          }
        },
        (err) => {
          console.warn('Firestore music_playlist snapshot note:', err.message);
        }
      );
    } catch (err) {
      console.warn('Firestore audio sync setup note:', err);
    }
  }

  public subscribe(listener: (state: AudioPlaybackState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error('BGM listener error:', err);
      }
    });
  }

  public getState(): AudioPlaybackState {
    const currentTrack = this.getCurrentTrack();
    const isStorage = Boolean(currentTrack.storagePath || currentTrack.audioUrl.includes('firebasestorage.app'));
    return {
      isPlaying: this.isPlaying,
      isLoading: this.isLoading,
      track: currentTrack,
      tracks: this.tracks,
      currentTrackIndex: this.currentTrackIndex,
      currentTime: this.currentTime,
      duration: this.duration,
      volume: this.volume,
      isMuted: this.isMuted,
      sourceType: isStorage ? 'storage' : 'direct',
      embedUrl: undefined,
      error: this.errorMessage,
    };
  }

  public getCurrentTrack(): AudioTrack {
    if (this.tracks.length === 0) {
      return DEFAULT_TRACK_LIST[0];
    }
    const idx = Math.max(0, Math.min(this.currentTrackIndex, this.tracks.length - 1));
    return this.tracks[idx];
  }

  public getTracks(): AudioTrack[] {
    return this.tracks;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getVolume(): number {
    return this.volume;
  }

  public togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public play(trackIndex?: number) {
    this.errorMessage = null;

    if (trackIndex !== undefined && trackIndex >= 0 && trackIndex < this.tracks.length) {
      if (trackIndex !== this.currentTrackIndex || !this.audio.src) {
        this.currentTrackIndex = trackIndex;
        this.currentTime = 0;
        try {
          localStorage.setItem('mellifluous_bgm_track_idx', trackIndex.toString());
        } catch {}
        this.loadCurrentTrackAudio();
      }
    } else if (!this.audio.src || this.audio.src === '' || this.audio.src === window.location.href) {
      this.loadCurrentTrackAudio();
    }

    const currentTrack = this.getCurrentTrack();
    if (!currentTrack.audioUrl) {
      this.errorMessage = 'Bài hát này không có đường dẫn tệp âm thanh.';
      this.notify();
      return;
    }

    this.isLoading = true;
    this.notify();

    const playPromise = this.audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          this.isPlaying = true;
          this.isLoading = false;
          this.notify();
        })
        .catch((err: Error) => {
          this.isPlaying = false;
          this.isLoading = false;
          if (err.name === 'NotAllowedError') {
            console.warn('Playback paused by browser autoplay policy until user interaction.');
            this.errorMessage = 'Nhấn Play để bắt đầu nghe nhạc.';
          } else {
            console.warn('Audio play rejection:', err);
            this.errorMessage = 'Không thể phát bài hát này. Vui lòng thử lại.';
          }
          this.notify();
        });
    }
  }

  private loadCurrentTrackAudio() {
    const track = this.getCurrentTrack();
    if (!track || !track.audioUrl) return;

    this.audio.src = track.audioUrl;
    this.audio.volume = this.volume;
    this.duration = track.durationSeconds || parseDurationToSeconds(track.duration);
    this.audio.load();
  }

  public pause() {
    this.audio.pause();
    this.isPlaying = false;
    this.isLoading = false;
    this.notify();
  }

  public seek(seconds: number) {
    const target = Math.max(0, Math.min(seconds, this.duration));
    this.currentTime = target;
    this.isSeeking = false;

    if (this.audio && !isNaN(this.audio.duration)) {
      try {
        this.audio.currentTime = target;
      } catch (err) {
        console.warn('Audio seek error:', err);
      }
    }
    this.notify();
  }

  public setSeeking(seeking: boolean, value?: number) {
    this.isSeeking = seeking;
    if (value !== undefined) {
      this.currentTime = value;
      this.notify();
    }
  }

  public setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.volume = clamped;
    this.audio.volume = clamped;
    if (clamped > 0 && this.isMuted) {
      this.isMuted = false;
    }
    try {
      localStorage.setItem('mellifluous_bgm_vol', clamped.toString());
    } catch {}
    this.notify();
  }

  public toggleMute() {
    if (this.isMuted) {
      this.setVolume(this.prevVolume || 0.45);
      this.isMuted = false;
    } else {
      this.prevVolume = this.volume > 0 ? this.volume : 0.45;
      this.setVolume(0);
      this.isMuted = true;
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
    if (this.currentTime > 3) {
      this.seek(0);
      return;
    }
    const prevIdx = (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length;
    this.play(prevIdx);
  }

  /**
   * Author/Admin: Add a new audio track with Firebase Storage file & metadata
   */
  public async addTrack(trackData: Omit<AudioTrack, 'id' | 'createdAt'>): Promise<AudioTrack> {
    const id = `track_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newTrack: AudioTrack = {
      ...trackData,
      id,
      createdAt: now,
      updatedAt: now,
    };

    // Update in memory
    this.tracks = [...this.tracks, newTrack];
    this.notify();

    // Persist to Firestore: collection 'music_tracks'
    try {
      await setDoc(doc(db, 'music_tracks', id), newTrack);
      // Also sync array in site_stats/music_playlist
      await setDoc(
        doc(db, 'site_stats', 'music_playlist'),
        {
          tracks: this.tracks,
          updatedAt: now,
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Firestore write note for music_tracks:', err);
    }

    return newTrack;
  }

  /**
   * Author/Admin: Update an existing audio track
   */
  public async updateTrack(trackId: string, partial: Partial<AudioTrack>): Promise<boolean> {
    const idx = this.tracks.findIndex((t) => t.id === trackId);
    if (idx === -1) return false;

    const updated: AudioTrack = {
      ...this.tracks[idx],
      ...partial,
      updatedAt: new Date().toISOString(),
    };

    this.tracks[idx] = updated;

    // If currently playing track was updated, refresh source if audioUrl changed
    if (idx === this.currentTrackIndex && partial.audioUrl) {
      this.loadCurrentTrackAudio();
      if (this.isPlaying) {
        this.audio.play().catch(() => {});
      }
    }

    this.notify();

    try {
      await setDoc(doc(db, 'music_tracks', trackId), updated, { merge: true });
      await setDoc(
        doc(db, 'site_stats', 'music_playlist'),
        {
          tracks: this.tracks,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Firestore update note for music_tracks:', err);
    }

    return true;
  }

  /**
   * Author/Admin: Remove a track from playlist and delete its file from Firebase Storage
   */
  public async removeTrack(trackId: string): Promise<boolean> {
    const trackToRemove = this.tracks.find((t) => t.id === trackId);
    if (!trackToRemove) return false;

    const wasCurrent = this.getCurrentTrack().id === trackId;

    // Clean up Firebase Storage files
    if (trackToRemove.storagePath) {
      deleteStorageFile(trackToRemove.storagePath).catch(() => {});
    }
    if (trackToRemove.coverStoragePath) {
      deleteStorageFile(trackToRemove.coverStoragePath).catch(() => {});
    }

    // Update in-memory tracks
    this.tracks = this.tracks.filter((t) => t.id !== trackId);
    if (this.tracks.length === 0) {
      this.tracks = [...DEFAULT_TRACK_LIST];
    }

    if (wasCurrent) {
      this.currentTrackIndex = Math.min(this.currentTrackIndex, this.tracks.length - 1);
      if (this.isPlaying) {
        this.play(this.currentTrackIndex);
      } else {
        this.loadCurrentTrackAudio();
      }
    } else if (this.currentTrackIndex >= this.tracks.length) {
      this.currentTrackIndex = Math.max(0, this.tracks.length - 1);
    }

    this.notify();

    try {
      await deleteDoc(doc(db, 'music_tracks', trackId));
      await setDoc(
        doc(db, 'site_stats', 'music_playlist'),
        {
          tracks: this.tracks,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Firestore delete note for music_tracks:', err);
    }

    return true;
  }

  /**
   * Author/Admin: Reset playlist to default gentle tracks
   */
  public async resetToDefaultTracks(): Promise<void> {
    this.tracks = [...DEFAULT_TRACK_LIST];
    this.currentTrackIndex = 0;
    this.currentTime = 0;
    this.loadCurrentTrackAudio();
    this.notify();

    try {
      await setDoc(doc(db, 'site_stats', 'music_playlist'), {
        tracks: this.tracks,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Firestore reset note for music_playlist:', err);
    }
  }
}

// Global singleton instance
export const bgmEngine = new BackgroundMusicEngine();
