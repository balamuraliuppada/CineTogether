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

interface MoviePlayerProps {
  isHost: boolean;
  movieTitle: string | null;
  onMovieSelect?: (file: File) => void;
  onMovieStreamReady?: (video: HTMLVideoElement) => void;
  onPlaybackEvent?: (type: string, payload: Record<string, unknown>) => void;
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

  useEffect(() => {
    setLocalTitle(movieTitle);
  }, [movieTitle]);

  useEffect(() => {
    if (isHost || !remoteMovieVideoTrack || !videoRef.current) return;
    remoteMovieVideoTrack.attach(videoRef.current);
    setHasMovie(true);
    return () => {
      remoteMovieVideoTrack.detach(videoRef.current!);
    };
  }, [isHost, remoteMovieVideoTrack]);

  useEffect(() => {
    if (isHost || !remoteMovieAudioTrack || !audioRef.current) return;
    remoteMovieAudioTrack.attach(audioRef.current);
    return () => {
      remoteMovieAudioTrack.detach(audioRef.current!);
    };
  }, [isHost, remoteMovieAudioTrack]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !videoRef.current) return;

    setError(null);
    setLoading(true);
    setLocalTitle(file.name);

    const url = URL.createObjectURL(file);
    videoRef.current.src = url;
    videoRef.current.load();

    onMovieSelect?.(file);
  };

  const onLoadedData = () => {
    setLoading(false);
    setHasMovie(true);
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      onMovieStreamReady?.(videoRef.current);
    }
  };

  const onError = () => {
    setLoading(false);
    setError('Unable to play this video format. Try MP4 (H.264 + AAC) or WebM.');
    setHasMovie(false);
  };

  const togglePlay = useCallback(() => {
    if (!videoRef.current || !isHost) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [isHost]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current || !isHost) return;
    const time = parseFloat(e.target.value);
    videoRef.current.currentTime = time;
    setCurrentTime(time);
    onPlaybackEvent?.('playback_seek', { position: time });
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !muted;
    setMuted(!muted);
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const vol = parseFloat(e.target.value);
    videoRef.current.volume = vol;
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
          onDurationChange={() => setDuration(videoRef.current?.duration ?? 0)}
          playsInline
        />
        <audio ref={audioRef} autoPlay />

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
        {isHost && hasMovie && (
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
              max={duration || 0}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              disabled={!isHost}
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
            className="w-20 h-1 accent-accent-violet hidden sm:block"
          />
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
