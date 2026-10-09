import { Crown, Mic, MicOff, User, Video, VideoOff } from 'lucide-react';
import { Track, type Participant as LiveKitParticipant } from 'livekit-client';
import { useEffect, useRef } from 'react';
import type { Participant } from '../types/room';

interface ParticipantTileProps {
  participant: Participant;
  isLocal?: boolean;
  cameraEnabled?: boolean;
  micEnabled?: boolean;
  liveKitParticipant?: LiveKitParticipant;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function ParticipantTile({
  participant,
  isLocal = false,
  cameraEnabled = false,
  micEnabled = true,
  liveKitParticipant,
}: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const cameraPublication = liveKitParticipant?.getTrackPublication(Track.Source.Camera);
  const cameraTrack = cameraPublication?.track;
  const microphonePublication = liveKitParticipant?.getTrackPublication(Track.Source.Microphone);
  const microphoneTrack = microphonePublication?.track;

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !cameraTrack) return;

    cameraTrack.attach(videoElement);
    return () => {
      cameraTrack.detach(videoElement);
    };
  }, [cameraTrack]);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement || !microphoneTrack || isLocal) return;

    microphoneTrack.attach(audioElement);
    return () => {
      microphoneTrack.detach(audioElement);
    };
  }, [isLocal, microphoneTrack]);

  const showVideo = cameraEnabled && Boolean(cameraTrack);

  return (
    <div className="relative aspect-video rounded-lg overflow-hidden bg-navy-800 border border-navy-700">
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-navy-700 to-navy-800">
          <div className="w-14 h-14 rounded-full bg-navy-600 flex items-center justify-center">
            {participant.display_name ? (
              <span className="text-lg font-semibold text-slate-300">
                {getInitials(participant.display_name)}
              </span>
            ) : (
              <User className="w-7 h-7 text-slate-400" />
            )}
          </div>
        </div>
      )}
      {!isLocal && <audio ref={audioRef} autoPlay playsInline />}

      <div className="absolute bottom-0 inset-x-0 px-2 py-1.5 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-medium text-white truncate">
            {participant.display_name}
            {isLocal && ' (You)'}
          </span>
          {participant.is_host && (
            <Crown className="w-3 h-3 text-amber-400 shrink-0" aria-label="Host" />
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {micEnabled ? (
            <Mic className="w-3 h-3 text-slate-300" />
          ) : (
            <MicOff className="w-3 h-3 text-red-400" />
          )}
          {cameraEnabled ? (
            <Video className="w-3 h-3 text-slate-300" />
          ) : (
            <VideoOff className="w-3 h-3 text-red-400" />
          )}
        </div>
      </div>

      {participant.connection_status === 'disconnected' && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <span className="text-xs text-amber-400">Reconnecting…</span>
        </div>
      )}
    </div>
  );
}
