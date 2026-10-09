import { LogOut, Mic, MicOff, Video, VideoOff } from 'lucide-react';

interface CallControlsProps {
  micEnabled: boolean;
  cameraEnabled: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onLeave: () => void;
}

export default function CallControls({
  micEnabled,
  cameraEnabled,
  onToggleMic,
  onToggleCamera,
  onLeave,
}: CallControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3 py-3 px-4 bg-navy-900 border-t border-navy-700 shrink-0">
      <button
        onClick={onToggleMic}
        title="Toggle microphone"
        className={`p-3 rounded-full transition-colors ${
          micEnabled
            ? 'bg-navy-700 hover:bg-navy-600 text-slate-200'
            : 'bg-red-600/80 hover:bg-red-600 text-white'
        }`}
        aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
      >
        {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
      </button>

      <button
        onClick={onToggleCamera}
        title="Toggle camera"
        className={`p-3 rounded-full transition-colors ${
          cameraEnabled
            ? 'bg-navy-700 hover:bg-navy-600 text-slate-200'
            : 'bg-red-600/80 hover:bg-red-600 text-white'
        }`}
        aria-label={cameraEnabled ? 'Turn off camera' : 'Turn on camera'}
      >
        {cameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
      </button>

      <button
        onClick={onLeave}
        className="p-3 rounded-full bg-red-600 hover:bg-red-500 text-white transition-colors"
        aria-label="Leave room"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </div>
  );
}
