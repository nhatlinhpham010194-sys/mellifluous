import React, { useState, useEffect, useRef } from 'react';
import {
  Music,
  Plus,
  Trash2,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Save,
  X,
  Sparkles,
  UploadCloud,
  FileAudio,
  Image as ImageIcon,
  HardDrive,
  Cloud,
  Check,
  Loader2,
  Info,
  Link as LinkIcon,
} from 'lucide-react';
import {
  bgmEngine,
  AudioTrack,
  formatSecondsToTime,
} from '../../utils/audioPlayer';
import {
  detectAudioDuration,
  uploadAudioFileToStorage,
  uploadCoverImageToStorage,
  formatBytes,
} from '../../utils/audioStorage';

interface AuthorMusicTabProps {
  onFeedback: (type: 'success' | 'error', text: string) => void;
}

export const AuthorMusicTab: React.FC<AuthorMusicTabProps> = ({ onFeedback }) => {
  const [tracks, setTracks] = useState<AudioTrack[]>(() => bgmEngine.getTracks());
  const [isPlaying, setIsPlaying] = useState<boolean>(() => bgmEngine.getIsPlaying());
  const [currentTrack, setCurrentTrack] = useState<AudioTrack>(() => bgmEngine.getCurrentTrack());
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(195);

  // Upload method: 'file' (Firebase Storage) or 'url' (Direct streaming link)
  const [uploadMethod, setUploadMethod] = useState<'file' | 'url'>('file');

  // File state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioFileSizeText, setAudioFileSizeText] = useState<string>('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [audioUrlInput, setAudioUrlInput] = useState('');
  const [mood, setMood] = useState('');
  const [durationInput, setDurationInput] = useState('03:30');
  const [durationSeconds, setDurationSeconds] = useState(210);

  // Upload progress states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('');

  // Edit track states
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editMood, setEditMood] = useState('');
  const [editDuration, setEditDuration] = useState('03:30');

  // Seek bar state
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

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

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (coverPreviewUrl && coverPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
    };
  }, [coverPreviewUrl]);

  // Handle Audio File Selection
  const handleAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check supported types
    const validExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.flac'];
    const lowerName = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => lowerName.endsWith(ext)) || file.type.startsWith('audio/');

    if (!isValid) {
      onFeedback('error', 'Vui lòng chọn định dạng file âm thanh hợp lệ (.mp3, .wav, .m4a, .ogg).');
      return;
    }

    setAudioFile(file);
    setAudioFileSizeText(formatBytes(file.size));

    // Auto-fill song title if empty
    if (!title.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setTitle(baseName);
    }

    // Auto-detect duration from file
    try {
      const detected = await detectAudioDuration(file);
      setDurationInput(detected.durationFormatted);
      setDurationSeconds(detected.durationSeconds);
    } catch {
      setDurationInput('03:30');
      setDurationSeconds(210);
    }
  };

  // Handle Cover Art Selection
  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onFeedback('error', 'Vui lòng chọn file hình ảnh hợp lệ (.jpg, .png, .webp).');
      return;
    }

    if (coverPreviewUrl && coverPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(coverPreviewUrl);
    }

    setCoverFile(file);
    setCoverPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveSelectedAudio = () => {
    setAudioFile(null);
    setAudioFileSizeText('');
    if (audioInputRef.current) audioInputRef.current.value = '';
  };

  const handleRemoveSelectedCover = () => {
    if (coverPreviewUrl && coverPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(coverPreviewUrl);
    }
    setCoverFile(null);
    setCoverPreviewUrl(null);
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  // Submit Handler: Upload to Firebase Storage & Save to Firestore
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      onFeedback('error', 'Vui lòng nhập tên bài hát / tác phẩm.');
      return;
    }

    if (uploadMethod === 'file' && !audioFile) {
      onFeedback('error', 'Vui lòng chọn file âm thanh (.mp3, .wav) để tải lên Firebase Storage.');
      return;
    }

    if (uploadMethod === 'url' && !audioUrlInput.trim()) {
      onFeedback('error', 'Vui lòng nhập đường dẫn URL tệp âm thanh trực tiếp.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStage('Chuẩn bị tải lên...');

    try {
      let finalAudioUrl = '';
      let storagePath: string | undefined = undefined;
      let fileSize: number | undefined = undefined;
      let coverUrl: string | undefined = undefined;
      let coverStoragePath: string | undefined = undefined;

      // 1. Upload audio file to Firebase Storage
      if (uploadMethod === 'file' && audioFile) {
        setUploadStage('Đang tải tệp nhạc lên Firebase Storage...');
        const audioUploadResult = await uploadAudioFileToStorage(audioFile, (pct) => {
          setUploadProgress(pct);
        });
        finalAudioUrl = audioUploadResult.downloadUrl;
        storagePath = audioUploadResult.storagePath;
        fileSize = audioUploadResult.fileSize;
      } else {
        finalAudioUrl = audioUrlInput.trim();
      }

      // 2. Upload cover image to Firebase Storage if provided
      if (coverFile) {
        setUploadStage('Đang tải ảnh bìa lên...');
        const coverUploadResult = await uploadCoverImageToStorage(coverFile);
        coverUrl = coverUploadResult.downloadUrl;
        coverStoragePath = coverUploadResult.storagePath;
      }

      // 3. Save metadata to Firestore and add to local playlist
      setUploadStage('Đang lưu thông tin bài hát vào cơ sở dữ liệu...');
      await bgmEngine.addTrack({
        title: title.trim(),
        artist: artist.trim() || 'Mellifluous Piano',
        audioUrl: finalAudioUrl,
        storagePath,
        coverUrl,
        coverStoragePath,
        duration: durationInput.trim() || '03:30',
        durationSeconds: durationSeconds || 210,
        mood: mood.trim() || 'Giai điệu thư giãn',
        fileSize,
        addedBy: 'Tác giả / BQT',
      });

      onFeedback('success', `Đã tải lên và lưu bài hát "${title.trim()}" thành công!`);

      // Reset form
      setTitle('');
      setArtist('');
      setMood('');
      setAudioUrlInput('');
      setDurationInput('03:30');
      setDurationSeconds(210);
      handleRemoveSelectedAudio();
      handleRemoveSelectedCover();
    } catch (err: any) {
      console.error('Add track error:', err);
      onFeedback('error', `Lỗi khi tải lên bài hát: ${err.message || 'Vui lòng kiểm tra lại kết nối mạng.'}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStage('');
    }
  };

  const handleStartEdit = (t: AudioTrack) => {
    setEditingTrackId(t.id);
    setEditTitle(t.title);
    setEditArtist(t.artist);
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
        onFeedback('success', `Đã xóa bài hát "${trackTitle}" và giải phóng bộ nhớ.`);
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
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <span>Quản Lý Nhạc Nền & Firebase Storage</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-800 dark:bg-pink-950/80 dark:text-pink-300 font-sans font-medium">
                  {tracks.length} bài hát
                </span>
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-300 font-sans mt-0.5">
                Tất cả bài hát được lưu trữ trực tiếp trên Firebase Storage và phát qua trình phát HTML5 duy nhất, hoạt động mượt mà không bị phụ thuộc iframe.
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
                  src={currentTrack.coverUrl}
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
                {currentTrack.storagePath && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 font-mono font-medium uppercase">
                    Firebase Cloud
                  </span>
                )}
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

      {/* Upload Music Form */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-700 pb-3">
          <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-pink-500" />
            <span>Tải Nhạc Lên Danh Sách Phát</span>
          </h4>

          {/* Mode Switcher */}
          <div className="inline-flex rounded-xl bg-stone-100 dark:bg-stone-800 p-1 text-xs">
            <button
              type="button"
              onClick={() => setUploadMethod('file')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                uploadMethod === 'file'
                  ? 'bg-white dark:bg-stone-700 text-pink-600 dark:text-pink-300 shadow-xs'
                  : 'text-stone-500 hover:text-stone-900 dark:text-stone-400'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Tải file trực tiếp (Firebase)</span>
            </button>
            <button
              type="button"
              onClick={() => setUploadMethod('url')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                uploadMethod === 'url'
                  ? 'bg-white dark:bg-stone-700 text-pink-600 dark:text-pink-300 shadow-xs'
                  : 'text-stone-500 hover:text-stone-900 dark:text-stone-400'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Dán đường dẫn audio</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File Upload Zone */}
          {uploadMethod === 'file' ? (
            <div className="space-y-3">
              <div
                onClick={() => audioInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                  audioFile
                    ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20'
                    : 'border-pink-300 dark:border-stone-600 hover:border-pink-500 bg-pink-50/20 dark:bg-stone-900/40'
                }`}
              >
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/mp3,audio/wav,audio/m4a,audio/ogg,audio/mpeg,audio/*"
                  onChange={handleAudioFileChange}
                  className="hidden"
                />

                {audioFile ? (
                  <div className="flex items-center gap-3 text-left w-full max-w-md p-2 rounded-xl bg-white dark:bg-stone-800 shadow-xs">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <FileAudio className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs text-stone-800 dark:text-stone-100 truncate">
                        {audioFile.name}
                      </p>
                      <p className="text-[10px] text-stone-400 font-sans">
                        Dung lượng: {audioFileSizeText} • Thời lượng: {durationInput}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSelectedAudio();
                      }}
                      className="p-1 rounded-md text-stone-400 hover:text-rose-500 cursor-pointer"
                      title="Hủy chọn file này"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-pink-100 dark:bg-stone-800 text-pink-500 flex items-center justify-center">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-stone-800 dark:text-stone-100">
                        Nhấn để chọn file nhạc từ máy tính của bạn
                      </p>
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        Hỗ trợ định dạng MP3, WAV, M4A, OGG. Hệ thống sẽ tự động đo thời lượng bài hát.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1">
                <LinkIcon className="w-3.5 h-3.5 text-pink-500" />
                <span>Đường dẫn tệp âm thanh trực tiếp (Direct Audio URL):</span>
              </label>
              <input
                type="url"
                value={audioUrlInput}
                onChange={(e) => setAudioUrlInput(e.target.value)}
                placeholder="VD: https://domain.com/audio.mp3 hoặc link trực tiếp"
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-600 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-pink-400 focus:outline-hidden"
              />
            </div>
          )}

          {/* Cover Art Upload (Optional) */}
          <div className="p-3.5 rounded-xl bg-stone-50/70 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-stone-200 dark:bg-stone-700 flex items-center justify-center shrink-0 border border-stone-300 dark:border-stone-600">
                {coverPreviewUrl ? (
                  <img
                    src={coverPreviewUrl}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-5 h-5 text-stone-400" />
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                  Ảnh bìa bài hát (Tùy chọn)
                </p>
                <p className="text-[10px] text-stone-400">
                  Hiển thị hình minh họa đĩa nhạc khi phát bài hát này
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-xs font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 cursor-pointer transition-colors"
              >
                {coverPreviewUrl ? 'Đổi ảnh bìa' : 'Tải ảnh bìa lên'}
              </button>
              {coverPreviewUrl && (
                <button
                  type="button"
                  onClick={handleRemoveSelectedCover}
                  className="p-1.5 text-stone-400 hover:text-rose-500 cursor-pointer"
                  title="Gỡ ảnh bìa"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
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
                placeholder="VD: Mellifluous Chill"
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-600 text-stone-900 dark:text-stone-100 text-xs sm:text-sm focus:ring-2 focus:ring-pink-400 focus:outline-hidden"
              />
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

          {/* Upload Progress Bar (when uploading) */}
          {isUploading && (
            <div className="p-3.5 rounded-xl bg-pink-50 dark:bg-stone-900 border border-pink-200 dark:border-stone-700 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-pink-700 dark:text-pink-300 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{uploadStage}</span>
                </span>
                <span className="font-mono font-bold text-pink-600 dark:text-pink-400">
                  {uploadProgress}%
                </span>
              </div>
              <div className="w-full h-2 bg-pink-100 dark:bg-stone-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isUploading || !title.trim() || (uploadMethod === 'file' && !audioFile) || (uploadMethod === 'url' && !audioUrlInput.trim())}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-xs sm:text-sm font-semibold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang tải lên Firebase Storage...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Tải lên Firebase Storage & Lưu bài hát</span>
                </>
              )}
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
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Tên bài hát"
                      className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100"
                    />
                    <input
                      type="text"
                      value={editArtist}
                      onChange={(e) => setEditArtist(e.target.value)}
                      placeholder="Nghệ sĩ"
                      className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={editMood}
                      onChange={(e) => setEditMood(e.target.value)}
                      placeholder="Tâm trạng / Thể loại"
                      className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100"
                    />
                    <input
                      type="text"
                      value={editDuration}
                      onChange={(e) => setEditDuration(e.target.value)}
                      placeholder="Thời lượng (VD: 03:45)"
                      className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-xs font-mono text-stone-900 dark:text-stone-100"
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
                        src={t.coverUrl}
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
                      {t.storagePath ? (
                        <span className="px-1.5 py-0.2 rounded-sm bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 text-[9px] font-mono flex items-center gap-1">
                          <Cloud className="w-2.5 h-2.5" />
                          <span>Firebase</span>
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded-sm bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-[9px] font-mono">
                          Direct
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
                    title="Xóa bài hát và file trên Firebase Storage"
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
