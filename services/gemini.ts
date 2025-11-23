import { GoogleGenAI, Modality, Type } from "@google/genai";
import { AnalysisResult, Segment } from "../types";

// Initialize the client
// NOTE: process.env.API_KEY is injected by the environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes the video to extract transcript and translate it.
 */
export const analyzeAndTranslateVideo = async (
  base64Video: string,
  mimeType: string,
  targetLanguage: string
): Promise<AnalysisResult> => {
  const model = "gemini-2.5-flash"; // Good for video analysis

  const prompt = `
    Analyze the audio in this video file.
    1. Detect the spoken language.
    2. Provide a short 1-sentence summary of the content.
    3. Transcribe the speech and translate it to ${targetLanguage}.
    4. Return the result strictly as a JSON object with the following structure:
    {
      "detectedLanguage": "Name of language detected",
      "summary": "Summary of video",
      "segments": [
        { "start": "MM:SS", "end": "MM:SS", "original": "Original text transcript", "translated": "Translated text" }
      ]
    }
    Ensure the segments cover the entire spoken duration.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Video,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedLanguage: { type: Type.STRING },
            summary: { type: Type.STRING },
            segments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  start: { type: Type.STRING },
                  end: { type: Type.STRING },
                  original: { type: Type.STRING },
                  translated: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    // Parse the JSON
    const result: AnalysisResult = JSON.parse(text);
    return result;

  } catch (error) {
    console.error("Error analyzing video:", error);
    throw error;
  }
};

/**
 * Generates speech from text using Gemini TTS.
 */
export const generateSpeech = async (
  text: string,
  voiceName: string = 'Zephyr'
): Promise<string> => {
  // We use the TTS model
  const model = "gemini-2.5-flash-preview-tts";

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
      throw new Error("No audio data returned");
    }

    return audioData; // This is the base64 string
  } catch (error) {
    console.error("Error generating speech:", error);
    throw error;
  }
};

/**
 * Helper to decode base64 audio string to an Audio Blob URL
 */
export const base64ToAudioBlobUrl = (base64: string): string => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'audio/wav' }); // Gemini typically returns raw PCM or WAV-like container depending on request, but browser handles the blob well usually if we assume wav/pcm context.
  // Note: Gemini API returns raw PCM usually without headers if not specified, but the browser AudioContext decodeAudioData handles it. 
  // However, for a simple <audio src="..."> element, we might need a container. 
  // The official sample code for TTS suggests decoding via AudioContext for playback.
  // To make it simple for the user to download or play in a standard HTML5 player, 
  // we might need to wrap it or just use the AudioContext in the UI. 
  // For this App, let's return the blob URL but we will implement the playback using AudioContext in the UI component 
  // OR we can try to play it directly.
  // Actually, standard HTML <audio> tags struggle with raw PCM. 
  // We will use AudioContext in the frontend component to play this buffer.
  // So this function is just a helper for `AudioContext.decodeAudioData`.
  
  return URL.createObjectURL(blob);
};
