import { useEffect, useRef, useState } from 'react';
import { LocalAudioTrack, LocalVideoTrack, Room, RoomEvent, Track } from 'livekit-client';
import { getMediaToken } from '../services/api';

export type LiveKitStatus = 'idle' | 'connecting' | 'connected' | 'error';

export function useLiveKitRoom(roomCode: string | null, participantId: string | null) {
  const roomRef = useRef<Room | null>(null);
  const movieTracksRef = useRef<(LocalVideoTrack | LocalAudioTrack)[]>([]);
  const [status, setStatus] = useState<LiveKitStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [, setRevision] = useState(0);

  useEffect(() => {
    if (!roomCode || !participantId) return;

    let disposed = false;
    const liveKitRoom = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = liveKitRoom;
    setStatus('connecting');
    setError(null);

    const refresh = () => setRevision((revision) => revision + 1);
    const events = [
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
      RoomEvent.ConnectionStateChanged,
    ];
    events.forEach((event) => liveKitRoom.on(event, refresh));

    const connect = async () => {
      try {
        const mediaToken = await getMediaToken(roomCode, participantId);
        const liveKitUrl = import.meta.env.VITE_LIVEKIT_URL || mediaToken.livekit_url;
        if (!liveKitUrl) throw new Error('LiveKit URL is not configured.');
        await liveKitRoom.connect(liveKitUrl, mediaToken.token);
        if (!disposed) setStatus('connected');
      } catch (connectError) {
        if (!disposed) {
          setStatus('error');
          setError(connectError instanceof Error ? connectError.message : 'Could not join video call');
        }
      }
    };

    connect();

    return () => {
      disposed = true;
      events.forEach((event) => liveKitRoom.off(event, refresh));
      liveKitRoom.disconnect();
      movieTracksRef.current = [];
      roomRef.current = null;
    };
  }, [roomCode, participantId]);

  const localParticipant = roomRef.current?.localParticipant;
  const remoteParticipants = roomRef.current
    ? Array.from(roomRef.current.remoteParticipants.values())
    : [];

  const toggleMicrophone = async () => {
    if (localParticipant) {
      await localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
      setRevision((revision) => revision + 1);
    }
  };

  const toggleCamera = async () => {
    if (localParticipant) {
      await localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled);
      setRevision((revision) => revision + 1);
    }
  };

  const publishMovie = async (videoElement: HTMLVideoElement) => {
    const localParticipant = roomRef.current?.localParticipant;
    if (!localParticipant || !('captureStream' in videoElement)) return;

    const stream = (
      videoElement as HTMLVideoElement & { captureStream: () => MediaStream }
    ).captureStream();
    const tracks: (LocalVideoTrack | LocalAudioTrack)[] = [];
    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];
    if (videoTrack) tracks.push(new LocalVideoTrack(videoTrack));
    if (audioTrack) tracks.push(new LocalAudioTrack(audioTrack));

    for (const movieTrack of movieTracksRef.current) {
      await localParticipant.unpublishTrack(movieTrack);
      movieTrack.stop();
    }
    movieTracksRef.current = tracks;

    for (const movieTrack of tracks) {
      await localParticipant.publishTrack(movieTrack, {
        name: movieTrack.kind === 'video' ? 'movie-video' : 'movie-audio',
        source: Track.Source.Unknown,
      });
    }
    setRevision((revision) => revision + 1);
  };

  const moviePublications = [
    ...(localParticipant ? Array.from(localParticipant.trackPublications.values()) : []),
    ...remoteParticipants.flatMap((participant) =>
      Array.from(participant.trackPublications.values()),
    ),
  ];
  const movieVideoTrack = moviePublications.find(
    (publication) => publication.trackName === 'movie-video',
  )?.track;

  const movieAudioTrack = remoteParticipants
    .flatMap((participant) => Array.from(participant.trackPublications.values()))
    .find((publication) => publication.trackName === 'movie-audio')?.track;

  return {
    localParticipant,
    remoteParticipants,
    status,
    error,
    micEnabled: localParticipant?.isMicrophoneEnabled ?? false,
    cameraEnabled: localParticipant?.isCameraEnabled ?? false,
    toggleMicrophone,
    toggleCamera,
    publishMovie,
    movieVideoTrack,
    movieAudioTrack,
  };
}