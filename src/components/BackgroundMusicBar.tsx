import React, { useState, useEffect } from 'react';
import {
  bgmEngine,
  AudioTrack,
  formatSecondsToTime,
  resolveAudioUrl,
} from '../utils/audioPlayer';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Music,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Plus,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';

interface BackgroundMusicBarProps {
  onOpenAuthorStudio?: () => void;
}

export const BackgroundMusicBar: React.FC<BackgroundMusicBarProps> = ({ onOpenAuthorStudio }) => {
  const { isAuthor } = useAuth();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<AudioTrack>(() => bgmEngine.getCurrentTrack());
  const [tracks, setTracks] = useState<AudioTrack[]>(() => bgmEngine.getTracks());
  const [volume, setVolume] = useState(0.45);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(195);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = bgmEngine.subscribe((state) => {
      setIsPlaying(state.isPlaying);
      setIsLoading(state.isLoading);
      setCurrentTrack(state.track);
      setVolume(state.volume);
      setIsMuted(state.isMuted);
      setDuration(state.duration || 195);
      setErrorMessage(state.error || null);
      if (state.tracks) {
        setTracks(state.tracks);
      }
      if (!isSeeking) {
        setCurrentTime(state.currentTime);
      }
    });
    return unsubscribe;
  }, [isSeeking]);

  const handleTogglePlay = () => {
    bgmEngine.togglePlay();
  };

  const handleNext = () => {
    bgmEngine.nextTrack();
  };

  const handlePrev = () => {
    bgmEngine.prevTrack();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    bgmEngine.setVolume(val);
  };

  const handleToggleMute = () => {
    bgmEngine.toggleMute();
  };

  const handleSelectTrack = (index: number) => {
    bgmEngine.play(index);
  };

  // Seeking handlers
  const handleSeekStart = () => {
    setIsSeeking(true);
    setSeekValue(currentTime);
    bgmEngine.setSeeking(true, currentTime);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSeekValue(val);
    bgmEngine.setSeeking(true, val);
  };

  const handleSeekEnd = (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    setIsSeeking(false);
    setCurrentTime(val);
    bgmEngine.seek(val);
  };

  // Progress percentage calculation
  const currentDisplayTime = isSeeking ? seekValue : currentTime;
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentDisplayTime / duration) * 100)) : 0;

  return (
    <div
      id="bgm-player-widget"
      className="fixed bottom-4 sm:bottom-6 left-3 sm:left-6 z-40 transition-all duration-300 select-none"
    >
      {/* Expanded Track Selection & Controls Panel */}
      {isExpanded && (
        <div className="mb-2 p-4 rounded-3xl bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border border-pink-200/90 dark:border-stone-700 shadow-2xl w-80 sm:w-88 animate-in fade-in slide-in-from-bottom-2 space-y-3.5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-pink-100 dark:border-stone-800 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-pink-600 dark:text-pink-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Giai điệu đọc truyện ({tracks.length})</span>
            </div>
            <div className="flex items-center gap-1">
              {onOpenAuthorStudio && isAuthor && (
                <button
                  type="button"
                  onClick={() => {
                    setIsExpanded(false);
                    onOpenAuthorStudio();
                  }}
                  className="px-2 py-0.5 rounded-lg bg-pink-100 hover:bg-pink-200 dark:bg-pink-950 dark:hover:bg-pink-900 text-pink-700 dark:text-pink-300 text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  title="Quản lý danh sách nhạc nền"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>Quản lý</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-xs cursor-pointer p-1"
                title="Thu gọn"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Current Playing Track Info with Progress Bar */}
          <div className="p-3 rounded-2xl bg-gradient-to-br from-pink-50/80 via-white to-amber-50/50 dark:from-stone-800 dark:via-stone-800 dark:to-stone-850 border border-pink-100 dark:border-stone-700 space-y-2.5">
            <div className="flex items-center gap-3">
              {/* Album Cover Thumbnail or Animated Music Icon */}
              <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-pink-100 dark:bg-stone-700 shrink-0 border border-pink-200/60 dark:border-stone-600 flex items-center justify-center">
                {currentTrack.coverUrl ? (
                  <img
                    src={currentTrack.coverUrl}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Music className={`w-5 h-5 text-pink-500 ${isPlaying ? 'animate-pulse' : ''}`} />
                )}
                {isPlaying && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <div className="flex items-end gap-0.5 h-3">
                      <span className="w-0.5 h-2.5 bg-white animate-bounce rounded-full" />
                      <span className="w-0.5 h-3.5 bg-white animate-bounce delay-100 rounded-full" />
                      <span className="w-0.5 h-1.5 bg-white animate-bounce delay-200 rounded-full" />
                    </div>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-serif text-xs font-bold text-stone-800 dark:text-stone-100 truncate">
                  {currentTrack.title}
                </p>
                <p className="text-[10px] text-pink-600 dark:text-pink-400 truncate flex items-center gap-1.5 mt-0.5">
                  <span className="truncate">{currentTrack.artist}</span>
                  {currentTrack.storagePath && (
                    <span className="px-1.5 py-0.2 rounded-xs bg-pink-100 dark:bg-pink-950 text-[9px] font-mono uppercase text-pink-700 dark:text-pink-300 shrink-0">
                      Cloud
                    </span>
                  )}
                </p>
              </div>

              <div className="text-[10px] font-mono text-stone-500 dark:text-stone-400 shrink-0 font-medium">
                {formatSecondsToTime(currentDisplayTime)} / {formatSecondsToTime(duration)}
              </div>
            </div>

            {/* Error Message if any */}
            {errorMessage && (
              <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-[10px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span className="truncate">{errorMessage}</span>
              </div>
            )}

            {/* Interactive Seek Bar */}
            <div className="space-y-1">
              <input
                type="range"
                min="0"
                max={duration > 0 ? duration : 100}
                step="0.5"
                value={currentDisplayTime}
                onMouseDown={handleSeekStart}
                onTouchStart={handleSeekStart}
                onChange={handleSeekChange}
                onMouseUp={handleSeekEnd}
                onTouchEnd={handleSeekEnd}
                className="w-full h-1.5 bg-pink-100 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-pink-500 focus:outline-hidden"
                title="Kéo thanh này để tua đến đoạn nhạc mong muốn"
                aria-label="Tua tiến độ bài nhạc"
              />
              <div className="flex justify-between text-[9px] text-stone-400 font-mono">
                <span>{formatSecondsToTime(currentDisplayTime)}</span>
                <span>{formatSecondsToTime(duration)}</span>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-4 pt-0.5">
              <button
                type="button"
                onClick={handlePrev}
                className="p-1.5 rounded-full text-stone-600 dark:text-stone-300 hover:text-pink-600 hover:bg-pink-100/50 dark:hover:bg-stone-700 cursor-pointer transition-colors"
                title="Bài trước đó"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleTogglePlay}
                disabled={isLoading}
                className="w-9 h-9 rounded-full bg-pink-500 hover:bg-pink-600 text-white flex items-center justify-center shadow-xs cursor-pointer transition-all disabled:opacity-75"
                title={isPlaying ? 'Tạm dừng' : 'Phát tiếp'}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="p-1.5 rounded-full text-stone-600 dark:text-stone-300 hover:text-pink-600 hover:bg-pink-100/50 dark:hover:bg-stone-700 cursor-pointer transition-colors"
                title="Bài tiếp theo"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Track List */}
          <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
            {tracks.map((t, idx) => {
              const isSelected = currentTrack.id === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectTrack(idx)}
                  className={`w-full text-left p-2 rounded-xl text-xs transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                    isSelected
                      ? 'bg-pink-100/80 dark:bg-pink-950/70 text-pink-900 dark:text-pink-200 font-medium border border-pink-200 dark:border-pink-800'
                      : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-700 shrink-0 flex items-center justify-center">
                      {t.coverUrl ? (
                        <img
                          src={resolveAudioUrl(t.coverUrl)}
                          alt={t.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Music className="w-3.5 h-3.5 text-stone-400" />
                      )}
                    </div>
                    <div className="truncate min-w-0">
                      <p className="truncate font-medium text-xs">{t.title}</p>
                      <p className="text-[10px] text-stone-400 font-sans truncate">
                        {t.artist} {t.mood ? `• ${t.mood}` : ''}
                      </p>
                    </div>
                  </div>

                  {isSelected && isPlaying ? (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <span className="w-0.5 h-3 bg-pink-500 animate-pulse rounded-full" />
                      <span className="w-0.5 h-4 bg-pink-500 animate-pulse delay-75 rounded-full" />
                      <span className="w-0.5 h-2 bg-pink-500 animate-pulse delay-150 rounded-full" />
                    </div>
                  ) : (
                    <span className="text-[10px] text-stone-400 shrink-0 font-mono">
                      {t.duration || '03:30'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Volume Control */}
          <div className="pt-2 border-t border-pink-100 dark:border-stone-800 flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleMute}
              className="text-stone-500 hover:text-pink-600 dark:text-stone-400 dark:hover:text-pink-400 cursor-pointer p-1"
              title={isMuted ? 'Bật âm lượng' : 'Tắt tiếng'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-500" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-full h-1.5 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
              title={`Âm lượng: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
            />
            <span className="text-[10px] font-mono text-stone-400 w-8 text-right">
              {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
            </span>
          </div>
        </div>
      )}

      {/* Mini Docked Floating Capsule with Live HTML5 Audio Progress */}
      <div className="relative group overflow-hidden rounded-full bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border border-pink-200 dark:border-stone-700 shadow-lg hover:shadow-xl transition-all">
        {/* Subtle Live Progress Bar at bottom of capsule */}
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-pink-500 to-rose-500 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />

        <div className="flex items-center gap-2 p-1.5 sm:p-2">
          {/* Play / Pause Toggle Button */}
          <button
            type="button"
            onClick={handleTogglePlay}
            disabled={isLoading}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0 ${
              isPlaying
                ? 'bg-gradient-to-tr from-pink-500 to-rose-500 text-white animate-pulse'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-pink-100 dark:hover:bg-stone-700'
            }`}
            title={isPlaying ? 'Tạm dừng nhạc nền' : 'Bật nhạc nền thư giãn'}
            aria-label={isPlaying ? 'Tạm dừng nhạc nền' : 'Bật nhạc nền'}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-pink-500" />
            ) : isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </button>

          {/* Track Title, Progress Time and Waveform / Cover */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 px-1 sm:px-2 text-left cursor-pointer focus:outline-hidden"
            title="Bấm để mở bảng điều khiển, tua nhạc & danh sách bài hát"
          >
            {/* Cover art thumbnail or Animated Waveform */}
            {currentTrack.coverUrl ? (
              <div className="w-5 h-5 rounded-md overflow-hidden bg-stone-100 shrink-0">
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  className={`w-full h-full object-cover ${isPlaying ? 'animate-spin-slow' : ''}`}
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : isPlaying ? (
              <div className="flex items-end gap-0.5 h-3.5 shrink-0">
                <span className="w-1 h-3 bg-pink-500 animate-bounce rounded-full" />
                <span className="w-1 h-4.5 bg-rose-500 animate-bounce delay-100 rounded-full" />
                <span className="w-1 h-2 bg-amber-500 animate-bounce delay-200 rounded-full" />
              </div>
            ) : (
              <Music className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            )}

            <div className="flex flex-col min-w-0 max-w-[120px] sm:max-w-[170px]">
              <span className="text-[11px] sm:text-xs font-serif font-medium text-stone-800 dark:text-stone-100 truncate">
                {currentTrack.title}
              </span>
              <div className="flex items-center gap-1 text-[9px] text-pink-600 dark:text-pink-400 font-sans truncate">
                {isPlaying ? (
                  <span>
                    {formatSecondsToTime(currentDisplayTime)} / {formatSecondsToTime(duration)}
                  </span>
                ) : (
                  <span>Bấm để nghe nhạc ♪</span>
                )}
              </div>
            </div>

            <div className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 pl-1 shrink-0">
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </div>
          </button>

          {/* Quick Next Track Button */}
          {isPlaying && (
            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 rounded-full hover:bg-pink-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-400 hover:text-pink-600 transition-colors cursor-pointer shrink-0"
              title="Chuyển bài tiếp theo"
              aria-label="Chuyển bài"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
