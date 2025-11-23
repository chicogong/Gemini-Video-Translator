import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileVideo, Languages, Loader2, Download, Globe, Play } from './components/Icons';
import { Button } from './components/Button';
import { AudioPlayer } from './components/AudioPlayer';
import { TranslationStatus, AnalysisResult, LANGUAGES, LanguageOption } from './types';
import { analyzeAndTranslateVideo, generateSpeech } from './services/gemini';

const MAX_FILE_SIZE_MB = 15;

const SAMPLE_VIDEOS = [
  {
    name: 'Google Fiber (15s)',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    filename: 'sample_fiber.mp4'
  },
  {
    name: 'Joyride (15s)',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    filename: 'sample_joyride.mp4'
  }
];

const App: React.FC = () => {
  const [status, setStatus] = useState<TranslationStatus>(TranslationStatus.IDLE);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState<LanguageOption>(LANGUAGES[1]); // Default Spanish
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [generatedAudioBase64, setGeneratedAudioBase64] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [isDownloadingSample, setIsDownloadingSample] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Clean up Object URL
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const resetState = () => {
    setVideoFile(null);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setAnalysisResult(null);
    setGeneratedAudioBase64(null);
    setStatus(TranslationStatus.IDLE);
    setErrorMsg(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadVideoFile(file);
  };

  const loadVideoFile = (file: File) => {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setErrorMsg(`File too large. Please select a video under ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    resetState();
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
  };

  const handleSampleSelect = async (sample: typeof SAMPLE_VIDEOS[0]) => {
    try {
      setIsDownloadingSample(true);
      setErrorMsg(null);
      
      const response = await fetch(sample.url);
      if (!response.ok) throw new Error("Failed to fetch sample video");
      
      const blob = await response.blob();
      const file = new File([blob], sample.filename, { type: 'video/mp4' });
      
      loadVideoFile(file);
    } catch (err) {
      console.error(err);
      setErrorMsg("Could not load sample video. Often due to CORS restrictions or network issues.");
    } finally {
      setIsDownloadingSample(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove "data:video/mp4;base64," prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleProcessVideo = async () => {
    if (!videoFile) return;

    try {
      setStatus(TranslationStatus.UPLOADING);
      setProgressMessage("Reading video file...");
      
      const base64Video = await fileToBase64(videoFile);
      
      setStatus(TranslationStatus.ANALYZING);
      setProgressMessage("AI is analyzing and translating audio...");
      
      // Step 1: Analyze & Translate
      const result = await analyzeAndTranslateVideo(base64Video, videoFile.type, targetLang.name);
      setAnalysisResult(result);
      
      if (!result.segments || result.segments.length === 0) {
        throw new Error("No speech detected in this video to translate.");
      }

      // Combine all translated segments for TTS
      // In a real app, we might generate TTS per segment to sync. 
      // For this demo, we generate one continuous stream.
      const fullTranslatedText = result.segments.map(s => s.translated).join(". ");
      
      setStatus(TranslationStatus.GENERATING_SPEECH);
      setProgressMessage(`Generating ${targetLang.name} speech with voice ${targetLang.voiceName}...`);

      // Step 2: Generate Audio
      const audioBase64 = await generateSpeech(fullTranslatedText, targetLang.voiceName);
      setGeneratedAudioBase64(audioBase64);

      setStatus(TranslationStatus.COMPLETED);
    } catch (err: any) {
      console.error(err);
      setStatus(TranslationStatus.ERROR);
      setErrorMsg(err.message || "An unexpected error occurred during processing.");
    }
  };

  const resetApp = () => {
    resetState();
    // Clear input value so same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-lg">
              <Globe size={24} className="text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Gemini Video Translator</h1>
          </div>
          <div className="text-sm text-slate-400 hidden sm:block">
            Powered by Gemini 2.5 Flash & TTS
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full flex flex-col gap-8">
        
        {/* Step 1: Upload */}
        {!videoFile && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh]">
            <div className="max-w-md w-full text-center space-y-6">
              
              <div className="relative group cursor-pointer" onClick={() => !isDownloadingSample && fileInputRef.current?.click()}>
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                <div className="relative bg-slate-800 border-2 border-dashed border-slate-600 rounded-2xl p-12 hover:border-blue-500 transition-colors flex flex-col items-center gap-4">
                  <div className="bg-slate-700 p-4 rounded-full">
                    <Upload size={32} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Upload Video</h3>
                    <p className="text-slate-400 mt-1 text-sm">MP4, WEBM, MOV (Max {MAX_FILE_SIZE_MB}MB)</p>
                  </div>
                  <Button variant="outline" className="mt-2">Select File</Button>
                </div>
              </div>

              {/* Sample Videos Section */}
              <div className="pt-6 border-t border-slate-800 w-full">
                <p className="text-slate-400 text-sm mb-4">Or try a sample video:</p>
                <div className="grid grid-cols-2 gap-3">
                  {SAMPLE_VIDEOS.map((sample, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSampleSelect(sample)}
                      disabled={isDownloadingSample}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDownloadingSample ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} className="text-emerald-400" />}
                      {sample.name}
                    </button>
                  ))}
                </div>
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="video/*" 
                className="hidden" 
              />
              {errorMsg && (
                <div className="p-3 bg-red-900/30 border border-red-800 text-red-200 rounded-lg text-sm">
                  {errorMsg}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Configure & Preview */}
        {videoFile && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
            
            {/* Left Col: Source Video & Settings */}
            <div className="space-y-6">
              <div className="bg-slate-800 rounded-xl overflow-hidden shadow-2xl border border-slate-700 relative group">
                 {/* Video Player */}
                 <video 
                  ref={videoRef}
                  src={videoUrl || undefined} 
                  controls 
                  className="w-full aspect-video bg-black object-contain"
                />
                <button 
                  onClick={resetApp}
                  className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove video"
                >
                  <span className="sr-only">Close</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              {/* Controls */}
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                    <Languages size={16} /> Target Language
                  </label>
                  <select 
                    value={targetLang.code}
                    onChange={(e) => setTargetLang(LANGUAGES.find(l => l.code === e.target.value) || LANGUAGES[0])}
                    disabled={status !== TranslationStatus.IDLE && status !== TranslationStatus.COMPLETED && status !== TranslationStatus.ERROR}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  >
                    {LANGUAGES.map(lang => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name} (Voice: {lang.voiceName})
                      </option>
                    ))}
                  </select>
                </div>

                {status === TranslationStatus.IDLE || status === TranslationStatus.ERROR ? (
                  <Button 
                    onClick={handleProcessVideo} 
                    className="w-full py-3 text-lg"
                    disabled={!videoFile}
                  >
                    Translate Video
                  </Button>
                ) : status === TranslationStatus.COMPLETED ? (
                  <Button onClick={handleProcessVideo} variant="outline" className="w-full">
                    Regenerate
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 animate-pulse rounded-full w-2/3"></div>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-blue-300 text-sm">
                      <Loader2 size={16} className="animate-spin" />
                      {progressMessage}
                    </div>
                  </div>
                )}
                
                {status === TranslationStatus.ERROR && (
                   <div className="p-3 bg-red-900/30 border border-red-800 text-red-200 rounded-lg text-sm mt-4">
                   Error: {errorMsg}
                 </div>
                )}
              </div>
            </div>

            {/* Right Col: Results */}
            <div className="space-y-6 flex flex-col h-full">
               {/* Analysis Result */}
               {analysisResult ? (
                 <div className="bg-slate-800 rounded-xl border border-slate-700 flex flex-col overflow-hidden h-full max-h-[600px]">
                    <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-white">Translation Result</h3>
                        <p className="text-xs text-slate-400">
                          Detected: {analysisResult.detectedLanguage} • {analysisResult.summary}
                        </p>
                      </div>
                      {generatedAudioBase64 && (
                        <div className="flex items-center gap-2">
                           {/* Using a key to remount the player if audio changes */}
                           <AudioPlayer key={generatedAudioBase64.substring(0, 10)} base64Audio={generatedAudioBase64} />
                        </div>
                      )}
                    </div>
                    
                    <div className="overflow-y-auto p-0 flex-1 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
                      {analysisResult.segments.length > 0 ? (
                        <div className="divide-y divide-slate-700/50">
                          {analysisResult.segments.map((segment, idx) => (
                            <div key={idx} className="p-4 hover:bg-slate-700/30 transition-colors group">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-mono text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">
                                  {segment.start} - {segment.end}
                                </span>
                              </div>
                              <p className="text-slate-400 text-sm mb-1">{segment.original}</p>
                              <p className="text-emerald-300 font-medium">{segment.translated}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                         <div className="p-8 text-center text-slate-500">
                           No spoken segments detected.
                         </div>
                      )}
                    </div>
                 </div>
               ) : (
                 <div className="bg-slate-800/50 rounded-xl border border-dashed border-slate-700 flex items-center justify-center h-full min-h-[300px] text-slate-500">
                    {status === TranslationStatus.IDLE ? (
                      <div className="text-center p-8">
                        <FileVideo size={48} className="mx-auto mb-4 opacity-50" />
                        <p>Translated transcript and audio will appear here</p>
                      </div>
                    ) : (
                      <div className="text-center p-8 animate-pulse">
                         <div className="h-4 w-32 bg-slate-700 rounded mx-auto mb-4"></div>
                         <div className="h-32 w-full max-w-sm bg-slate-700/50 rounded mx-auto"></div>
                      </div>
                    )}
                 </div>
               )}
            </div>

          </div>
        )}
      </main>
    </div>
  );
};

export default App;