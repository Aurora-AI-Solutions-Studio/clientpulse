/**
 * Whisper Transcription Agent v1
 * Transcribes audio files using OpenAI Whisper API
 */

import OpenAI from 'openai';
import fs from 'fs';
import https from 'https';
import path from 'path';
import os from 'os';

/**
 * Audio segment with timestamps
 */
export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

/**
 * Complete transcription result with metadata
 */
export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
  duration: number;
  language: string;
  transcribed_at: number;
}

/**
 * WhisperTranscriptionAgent transcribes audio using OpenAI Whisper API
 */
export class WhisperTranscriptionAgent {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Transcribes audio from a URL using Whisper API
   * @param audioUrl - The URL of the audio file (can be Supabase Storage or other sources)
   * @returns TranscriptionResult with text, segments, duration, and language
   */
  async transcribeAudio(audioUrl: string): Promise<TranscriptionResult> {
    try {
      // Download audio from URL to temporary file
      const tempFilePath = await this.downloadAudioFromUrl(audioUrl);

      // Read the audio file
      const audioBuffer = fs.readFileSync(tempFilePath);

      // Create file-like object for OpenAI API
      const file = new File([audioBuffer], path.basename(tempFilePath), {
        type: 'audio/mpeg',
      });

      // Call Whisper API
      const transcript = await this.client.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'en', // Optimize for English, API will auto-detect if needed
        response_format: 'verbose_json', // Get detailed response with timestamps
      });

      // Clean up temp file
      try {
        fs.unlinkSync(tempFilePath);
      } catch {
        console.warn(`Failed to delete temporary file: ${tempFilePath}`);
      }

      // Extract segments from verbose response
      const segments: TranscriptionSegment[] = [];
      if ('words' in transcript && Array.isArray(transcript.words)) {
        // Parse word-level timing if available
        let currentSegment: TranscriptionSegment | null = null;
        for (const word of transcript.words as Array<{ word: string; start?: number; end?: number }>) {
          if (currentSegment === null) {
            currentSegment = {
              start: word.start || 0,
              end: word.end || 0,
              text: word.word || '',
            };
          } else {
            currentSegment.text += ' ' + (word.word || '');
            currentSegment.end = word.end || currentSegment.end;

            // Split into sentences (approximately 20 words per segment)
            if (currentSegment.text.split(' ').length >= 20) {
              segments.push(currentSegment);
              currentSegment = null;
            }
          }
        }
        if (currentSegment) {
          segments.push(currentSegment);
        }
      } else {
        // Fallback: create single segment if detailed timing not available
        segments.push({
          start: 0,
          end: transcript.duration || 0,
          text: transcript.text || '',
        });
      }

      return {
        text: transcript.text || '',
        segments,
        duration: transcript.duration || 0,
        language: transcript.language || 'en',
        transcribed_at: Date.now(),
      };
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw new Error(
        `Failed to transcribe audio: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Downloads audio from URL to a temporary file
   * @param audioUrl - The URL of the audio file
   * @returns Path to the temporary file
   */
  private async downloadAudioFromUrl(audioUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Validate URL
        const url = new URL(audioUrl);
        const protocol = url.protocol === 'https:' ? https : https;

        // Create temporary file
        const tempDir = os.tmpdir();
        const tempFileName = `audio_${Date.now()}.mp3`;
        const tempFilePath = path.join(tempDir, tempFileName);

        // Download file
        const file = fs.createWriteStream(tempFilePath);

        protocol
          .get(audioUrl, (response) => {
            // Handle redirects
            if (
              response.statusCode === 301 ||
              response.statusCode === 302 ||
              response.statusCode === 307 ||
              response.statusCode === 308
            ) {
              const redirectUrl = response.headers.location;
              if (redirectUrl) {
                // Clean up and retry with redirect
                file.destroy();
                try {
                  fs.unlinkSync(tempFilePath);
                } catch {
                  // File might not exist yet
                }
                this.downloadAudioFromUrl(redirectUrl)
                  .then(resolve)
                  .catch(reject);
                return;
              }
            }

            if (response.statusCode !== 200) {
              file.destroy();
              try {
                fs.unlinkSync(tempFilePath);
              } catch {
                // File might not exist
              }
              reject(
                new Error(
                  `Failed to download audio: HTTP ${response.statusCode}`
                )
              );
              return;
            }

            response.pipe(file);
          })
          .on('error', (error) => {
            file.destroy();
            try {
              fs.unlinkSync(tempFilePath);
            } catch {
              // File might not exist
            }
            reject(error);
          });

        file.on('finish', () => {
          file.close();
          resolve(tempFilePath);
        });

        file.on('error', (error) => {
          file.close();
          try {
            fs.unlinkSync(tempFilePath);
          } catch {
            // File might not exist
          }
          reject(error);
        });
      } catch (error) {
        reject(
          new Error(
            `Invalid audio URL: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
      }
    });
  }
}
