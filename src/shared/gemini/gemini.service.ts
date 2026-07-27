import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { redisClient } from '../../common/utils/redis.util';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
      this.logger.log('Gemini AI Service initialized successfully.');
    } else {
      this.logger.warn('GOOGLE_API_KEY not provided. Gemini AI will run in mock mode.');
    }
  }

  async generateContent(prompt: string): Promise<string> {
    if (!this.model) {
      return `[Mock Gemini AI] Content generated for prompt: ${prompt.substring(0, 50)}...`;
    }
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (err: any) {
      this.logger.error(`[Gemini Error]: ${err.message}`);
      throw err;
    }
  }

  async chatWithBreed(breedName: string, message: string, lang: 'vi' | 'en' = 'vi'): Promise<string> {
    const systemPrompt =
      lang === 'vi'
        ? `Bạn là một chuyên gia về giống chó ${breedName}. Hãy trả lời ngắn gọn, thân thiện và chính xác câu hỏi sau từ người dùng: ${message}`
        : `You are a dog expert specializing in the ${breedName} breed. Answer the user's question concisely, friendly, and accurately: ${message}`;

    return this.generateContent(systemPrompt);
  }
}
