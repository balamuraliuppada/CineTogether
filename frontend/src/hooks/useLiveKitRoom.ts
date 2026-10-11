import { useEffect, useRef, useState } from 'react';
import { LocalAudioTrack, LocalVideoTrack, Room, RoomEvent, Track } from 'livekit-client';
import { getMediaToken } from '../services/api';

export type LiveKitStatus = 'idle' | 'connecting' | 'connected' | 'error';

export function useLiveKitRoom(roomCode: string | null, participantId: string | null) {
  const roomRef = useRef<Room | null>(null);
  const movieTracksRef = useRef<(LocalVideoTrack | LocalAudioTrack)[]>([]);
  const [status, setStatus] = useState<LiveKitStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [localCameraEnabled, setLocalCameraEnabled] = useState(false);
  const [localMicrophoneEnabled, setLocalMicrophoneEnabled] = useState(false);
  const cameraBusyRef = useRef(false);
  const microphoneBusyRef = useRef(false);

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
        const savedMic = localStorage.getItem(`cine-mic-${roomCode}-${participantId}`) === 'true';
        const savedCamera = localStorage.getItem(`cine-camera-${roomCode}-${participantId}`) === 'true';
        await liveKitRoom.localParticipant.setMicrophoneEnabled(savedMic);
        await liveKitRoom.localParticipant.setCameraEnabled(savedCamera);
        setLocalMicrophoneEnabled(savedMic);
        setLocalCameraEnabled(savedCamera);
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
    const participant = roomRef.current?.localParticipant;
    if (participant && !microphoneBusyRef.current) {
      microphoneBusyRef.current = true;
      try {
        const enabled = !participant.isMicrophoneEnabled;
        await participant.setMicrophoneEnabled(enabled);
        setLocalMicrophoneEnabled(enabled);
        localStorage.setItem(
          `cine-mic-${roomCode}-${participantId}`,
          String(enabled),
        );
        setRevision((revision) => revision + 1);
      } finally {
        microphoneBusyRef.current = false;
      }
    }
  };

  const toggleCamera = async () => {
    const participant = roomRef.current?.localParticipant;
    if (participant && !cameraBusyRef.current) {
      cameraBusyRef.current = true;
      try {
        const enabled = !participant.isCameraEnabled;
        await participant.setCameraEnabled(enabled);
        setLocalCameraEnabled(enabled);
        localStorage.setItem(
          `cine-camera-${roomCode}-${participantId}`,
          String(enabled),
        );
        setRevision((revision) => revision + 1);
      } finally {
        cameraBusyRef.current = false;
      }
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

  const clearPublishedMovie = async () => {
    const localParticipant = roomRef.current?.localParticipant;
    if (!localParticipant) return;
    for (const movieTrack of movieTracksRef.current) {
      await localParticipant.unpublishTrack(movieTrack);
      movieTrack.stop();
    }
    movieTracksRef.current = [];
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

  const remoteMovieVideoTrack = remoteParticipants
    .flatMap((participant) => Array.from(participant.trackPublications.values()))
    .find((publication) => publication.trackName === 'movie-video')?.track;

  const movieAudioTrack = remoteParticipants
    .flatMap((participant) => Array.from(participant.trackPublications.values()))
    .find((publication) => publication.trackName === 'movie-audio')?.track;

  return {
    localParticipant,
    remoteParticipants,
    status,
    error,
    micEnabled: localMicrophoneEnabled,
    cameraEnabled: localCameraEnabled,
    mediaRevision: revision,
    toggleMicrophone,
    toggleCamera,
    publishMovie,
    clearPublishedMovie,
    movieVideoTrack,
    remoteMovieVideoTrack,
    movieAudioTrack,
  };
}