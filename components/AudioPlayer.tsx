import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Volume2 } from './Icons';

interface AudioPlayerProps {
  base64Audio: string; // Raw PCM data from Gemini
  className?: string;
  autoPlay?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ base64Audio, className = '', autoPlay = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Decode audio data on mount or when base64 changes
  useEffect(() => {
    const decodeAudio = async () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        
        const ctx = audioContextRef.current;
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Decode: We assume the response might be raw PCM if generated via certain endpoints, 
        // OR standard encoded if requesting Audio Modality.
        // The Gemini `responseModalities: [Modality.AUDIO]` usually returns a WAV container or PCM.
        // Let's try decodeAudioData which handles WAV headers automatically.
        // If it fails, we might need manual PCM decoding (as seen in Live API), 
        // but for `generateContent` with TTS model, it typically returns a format decodeAudioData understands (like WAV or MP3 wrapped).
        
        // However, the prompt guide for "Generate Speech" creates a custom decode for PCM.
        // Let's TRY standard decode first. If it fails, we fall back to PCM logic (unlikely for the REST API vs Live API).
        // Actually, the guide uses `decodeAudioData` but constructs it manually in the Live API example.
        // For the REST API TTS example:
        /*
          const audioBuffer = await decodeAudioData(
            decode(base64EncodedAudioString),
            outputAudioContext,
            24000,
            1,
          );
        */
        // Let's implement the manual PCM decode just in case, similar to the guide.
        
        // Helper to convert to buffer
        const dataInt16 = new Int16Array(bytes.buffer);
        const numChannels = 1;
        // Note: The REST API sample rate might differ. The Live API uses 24000. Let's try 24000.
        // If the audio sounds slow/fast, we adjust sampleRate.
        const sampleRate = 24000; 
        
        const frameCount = dataInt16.length / numChannels;
        const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
        const channelData = buffer.getChannelData(0);
        
        for (let i = 0; i < frameCount; i++) {
             // Convert int16 to float32
            channelData[i] = dataInt16[i] / 32768.0;
        }
        
        bufferRef.current = buffer;
        
        if (autoPlay) {
          play();
        }
      } catch (e) {
        console.error("Audio decode error", e);
      }
    };

    decodeAudio();

    return () => {
      stop();
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base64Audio]);

  const updateProgress = () => {
    if (!audioContextRef.current || !startTimeRef.current || !bufferRef.current) return;
    const elapsed = audioContextRef.current.currentTime - startTimeRef.current + pauseTimeRef.current;
    const duration = bufferRef.current.duration;
    const percent = Math.min((elapsed / duration) * 100, 100);
    setProgress(percent);

    if (elapsed < duration) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      setIsPlaying(false);
      pauseTimeRef.current = 0;
      setProgress(100);
    }
  };

  const play = async () => {
    if (!audioContextRef.current || !bufferRef.current) return;
    
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = bufferRef.current;
    source.connect(audioContextRef.current.destination);
    
    // Start playback
    // If we are resuming, we need to calculate offset. 
    // However, AudioBufferSourceNode cannot be "resumed", we must create a new one.
    const offset = pauseTimeRef.current;
    source.start(0, offset);
    
    sourceRef.current = source;
    startTimeRef.current = audioContextRef.current.currentTime;
    setIsPlaying(true);
    
    animationFrameRef.current = requestAnimationFrame(updateProgress);

    source.onended = () => {
        // Handled by progress check mostly, but good backup
    };
  };

  const stop = () => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch (e) { /* ignore */ }
      sourceRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsPlaying(false);
  };

  const pause = () => {
    if (!audioContextRef.current) return;
    stop();
    // Calculate where we left off
    const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
    pauseTimeRef.current += elapsed;
  };

  const togglePlay = () => {
    if (isPlaying) {
      pause();
    } else {
      // If we finished, reset
      if (progress >= 100) {
        pauseTimeRef.current = 0;
        setProgress(0);
      }
      play();
    }
  };

  return (
    <div className={`flex items-center gap-3 bg-slate-800 rounded-full px-4 py-2 border border-slate-700 ${className}`}>
      <button 
        onClick={togglePlay}
        className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
      </button>
      
      <div className="flex-1 min-w-[100px] flex flex-col justify-center">
        <div className="h-1.5 w-full bg-slate-600 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-400 rounded-full transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      
      <div className="text-slate-400">
        <Volume2 size={18} />
      </div>
    </div>
  );
};