import {
  AlertCircle,
  Film,
  Loader2,
  Maximize,
  Pause,
  Play,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { Track } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaybackState } from '../types/room';

interface MoviePlayerProps {
  isHost: boolean;
  movieTitle: string | null;
  onMovieSelect?: (file: File) => void;
  onMovieStreamReady?: (video: HTMLVideoElement) => void;
  onPlaybackEvent?: (type: string, payload: Record<string, unknown>) => void;
  onClearMovie?: () => void;
  onMovieDurationReady?: (duration: number) => void;
  playbackState?: PlaybackState;
  roomCode?: string;
  remoteMovieVideoTrack?: Track;
  remoteMovieAudioTrack?: Track;
}

export default function MoviePlayer({
  isHost,
  movieTitle,
  onMovieSelect,
  onMovieStreamReady,
  onPlaybackEvent,
  remoteMovieVideoTrack,
  remoteMovieAudioTrack,
  onClearMovie,
  onMovieDurationReady,
  playbackState,
  roomCode,
}: MoviePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localTitle, setLocalTitle] = useState<string | null>(movieTitle);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMovie, setHasMovie] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const saveFile = async (file: File) => {
    if (!roomCode) return;
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cine-together', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('movies');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction('movies', 'readwrite').objectStore('movies').put(file, roomCode);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  };

  const loadSavedFile = async () => {
    if (!roomCode) return null;
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('cine-together', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('movies');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return await new Promise<File | null>((resolve, reject) => {
        const request = db.transaction('movies', 'readonly').objectStore('movies').get(roomCode);
        request.onsuccess = () => resolve((request.result as File | undefined) ?? null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  };

  useEffect(() => {
    setLocalTitle(movieTitle);
  }, [movieTitle]);

  useEffect(() => {
    if (!isHost || !movieTitle || hasMovie || !videoRef.current) return;
    let cancelled = false;
    setLoading(true);
    loadSavedFile().then((file) => {
      if (cancelled || !videoRef.current) return;
      if (!file) {
        setLoading(false);
        setError('The saved movie file is unavailable. Choose the movie again to continue sharing.');
        return;
      }
      const url = URL.createObjectURL(file);
      videoRef.current.src = url;
      videoRef.current.load();
    });
    return () => {
      cancelled = true;
    };
  }, [hasMovie, isHost, movieTitle, roomCode]);

  useEffect(() => {
    if (!remoteMovieVideoTrack || !videoRef.current || (isHost && hasMovie)) return;
    remoteMovieVideoTrack.attach(videoRef.current);
    setHasMovie(true);
    return () => {
      remoteMovieVideoTrack.detach(videoRef.current!);
    };
  }, [hasMovie, isHost, remoteMovieVideoTrack]);

  useEffect(() => {
    if (!remoteMovieAudioTrack || !audioRef.current) return;
    remoteMovieAudioTrack.attach(audioRef.current);
    audioRef.current.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
    return () => {
      remoteMovieAudioTrack.detach(audioRef.current!);
    };
  }, [isHost, remoteMovieAudioTrack]);

  useEffect(() => {
    if (!isHost && playbackState?.duration && Number.isFinite(playbackState.duration)) {
      setDuration(playbackState.duration);
    }
  }, [isHost, playbackState?.duration]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackState || !remoteMovieVideoTrack || (isHost && hasMovie)) return;
    const drift = Math.abs(video.currentTime - playbackState.position);
    if (drift > 0.5) video.currentTime = playbackState.position;
    setCurrentTime(playbackState.position);
    if (playbackState.is_playing && video.paused) {
      video.play().catch(() => setError('Click the video to allow playback audio.'));
    } else if (!playbackState.is_playing && !video.paused) {
      video.pause();
    }
  }, [hasMovie, isHost, playbackState, remoteMovieVideoTrack]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !videoRef.current) return;

    e.target.value = '';
    setError(null);
    setLoading(true);
    setLocalTitle(file.name);
    try {
      await saveFile(file);
    } catch {
      setError('Could not save this movie for refresh recovery.');
    }

    const url = URL.createObjectURL(file);
    videoRef.current.src = url;
    videoRef.current.load();

    onMovieSelect?.(file);
  };

  const onLoadedData = () => {
    setLoading(false);
    setHasMovie(true);
    if (videoRef.current) {
      const mediaDuration = videoRef.current.duration;
      if (Number.isFinite(mediaDuration) && mediaDuration > 0) {
        setDuration(mediaDuration);
        onMovieDurationReady?.(mediaDuration);
      }
      onMovieStreamReady?.(videoRef.current);
    }
  };

  const onError = () => {
    setLoading(false);
    setError('Unable to play this video format. Try MP4 (H.264 + AAC) or WebM.');
    setHasMovie(false);
  };

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      void videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      if (isHost) {
        onPlaybackEvent?.('playback_pause', { position: videoRef.current.currentTime });
      }
    }
  }, [isHost, onPlaybackEvent]);

  const clearMovie = () => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.removeAttribute('src');
    videoRef.current.load();
    setLocalTitle(null);
    setHasMovie(false);
    setCurrentTime(0);
    setDuration(0);
    onClearMovie?.();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const time = parseFloat(e.target.value);
    videoRef.current.currentTime = time;
    setCurrentTime(time);
    if (isHost) onPlaybackEvent?.('playback_seek', { position: time });
  };

  const enableAudio = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = false;
    try {
      await audio.play();
      setMuted(false);
      setAudioBlocked(false);
    } catch {
      setAudioBlocked(true);
    }
  };

  const toggleMute = () => {
    const target = isHost ? videoRef.current : audioRef.current;
    if (!target) return;
    if (!isHost && audioBlocked) {
      void enableAudio();
      return;
    }
    target.muted = !muted;
    setMuted(!muted);
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = isHost ? videoRef.current : audioRef.current;
    if (!target) return;
    const vol = parseFloat(e.target.value);
    target.volume = vol;
    setVolume(vol);
    setMuted(vol === 0);
  };

  const toggleFullscreen = () => {
    const container = videoRef.current?.parentElement;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  };

  const formatTime = (t: number) => {
    if (!Number.isFinite(t) || t < 0) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-navy-900 rounded-xl border border-navy-700 overflow-hidden">
      <div className="relative flex-1 bg-black flex items-center justify-center min-h-0">
        <video
          ref={videoRef}
          className={`w-full h-full object-contain ${hasMovie ? 'block' : 'hidden'}`}
          onLoadedData={onLoadedData}
          onError={onError}
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
          onPlay={() => {
            setIsPlaying(true);
            if (isHost) {
              onPlaybackEvent?.('playback_play', {
                position: videoRef.current?.currentTime ?? 0,
              });
            }
          }}
          onPause={() => {
            setIsPlaying(false);
            if (isHost) {
              onPlaybackEvent?.('playback_pause', {
                position: videoRef.current?.currentTime ?? 0,
              });
            }
          }}
          onDurationChange={() => {
            const mediaDuration = videoRef.current?.duration ?? 0;
            if (Number.isFinite(mediaDuration) && mediaDuration > 0) setDuration(mediaDuration);
          }}
          playsInline
        />
        <audio ref={audioRef} autoPlay playsInline />

        {!isHost && audioBlocked && hasMovie && (
          <button
            onClick={enableAudio}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-accent-violet px-3 py-2 text-xs font-medium text-white"
          >
            Enable sound
          </button>
        )}

        {!hasMovie && !loading && (
          <div className="flex flex-col items-center gap-4 text-slate-400 p-8 text-center">
            <Film className="w-16 h-16 text-navy-700" />
            {isHost ? (
              <>
                <p className="text-lg">Select a movie to watch together</p>
                <p className="text-sm text-slate-500">Supports MP4, WebM, and other browser-playable formats</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-accent-blue to-accent-violet text-white font-medium hover:opacity-90 transition-opacity"
                >
                  <Upload className="w-5 h-5" />
                  Choose Movie File
                </button>
              </>
            ) : (
              <>
                <p className="text-lg">Waiting for the host to select a movie</p>
                <p className="text-sm text-slate-500">
                  The movie stream will appear here once the host starts sharing (Phase 3)
                </p>
              </>
            )}
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 className="w-10 h-10 text-accent-violet animate-spin" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
            <div className="flex flex-col items-center gap-3 text-red-400 text-center">
              <AlertCircle className="w-10 h-10" />
              <p>{error}</p>
            </div>
          </div>
        )}
      </div>

      {localTitle && (
        <div className="px-4 py-2 text-sm text-slate-400 truncate border-t border-navy-700">
          {localTitle}
        </div>
      )}

      <div className="flex items-center gap-3 px-4 py-3 border-t border-navy-700 bg-navy-800">
        {hasMovie && (
          <button
            onClick={togglePlay}
            className="p-2 rounded-lg hover:bg-navy-700 transition-colors text-slate-200"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
        )}

        {hasMovie && (
          <>
            <span className="text-xs text-slate-400 w-10">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={Number.isFinite(duration) && duration > 0 ? duration : 0}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              disabled={!Number.isFinite(duration) || duration <= 0}
              className="flex-1 h-1 accent-accent-violet disabled:opacity-50"
            />
            <span className="text-xs text-slate-400 w-10">{formatTime(duration)}</span>
          </>
        )}

        <div className="flex items-center gap-1 ml-auto">
          <button onClick={toggleMute} className="p-2 rounded-lg hover:bg-navy-700 transition-colors text-slate-400">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={handleVolume}
            className="w-20 h-1 accent-accent-violet"
          />
          {isHost && hasMovie && (
            <button
              onClick={clearMovie}
              className="px-2 py-1 text-xs text-slate-400 hover:text-red-300"
              aria-label="Remove movie"
            >
              Remove
            </button>
          )}
          {isHost && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
              aria-label="Replace movie"
            >
              <Upload className="w-3.5 h-3.5" /> Replace
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-navy-700 transition-colors text-slate-400"
            aria-label="Fullscreen"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isHost && (
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/ogg,video/quicktime,.mp4,.webm,.mkv,.mov"
          className="hidden"
          onChange={handleFileSelect}
        />
      )}
    </div>
  );
}
