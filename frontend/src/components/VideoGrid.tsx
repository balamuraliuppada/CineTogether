import type { Participant } from '../types/room';
import { Track, type Participant as LiveKitParticipant } from 'livekit-client';
import ParticipantTile from './ParticipantTile';

interface VideoGridProps {
  participants: Participant[];
  localParticipantId: string;
  liveKitLocalParticipant?: LiveKitParticipant;
  liveKitRemoteParticipants?: LiveKitParticipant[];
  mediaRevision?: number;
}

export default function VideoGrid({
  participants,
  localParticipantId,
  liveKitLocalParticipant,
  liveKitRemoteParticipants = [],
  mediaRevision = 0,
}: VideoGridProps) {
  return (
    <div className="flex flex-col h-full bg-navy-900 rounded-xl border border-navy-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-navy-700">
        <h2 className="text-sm font-medium text-slate-300">Participants</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Live video calling
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {participants.map((p) => (
          <ParticipantTile
            key={`${p.id}-${mediaRevision}`}
            participant={p}
            isLocal={p.id === localParticipantId}
            cameraEnabled={
              p.id === localParticipantId
                ? liveKitLocalParticipant?.isCameraEnabled ?? false
                : Boolean(
                    liveKitRemoteParticipants.find(
                      (liveKitParticipant) => liveKitParticipant.identity === p.id,
                    )?.getTrackPublication(Track.Source.Camera)?.track,
                  )
            }
            micEnabled={
              p.id === localParticipantId
                ? liveKitLocalParticipant?.isMicrophoneEnabled ?? false
                : true
            }
            liveKitParticipant={
              p.id === localParticipantId
                ? liveKitLocalParticipant
                : liveKitRemoteParticipants.find(
                    (liveKitParticipant) => liveKitParticipant.identity === p.id,
                  )
            }
          />
        ))}

        {participants.length === 0 && (
          <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
            No participants yet
          </div>
        )}
      </div>
    </div>
  );
}
