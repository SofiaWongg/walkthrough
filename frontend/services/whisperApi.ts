import { Platform } from 'react-native';
import { CONFIG } from '../constants/config';

// Access env variable inline - Expo's bundler replaces this at build time
function getApiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_OPENAI_API_KEY;
}

export async function transcribeAudio(audioUri: string): Promise<string> {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn('OpenAI API key not found, using mock transcription');
    console.warn('Make sure EXPO_PUBLIC_OPENAI_API_KEY is set in .env and restart the dev server');
    return mockTranscribe();
  }

  try {
    const formData = new FormData();

    if (Platform.OS === 'web') {
      // Web: fetch the blob and convert to File
      const response = await fetch(audioUri);
      const blob = await response.blob();

      // Create a File object from the blob
      const file = new File([blob], 'recording.webm', { type: 'audio/webm' });
      formData.append('file', file);
    } else {
      // Native (iOS/Android): use the URI object format
      const filename = audioUri.split('/').pop() || 'recording.m4a';
      const fileObject = {
        uri: audioUri,
        name: filename,
        type: 'audio/mp4',
      };
      formData.append('file', fileObject as any);
    }

    formData.append('model', CONFIG.WHISPER_MODEL);
    formData.append('language', 'en');

    console.log('Sending audio to Whisper API...');

    const apiResponse = await fetch(CONFIG.WHISPER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('Whisper API error response:', apiResponse.status, errorText);
      throw new Error(`Transcription failed: ${apiResponse.status} - ${errorText}`);
    }

    const data = await apiResponse.json();
    console.log('Whisper API response:', data);
    return data.text || '';
  } catch (error) {
    console.error('Transcription error:', error);
    // Fall back to mock transcription for testing
    return mockTranscribe();
  }
}

// Mock transcription for testing without API
let mockIndex = 0;
const mockTranscripts = [
  "Entering the front door. The door handle is in good condition.",
  "Moving to the living room. The carpet shows some wear near the entrance.",
  "The kitchen looks clean. Checking the countertops and appliances.",
  "The bathroom tile is in good condition. Checking for any leaks under the sink.",
  "Looking at the backyard now. The fence needs some repairs on the west side.",
];

function mockTranscribe(): string {
  const transcript = mockTranscripts[mockIndex % mockTranscripts.length];
  mockIndex++;
  return transcript;
}
