import React, { useState, useEffect } from 'react';
import {
  Music,
  Plus,
  Trash2,
  Play,
  Pause,
  RotateCcw,
  Edit2,
  Save,
  X,
  Sparkles,
  FileAudio,
  Image as ImageIcon,
  FileMusic,
  Link as LinkIcon,
  Info,
  Check,
} from 'lucide-react';
import {
  bgmEngine,
  AudioTrack,
  formatSecondsToTime,
  resolveAudioUrl,
} from '../../utils/audioPlayer';
import { parseDurationToSeconds } from '../../utils/audioStorage';

interface AuthorMusicTabProps {
  onFeedback: (type: 'success' | 'error', text: string) => void;
}

// Preset tracks available in public/music/ for 1-click selection
const STATIC_PRESETS = [
  {
    title: 'Giai Điệu Hạ Êm Đềm',
    artist: 'Mellifluous Piano',
    filePath: 'music/giai-dieu-ha.mp3',
    duration: '03:15',
    mood: 'Gió hạ thanh bình',
  },
  {
    title: 'Ký Ức Mưa Đầu Hạ',
    artist: 'Mellifluous Serenity',
    filePath: 'music/ky-uc-mua.mp3',
    duration: '02:40',
    mood: 'Mưa rơi êm dịu',
  },
  {
    title: 'Chuông Gió Hoa Anh Đào',
    artist: 'Mellifluous Wind',
    filePath: 'music/chuong-gio.mp3',
    duration: '02:18',
    mood: 'Thanh thản sâu lắng',
  },
  {
    title: 'Bình Minh Trên Đồi Trà',
    artist: 'Mellifluous Nature',
    filePath: 'music/binh-minh.mp3',
    duration: '03:05',
    mood: 'Dịu dàng sớm mai',
  },
  {
    title: 'Giai Điệu Thư Giãn Mẫu',
    artist: 'Mellifluous Piano',
    filePath: 'music/ten-bai-hat.mp3',
    duration: '03:30',
    mood: 'Đọc truyện thư giãn',
  },
];

export const AuthorMusicTab: React.FC<AuthorMusicTabProps> = ({ onFeedback }) => {
  const [tracks, setTracks] = useState<AudioTrack[]>(() => bgmEngine.getTracks());
  const [isPlaying, setIsPlaying] = useState<boolean>(() => bgmEngine.getIsPlaying());
  const [currentTrack, setCurrentTrack] = useState<AudioTrack>(() => bgmEngine.getCurrentTrack());
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(195);

  // Form fields for adding new track
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [filePath, setFilePath] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [mood, setMood] = useState('');
  const [durationInput, setDurationInput] = useState('03:30');
  const [isSaving, setIsSaving] = useState(false);

  // Edit track states
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editFilePath, setEditFilePath] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [editMood, setEditMood] = useState('');
  const [editDuration, setEditDuration] = useState('03:30');

  // Seek bar state
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  useEffect(() => {
    const unsubscribe = bgmEngine.subscribe((state) => {
      setTracks(state.tracks);
      setIsPlaying(state.isPlaying);
      setCurrentTrack(state.track);
      setDuration(state.duration || 195);
      if (!isSeeking) {
        setCurrentTime(state.currentTime);
      }
    });
    return unsubscribe;
  }, [isSeeking]);

  // Apply a preset from public/music/
  const handleSelectPreset = (preset: typeof STATIC_PRESETS[0]) => {
    setFilePath(preset.filePath);
    if (!title.trim()) setTitle(preset.title);
    if (!artist.trim()) setArtist(preset.artist);
    if (!mood.trim()) setMood(preset.mood);
    setDurationInput(preset.duration);
  };

  // Submit Handler: Save track path & metadata to Firestore music_tracks & site_stats
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      onFeedback('error', 'Vui lòng nhập tên bài hát / tác phẩm.');
      return;
    }

    const trimmedPath = filePath.trim();
    if (!trimmedPath) {
      onFeedback('error', 'Vui lòng nhập đường dẫn file tĩnh (ví dụ: music/ten-bai-hat.mp3) hoặc link âm thanh.');
      return;
    }

    // Strip leading slashes to prevent hard-coded leading slash for GitHub Pages compatibility
    const cleanAudioUrl = trimmedPath.replace(/^\/+/, '');
    const cleanCoverUrl = coverUrl.trim().replace(/^\/+/, '');
    const seconds = parseDurationToSeconds(durationInput.trim());

    setIsSaving(true);
    try {
      await bgmEngine.addTrack({
        title: trimmedTitle,
        artist: artist.trim() || 'Mellifluous Piano',
        audioUrl: cleanAudioUrl,
        coverUrl: cleanCoverUrl || undefined,
        duration: durationInput.trim() || '03:30',
        durationSeconds: seconds,
        mood: mood.trim() || 'Giai điệu thư giãn',
        addedBy: 'Tác giả / BQT',
      });

      onFeedback('success', `Đã thêm bài hát "${trimmedTitle}" vào danh sách phát thành công!`);

      // Reset form
      setTitle('');
      setArtist('');
      setFilePath('');
      setCoverUrl('');
      setMood('');
      setDurationInput('03:30');
    } catch (err: any) {
      console.error('Save track error:', err);
      onFeedback('error', `Lỗi khi lưu bài hát: ${err.message || 'Vui lòng kiểm tra lại kết nối mạng.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = (t: AudioTrack) => {
    setEditingTrackId(t.id);
    setEditTitle(t.title);
    setEditArtist(t.artist);
    setEditFilePath(t.audioUrl);
    setEditCoverUrl(t.coverUrl || '');
    setEditMood(t.mood || '');
    setEditDuration(t.duration || '03:30');
  };

  const handleSaveEdit = async (trackId: string) => {
    if (!editTitle.trim()) {
      onFeedback('error', 'Tên bài hát không được để trống.');
      return;
    }
    if (!editFilePath.trim()) {
      onFeedback('error', 'Đường dẫn file bài hát không được để trống.');
      return;
    }

    const cleanAudioUrl = editFilePath.trim().replace(/^\/+/, '');
    const cleanCoverUrl = editCoverUrl.trim().replace(/^\/+/, '');
    const seconds = parseDurationToSeconds(editDuration.trim());

    try {
      await bgmEngine.updateTrack(trackId, {
        title: editTitle.trim(),
        artist: editArtist.trim() || 'Mellifluous',
        audioUrl: cleanAudioUrl,
        coverUrl: cleanCoverUrl || undefined,
        mood: editMood.trim() || undefined,
        duration: editDuration.trim() || '03:30',
        durationSeconds: seconds,
      });
      setEditingTrackId(null);
      onFeedback('success', 'Đã cập nhật thông tin bài hát thành công!');
    } catch {
      onFeedback('error', 'Lỗi khi cập nhật bài hát.');
    }
  };

  const handleRemoveTrack = async (trackId: string, trackTitle: string) => {
    if (tracks.length <= 1) {
      onFeedback('error', 'Playlist cần giữ lại tối thiểu 1 tác phẩm nhạc.');
      return;
    }

    try {
      const ok = await bgmEngine.removeTrack(trackId);
      if (ok) {
        onFeedback('success', `Đã xóa bài hát "${trackTitle}" khỏi danh sách phát.`);
      }
    } catch {
      onFeedback('error', 'Không thể xóa bài hát này.');
    }
  };

  const handleResetTracks = async () => {
    if (window.confirm('Bạn có chắc chắn muốn khôi phục danh sách nhạc nền mặc định ban đầu?')) {
      try {
        await bgmEngine.resetToDefaultTracks();
        onFeedback('success', 'Đã khôi phục danh sách nhạc nền mặc định.');
      } catch {
        onFeedback('error', 'Không thể đặt lại danh sách nhạc.');
      }
    }
  };

  return (
    <div id="author-music-management-tab" className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-pink-50 via-rose-50/80 to-amber-50/80 dark:from-stone-800 dark:via-stone-850 dark:to-stone-800 border border-pink-200/90 dark:border-stone-700 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0">
              <FileMusic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <span>Quản Lý Nhạc Nền (File Tĩnh Repo & URL)</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-800 dark:bg-pink-950/80 dark:text-pink-300 font-sans font-medium">
                  {tracks.length} bài hát
                </span>
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-300 font-sans mt-0.5">
                Các bài hát được đặt dưới dạng file tĩnh trong thư mục <code className="px-1 py-0.5 rounded bg-pink-100 dark:bg-stone-700 font-mono text-[11px] text-pink-700 dark:text-pink-300">public/music/</code> hoặc link trực tiếp, tự động ghép nối với <code className="px-1 py-0.5 rounded bg-pink-100 dark:bg-stone-700 font-mono text-[11px] text-pink-700 dark:text-pink-300">BASE_URL</code> tương thích GitHub Pages.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetTracks}
            className="self-start sm:self-center px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-100 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer shrink-0"
            title="Khôi phục danh sách nhạc chuẩn ban đầu"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Mặc định ban đầu</span>
          </button>
        </div>
      </div>

      {/* Live Preview Player with HTML5 Progress & Seeking */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-700 pb-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => bgmEngine.togglePlay()}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0 ${
                isPlaying
                  ? 'bg-gradient-to-tr from-pink-500 to-rose-500 text-white animate-pulse'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-pink-100 dark:hover:bg-stone-700'
              }`}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            {/* Thumbnail */}
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-pink-100 dark:bg-stone-700 shrink-0 flex items-center justify-center border border-pink-200 dark:border-stone-600">
              {currentTrack.coverUrl ? (
                <img
                  src={resolveAudioUrl(currentTrack.coverUrl)}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Music className="w-5 h-5 text-pink-500" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                  {currentTrack.title}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 font-mono font-medium">
                  {currentTrack.audioUrl.startsWith('http') ? 'Direct URL' : 'File tĩnh repo'}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                {currentTrack.artist} • {currentTrack.mood || 'Thư giãn'}
              </p>
              <p className="text-[10px] text-stone-400 font-mono truncate">
                {currentTrack.audioUrl}
              </p>
            </div>
          </div>

          <div className="text-xs font-mono text-stone-600 dark:text-stone-300 font-medium self-end sm:self-center">
            {formatSecondsToTime(isSeeking ? seekValue : currentTime)} / {formatSecondsToTime(duration)}
          </div>
        </div>

        {/* Live Progress / Seek Bar */}
        <div className="space-y-1 pt-1">
          <input
            type="range"
            min="0"
            max={duration > 0 ? duration : 100}
            step="0.5"
            value={isSeeking ? seekValue : currentTime}
            onMouseDown={() => {
              setIsSeeking(true);
              setSeekValue(currentTime);
            }}
            onTouchStart={() => {
              setIsSeeking(true);
              setSeekValue(currentTime);
            }}
            onChange={(e) => {
              setSeekValue(parseFloat(e.target.value));
            }}
            onMouseUp={(e) => {
              const val = parseFloat((e.target as HTMLInputElement).value);
              setIsSeeking(false);
              setCurrentTime(val);
              bgmEngine.seek(val);
            }}
            onTouchEnd={(e) => {
              const val = parseFloat((e.target as HTMLInputElement).value);
              setIsSeeking(false);
              setCurrentTime(val);
              bgmEngine.seek(val);
            }}
            className="w-full h-2 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-pink-500 focus:outline-hidden"
            title="Kéo để tua nhanh hoặc quay lại đoạn nhạc"
          />
          <div className="flex justify-between text-[10px] text-stone-400 font-mono">
            <span>{formatSecondsToTime(isSeeking ? seekValue : currentTime)}</span>
            <span>{formatSecondsToTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Add Track Form */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-700 pb-3">
          <div>
            <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4 text-pink-500" />
              <span>Thêm Bài Hát Vào Danh Sách Phát</span>
            </h4>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
              Nhập thông tin bài hát và đường dẫn file trong repo hoặc link trực tiếp, dữ liệu lưu trữ vào collection Firestore <code className="font-mono text-[10px] text-pink-600 dark:text-pink-300">music_tracks</code>.
            </p>
          </div>
        </div>

        {/* Static Presets Quick Chips */}
        <div className="space-y-1.5 p-3 rounded-xl bg-stone-50/70 dark:bg-stone-900/50 border border-stone-200/80 dark:border-stone-700/80">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-700 dark:text-stone-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Gợi ý file có sẵn trong thư mục public/music/ (bấm để điền nhanh):</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {STATIC_PRESETS.map((p) => {
              const isMatch = filePath === p.filePath;
              return (
                <button
                  key={p.filePath}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                    isMatch
                      ? 'bg-pink-100 dark:bg-pink-950/80 text-pink-800 dark:text-pink-200 border-pink-300 dark:border-pink-800 shadow-xs'
                      : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-pink-300 hover:text-pink-600'
                  }`}
                >
                  <FileAudio className="w-3 h-3 text-pink-500" />
                  <span className="font-mono text-[11px]">{p.filePath}</span>
                  <span className="text-[10px] text-stone-400">({p.title})</span>
                  {isMatch && <Check className="w-3 h-3 text-pink-600 dark:text-pink-400" />}
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Audio File Path Input */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1">
              <FileMusic className="w-3.5 h-3.5 text-pink-500" />
              <span>Đường dẫn file bài hát <span className="text-rose-500">*</span></span>
            </label>
            <input
              type="text"
              required
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="VD: music/ten-bai-hat.mp3 hoặc link âm thanh trực tiếp"
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-600 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-pink-400 focus:outline-hidden"
            />
            <p className="text-[10px] text-stone-500 dark:text-stone-400 flex items-center gap-1">
              <Info className="w-3 h-3 text-stone-400" />
              <span>Nhập đường dẫn tương đối từ thư mục <code className="font-mono">public/</code> (không cần dấu <code className="font-mono">/</code> ở đầu), tự động ghép với <code className="font-mono">BASE_URL</code> tương thích GitHub Pages.</span>
            </p>
          </div>

          {/* Title and Artist Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-stone-800 dark:text-stone-200">
                Tên bài hát / Giai điệu <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Hạ Chí Chưa Tới (Piano Solo)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-600 text-stone-900 dark:text-stone-100 text-xs sm:text-sm focus:ring-2 focus:ring-pink-400 focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-stone-800 dark:text-stone-200">
                Nghệ sĩ / Thể hiện
              </label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="VD: Mellifluous Piano"
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-600 text-stone-900 dark:text-stone-100 text-xs sm:text-sm focus:ring-2 focus:ring-pink-400 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Cover Art URL (Optional) */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5 text-pink-500" />
              <span>Đường dẫn ảnh bìa bài hát (Tùy chọn)</span>
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="VD: music/cover.jpg hoặc URL ảnh trực tiếp"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-600 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-pink-400 focus:outline-hidden"
              />
              {coverUrl && (
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-stone-200 dark:bg-stone-700 shrink-0 border border-stone-300 dark:border-stone-600">
                  <img
                    src={resolveAudioUrl(coverUrl)}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Mood and Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-stone-800 dark:text-stone-200">
                Tâm trạng / Thể loại
              </label>
              <input
                type="text"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                placeholder="VD: Piano êm dịu, Đọc truyện đêm khuya"
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-600 text-stone-900 dark:text-stone-100 text-xs sm:text-sm focus:ring-2 focus:ring-pink-400 focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-stone-800 dark:text-stone-200">
                Thời lượng (Phút:Giây)
              </label>
              <input
                type="text"
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                placeholder="VD: 03:45"
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-600 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-pink-400 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving || !title.trim() || !filePath.trim()}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-xs sm:text-sm font-semibold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Đang lưu vào Firestore...' : 'Lưu bài hát vào danh sách phát'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Playlist List Management */}
      <div className="p-5 rounded-2xl bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-700 pb-3">
          <span className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Danh sách phát hiện hành ({tracks.length})</span>
          </span>
          <span className="text-[11px] text-stone-500 dark:text-stone-400">
            Bấm nút phát để nghe thử trực tiếp
          </span>
        </div>

        <div className="space-y-2">
          {tracks.map((t, idx) => {
            const isEditing = editingTrackId === t.id;
            const isCurrentPlaying = currentTrack.id === t.id && isPlaying;

            if (isEditing) {
              return (
                <div
                  key={t.id}
                  className="p-4 rounded-xl border border-pink-300 dark:border-pink-800 bg-pink-50/40 dark:bg-stone-900 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-stone-700 dark:text-stone-300">Tên bài hát</label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Tên bài hát"
                        className="w-full px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-stone-700 dark:text-stone-300">Nghệ sĩ</label>
                      <input
                        type="text"
                        value={editArtist}
                        onChange={(e) => setEditArtist(e.target.value)}
                        placeholder="Nghệ sĩ"
                        className="w-full px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-stone-700 dark:text-stone-300">Đường dẫn file tĩnh hoặc URL</label>
                      <input
                        type="text"
                        value={editFilePath}
                        onChange={(e) => setEditFilePath(e.target.value)}
                        placeholder="music/ten-bai-hat.mp3"
                        className="w-full px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-xs font-mono text-stone-900 dark:text-stone-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-stone-700 dark:text-stone-300">Đường dẫn ảnh bìa</label>
                      <input
                        type="text"
                        value={editCoverUrl}
                        onChange={(e) => setEditCoverUrl(e.target.value)}
                        placeholder="music/cover.jpg hoặc URL ảnh"
                        className="w-full px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-xs font-mono text-stone-900 dark:text-stone-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-stone-700 dark:text-stone-300">Tâm trạng / Thể loại</label>
                      <input
                        type="text"
                        value={editMood}
                        onChange={(e) => setEditMood(e.target.value)}
                        placeholder="Tâm trạng / Thể loại"
                        className="w-full px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-stone-700 dark:text-stone-300">Thời lượng (mm:ss)</label>
                      <input
                        type="text"
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                        placeholder="Thời lượng (VD: 03:45)"
                        className="w-full px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-xs font-mono text-stone-900 dark:text-stone-100"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingTrackId(null)}
                      className="px-3 py-1 rounded-lg border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 text-xs cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(t.id)}
                      className="px-3 py-1 rounded-lg bg-pink-500 hover:bg-pink-600 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Lưu thay đổi</span>
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={t.id}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                  isCurrentPlaying
                    ? 'border-pink-300 bg-pink-50/60 dark:bg-pink-950/40 dark:border-pink-800 shadow-2xs'
                    : 'border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/50 hover:bg-stone-100/70 dark:hover:bg-stone-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (currentTrack.id === t.id && isPlaying) {
                        bgmEngine.pause();
                      } else {
                        bgmEngine.play(idx);
                      }
                    }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                      isCurrentPlaying
                        ? 'bg-pink-500 text-white shadow-xs animate-pulse'
                        : 'bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 hover:bg-pink-100'
                    }`}
                    title={isCurrentPlaying ? 'Tạm dừng' : 'Nghe thử bài này'}
                  >
                    {isCurrentPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                  </button>

                  {/* Thumbnail / Cover Art */}
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-stone-200 dark:bg-stone-700 shrink-0 flex items-center justify-center border border-stone-300 dark:border-stone-600">
                    {t.coverUrl ? (
                      <img
                        src={resolveAudioUrl(t.coverUrl)}
                        alt={t.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Music className="w-4 h-4 text-stone-400" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-xs text-stone-900 dark:text-stone-100 truncate">
                        {t.title}
                      </p>
                      <span className="px-1.5 py-0.2 rounded-sm bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-[9px] font-mono">
                        {t.audioUrl.startsWith('http') ? 'URL' : 'Repo file'}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                      {t.artist} • {t.mood || 'Thư giãn'}
                    </p>
                    <p className="text-[10px] text-stone-400 font-mono truncate">
                      {t.audioUrl}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-mono text-stone-400">
                    {t.duration || '03:30'}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleStartEdit(t)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 cursor-pointer"
                    title="Chỉnh sửa bài hát"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemoveTrack(t.id, t.title)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 cursor-pointer"
                    title="Xóa bài hát khỏi danh sách phát"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
