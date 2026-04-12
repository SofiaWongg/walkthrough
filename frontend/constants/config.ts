export const CONFIG = {
  // Pause detection threshold in milliseconds
  PAUSE_THRESHOLD_MS: 5000,

  // Audio recording settings
  AUDIO: {
    SAMPLE_RATE: 16000,
    CHANNELS: 1,
    BIT_RATE: 128000,
  },

  // API endpoints (will be replaced with real backend)
  API_BASE_URL: 'http://localhost:3000',

  // OpenAI Whisper API
  WHISPER_API_URL: 'https://api.openai.com/v1/audio/transcriptions',
  WHISPER_MODEL: 'whisper-1',
};
