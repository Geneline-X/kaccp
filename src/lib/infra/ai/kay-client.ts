/**
 * Kay X Client - Service for integrating with Kay X ASR API
 * 
 * Handles authentication and transcription requests to the Kay X gateway
 * for Krio audio verification.
 */

interface KayXConfig {
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
}

interface TranscriptionRequest {
  url?: string;
  audioFile?: File | Buffer;
  language?: string;
}

interface TranscriptionResponse {
  success: boolean;
  transcript?: string; // Krio transcript output
  confidence?: number;
  language?: string;
  duration?: number;
  metadata?: Record<string, any>;
  error?: string;
}

 function isNodeBuffer(value: unknown): value is Buffer {
   return typeof Buffer !== 'undefined' && Buffer.isBuffer(value);
 }

class KayXClient {
  private config: KayXConfig;

  constructor(config?: Partial<KayXConfig>) {
    this.config = {
      baseUrl: config?.baseUrl || process.env.ASR_GATEWAY_URL || 'http://localhost:8081',
      apiKey: config?.apiKey || process.env.ASR_API_KEY || '',
      enabled: config?.enabled ?? (process.env.KAY_X_ENABLED === 'true'),
    };

    if (this.config.enabled && !this.config.apiKey) {
      console.warn('[KayX] API key not configured, verification will be disabled');
      this.config.enabled = false;
    }
  }

  /**
   * Check if Kay X integration is enabled and configured
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Transcribe audio from a URL
   */
  async transcribeUrl(audioUrl: string): Promise<TranscriptionResponse> {
    if (!this.isEnabled()) {
      return {
        success: false,
        error: 'Kay X integration is not enabled',
      };
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/api/v1/transcribe_url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
        },
        body: JSON.stringify({
          url: audioUrl,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[KayX] Transcription failed:', response.status, errorText);
        return {
          success: false,
          error: `Transcription failed: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();
      
      // Parse Kay X response format
      return {
        success: true,
        transcript: data.krio_text || data.transcript || data.text || '',
        confidence: data.confidence || null, // Kay X doesn't return confidence
        language: data.language || 'kri',
        duration: data.duration,
        metadata: {
          krio_text: data.krio_text,
          english: data.english,
          raw_response: data,
        },
      };
    } catch (error: any) {
      console.error('[KayX] Transcription error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error during transcription',
      };
    }
  }

  /**
   * Transcribe audio file (multipart upload)
   */
  async transcribeFile(audioFile: File | Buffer, filename?: string): Promise<TranscriptionResponse> {
    if (!this.isEnabled()) {
      return {
        success: false,
        error: 'Kay X integration is not enabled',
      };
    }

    try {
      const formData = new FormData();
      
      if (isNodeBuffer(audioFile)) {
        // Node.js Buffer - cast to any to avoid TypeScript ArrayBuffer issues
        const blob = new Blob([audioFile as any], { type: 'audio/wav' });
        formData.append('file', blob, filename || 'audio.wav');
      } else {
        formData.append('file', audioFile as Blob);
      }

      const response = await fetch(`${this.config.baseUrl}/api/v1/transcribe`, {
        method: 'POST',
        headers: {
          'X-API-Key': this.config.apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[KayX] File transcription failed:', response.status, errorText);
        return {
          success: false,
          error: `Transcription failed: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();
      
      return {
        success: true,
        transcript: data.transcript || data.text || '',
        confidence: data.confidence,
        language: data.language,
        duration: data.duration,
        metadata: data,
      };
    } catch (error: any) {
      console.error('[KayX] File transcription error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error during file transcription',
      };
    }
  }

  /**
   * Check Kay X service health
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/api/v1/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch (error) {
      console.error('[KayX] Health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const kayXClient = new KayXClient();

// Export class for testing
export { KayXClient };
export type { KayXConfig, TranscriptionRequest, TranscriptionResponse };
