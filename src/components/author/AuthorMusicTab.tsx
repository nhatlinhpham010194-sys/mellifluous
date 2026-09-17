import React, { useState, useEffect } from 'react';
import {
  Music,
  Plus,
  Trash2,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Link,
  Edit2,
  Save,
  X,
  Volume2,
  Radio,
  ExternalLink,
  Info,
  Sparkles,
} from 'lucide-react';
import {
  bgmEngine,
  AudioTrack,
  DEFAULT_TRACK_LIST,
  formatSecondsToTime,
  AudioSourceType,
} from '../../utils/audioPlayer';

interface AuthorMusicTabProps {
  onFeedback: (type: 'success' | 'error', text: string) => void;
}

export const AuthorMusicTab: React.FC<AuthorMusicTabProps> = ({ onFeedback }) => {
  const [tracks, setTracks] = useState<AudioTrack[]>(() => bgmEngine.getTracks());
  const [isPlaying, setIsPlaying] = useState<boolean>(() => bgmEngine.getIsPlaying());
  const [currentTrack, setCurrentTrack] = useState<AudioTrack>(() => bgmEngine.getCurrentTrack());
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(210);
  const [sourceType, setSourceType] = useState<AudioSourceType>('synth');

  // Form states
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [mood, setMood] = useState('');
  const [durationInput, setDurationInput] = useState('03:30');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit state
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editAudioUrl, setEditAudioUrl] = useState('');
  const [editMood, setEditMood] = useState('');
  const [editDuration, setEditDuration] = useState('03:30');

  // Seeking state
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  useEffect(() => {
    const unsubscribe = bgmEngine.subscribe((state) => {
      setTracks(state.tracks);
      setIsPlaying(state.isPlaying);
      setCurrentTrack(state.track);
      setDuration(state.duration || 210);
      setSourceType(state.sourceType);
      if (!isSeeking) {
        setCurrentTime(state.currentTime);
      }
    });
    return unsubscribe;
  }, [isSeeking]);

  const handleAddTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      onFeedback('error', 'Vui lòng nhập tên bài hát / tác phẩm.');
      return;
    }

    setIsSubmitting(true);
    try {
      await bgmEngine.addTrack({
        title: title.trim(),
        artist: artist.trim() || 'Mellifluous Chill',
        audioUrl: audioUrl.trim() || undefined,
        mood: mood.trim() || (audioUrl.trim() ? 'Nhạc phát trực tuyến' : 'Giai điệu thư giãn'),
        duration: durationInput.trim() || '03:30',
        addedBy: 'Tác giả / BQT',
      });

      onFeedback('success', `Đã thêm bài hát "${title.trim()}" vào playlist thành công!`);
      setTitle('');
      setArtist('');
      setAudioUrl('');
      setMood('');
      setDurationInput('03:30');
    } catch {
      onFeedback('error', 'Không thể thêm bài hát. Vui lòng kiểm tra lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (t: AudioTrack) => {
    setEditingTrackId(t.id);
    setEditTitle(t.title);
    setEditArtist(t.artist);
    setEditAudioUrl(t.audioUrl || '');
    setEditMood(t.mood || '');
    setEditDuration(t.duration || '03:30');
  };

  const handleSaveEdit = async (trackId: string) => {
    if (!editTitle.trim()) {
      onFeedback('error', 'Tên bài hát không được để trống.');
      return;
    }

    try {
      await bgmEngine.updateTrack(trackId, {
        title: editTitle.trim(),
        artist: editArtist.trim() || 'Mellifluous',
        audioUrl: editAudioUrl.trim() || undefined,
        mood: editMood.trim() || undefined,
        duration: editDuration.trim() || undefined,
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
        onFeedback('success', `Đã xóa bài hát "${trackTitle}" khỏi playlist.`);
      }
    } catch {
      onFeedback('error', 'Không thể xóa bài hát này.');
    }
  };

  const handleResetTracks = async () => {
    try {
      await bgmEngine.resetToDefaultTracks();
      onFeedback('success', 'Đã khôi phục danh sách nhạc nền mặc định.');
    } catch {
      onFeedback('error', 'Không thể đặt lại danh sách nhạc.');
    }
  };

  const handlePlayTrack = (trackIndex: number) => {
    bgmEngine.play(trackIndex);
  };

  const handleTogglePlay = () => {
    bgmEngine.togglePlay();
  };

  const handleSeekStart = () => {
    setIsSeeking(true);
    setSeekValue(currentTime);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSeekValue(parseFloat(e.target.value));
  };

  const handleSeekEnd = (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    setIsSeeking(false);
    setCurrentTime(val);
    bgmEngine.seek(val);
  };

  return (
    <div id="author-music-management-tab" className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-pink-50 via-rose-50/80 to-amber-50/80 dark:from-stone-800 dark:via-stone-850 dark:to-stone-800 border border-pink-200/90 dark:border-stone-700 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <span>Quản Lý Playlist Nhạc Nền Đọc Truyện</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-800 dark:bg-pink-950/80 dark:text-pink-300 font-sans font-medium">
                  {tracks.length} bài hát
                </span>
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-300 font-sans mt-0.5">
                Tác giả có thể thêm link nhạc từ SoundCloud, Google Drive, YouTube, MP3 trực tiếp hoặc sử dụng giai điệu piano lofi có sẵn.
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

      {/* Live Preview Player with Seek & Progress Bar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-700 pb-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTogglePlay}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0 ${
                isPlaying
                  ? 'bg-gradient-to-tr from-pink-500 to-rose-500 text-white animate-pulse'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-pink-100 dark:hover:bg-stone-700'
              }`}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                  {currentTrack.title}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 font-mono font-medium uppercase">
                  {sourceType}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                {currentTrack.artist} • {currentTrack.mood || 'Thư giãn'}
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
            max={duration || 100}
            step="1"
            value={isSeeking ? seekValue : currentTime}
            onMouseDown={handleSeekStart}
            onTouchStart={handleSeekStart}
            onChange={handleSeekChange}
            onMouseUp={handleSeekEnd}
            onTouchEnd={handleSeekEnd}
            className="w-full h-2 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-pink-500 focus:outline-hidden"
            title="Kéo để tua nhanh hoặc quay lại đoạn nhạc"
          />
          <div className="flex justify-between text-[10px] text-stone-400 font-mono">
            <span>{formatSecondsToTime(isSeeking ? seekValue : currentTime)}</span>
            <span>{formatSecondsToTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Format Support Guide */}
      <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-stone-800/60 border border-amber-200/80 dark:border-stone-700 text-xs text-stone-700 dark:text-stone-300 space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>Hướng dẫn gắn link nhạc đa nền tảng cho Tác giả:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] leading-relaxed text-stone-600 dark:text-stone-300">
          <div className="p-2 rounded-xl bg-white/70 dark:bg-stone-850/80 border border-stone-200 dark:border-stone-700">
            <strong>☁️ SoundCloud:</strong> Dán link bài hát SoundCloud (VD: <code className="text-pink-600 font-mono">soundcloud.com/nghesi/baihat</code>). Hệ thống sẽ tự động chuyển sang SoundCloud Player chính chủ.
          </div>
          <div className="p-2 rounded-xl bg-white/70 dark:bg-stone-850/80 border border-stone-200 dark:border-stone-700">
            <strong>📁 Google Drive:</strong> Mở quyền chia sẻ file audio ("Bất kỳ ai có đường link") và dán link (VD: <code className="text-pink-600 font-mono">drive.google.com/file/d/.../view</code>). Hệ thống sẽ tự động stream trực tiếp!
          </div>
          <div className="p-2 rounded-xl bg-white/70 dark:bg-stone-850/80 border border-stone-200 dark:border-stone-700">
            <strong>▶️ YouTube:</strong> Dán link video YouTube (VD: <code className="text-pink-600 font-mono">youtube.com/watch?v=...</code> hoặc <code className="text-pink-600 font-mono">youtu.be/...</code>) để phát nhạc nền.
          </div>
          <div className="p-2 rounded-xl bg-white/70 dark:bg-stone-850/80 border border-stone-200 dark:border-stone-700">
            <strong>🎵 File MP3 / Dropbox:</strong> Dán link direct file kết thúc bằng <code className="text-pink-600 font-mono">.mp3</code>, <code className="text-pink-600 font-mono">.m4a</code>, hoặc link Dropbox chia sẻ.
          </div>
        </div>
      </div>

      {/* Add New Track Form */}
      <div className="p-5 rounded-2xl bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 shadow-2xs space-y-4">
        <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-pink-500" />
          <span>Thêm bài hát mới vào danh sách phát:</span>
        </h4>

        <form onSubmit={handleAddTrack} className="space-y-3">
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
                placeholder="VD: Sứ Thanh Hoa (Châu Kiệt Luân)"
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
                placeholder="VD: Piano Solo / Mellifluous"
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-600 text-stone-900 dark:text-stone-100 text-xs sm:text-sm focus:ring-2 focus:ring-pink-400 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1">
              <Link className="w-3.5 h-3.5 text-pink-500" />
              <span>Link phát nhạc trực tuyến (SoundCloud, Google Drive, YouTube, MP3 URL...):</span>
            </label>
            <input
              type="url"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              placeholder="Dán link SoundCloud, Google Drive hoặc link file .mp3 (để trống nếu muốn dùng giai điệu piano lofi có sẵn)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-600 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-pink-400 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-stone-800 dark:text-stone-200">
                Mô tả / Thể loại cảm xúc
              </label>
              <input
                type="text"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                placeholder="VD: Piano nhẹ nhàng, Êm dịu đêm khuya..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-600 text-stone-900 dark:text-stone-100 text-xs sm:text-sm focus:ring-2 focus:ring-pink-400 focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-stone-800 dark:text-stone-200">
                Thời lượng bài hát (Phút:Giây)
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

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-xs sm:text-sm font-semibold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang thêm...' : 'Thêm vào danh sách phát'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Playlist List */}
      <div className="p-5 rounded-2xl bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-700 pb-3">
          <span className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Danh sách phát hiện hành ({tracks.length})</span>
          </span>
          <span className="text-[11px] text-stone-500 dark:text-stone-400">
            Bấm nút phát để nghe thử
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
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Tên bài hát"
                      className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-xs"
                    />
                    <input
                      type="text"
                      value={editArtist}
                      onChange={(e) => setEditArtist(e.target.value)}
                      placeholder="Nghệ sĩ"
                      className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-xs"
                    />
                  </div>
                  <input
                    type="url"
                    value={editAudioUrl}
                    onChange={(e) => setEditAudioUrl(e.target.value)}
                    placeholder="Link bài hát (SoundCloud / Drive / YouTube / MP3)"
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-xs font-mono"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={editMood}
                      onChange={(e) => setEditMood(e.target.value)}
                      placeholder="Cảm xúc / Thể loại"
                      className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-xs"
                    />
                    <input
                      type="text"
                      value={editDuration}
                      onChange={(e) => setEditDuration(e.target.value)}
                      placeholder="Thời lượng (VD: 03:45)"
                      className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-xs font-mono"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingTrackId(null)}
                      className="px-3 py-1 rounded-lg border border-stone-300 text-stone-600 dark:text-stone-300 text-xs cursor-pointer"
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
                        handleTogglePlay();
                      } else {
                        handlePlayTrack(idx);
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

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-xs text-stone-900 dark:text-stone-100 truncate">
                        {t.title}
                      </p>
                      {t.audioUrl && (
                        <span className="px-1.5 py-0.2 rounded-sm bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[9px] font-mono">
                          Link online
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                      {t.artist} • {t.mood || 'Thư giãn'}
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
                    title="Xóa bài hát"
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
