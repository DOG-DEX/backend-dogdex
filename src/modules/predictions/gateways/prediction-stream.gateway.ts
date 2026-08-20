import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Types } from 'mongoose';
import { AIClientService } from '@/shared/ai-client/ai-client.service';
import { logger } from '@/common/utils/logger.util';

@WebSocketGateway({
  path: '/api/predictions/stream',
})
export class PredictionStreamGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(private readonly aiClient: AIClientService) {}

  handleConnection(client: WebSocket) {
    logger.info('[PredictionStreamGateway] Client connected to live camera stream');

    client.on('message', async (data: any, isBinary: boolean) => {
      try {
        let buffer: Buffer | null = null;

        if (isBinary || Buffer.isBuffer(data)) {
          buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
        } else if (typeof data === 'string') {
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'ping') {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'pong' }));
              }
              return;
            }
            if (parsed.image && typeof parsed.image === 'string') {
              const base64Data = parsed.image.replace(/^data:image\/\w+;base64,/, '');
              buffer = Buffer.from(base64Data, 'base64');
            }
          } catch {
            // Raw base64 fallback
            if (data.startsWith('data:image')) {
              const base64Data = data.split(',')[1];
              buffer = Buffer.from(base64Data, 'base64');
            }
          }
        }

        if (!buffer || buffer.length === 0) return;

        const result = await this.aiClient.predict({
          id: new Types.ObjectId().toString(),
          buffer,
          mediaType: 'image',
          resolve: () => {},
          reject: () => {},
        });

        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              predictions: result?.predictions || [],
              processed_media_base64: result?.processed_media_base64 || '',
            }),
          );
        }
      } catch (err: any) {
        logger.warn('[PredictionStreamGateway] Frame processing error:', err?.message);
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              predictions: [],
              error: err?.message || 'Frame processing error',
            }),
          );
        }
      }
    });
  }

  handleDisconnect(client: WebSocket) {
    logger.info('[PredictionStreamGateway] Client disconnected from live camera stream');
  }

  @SubscribeMessage('frame')
  async handleFrameMessage(client: WebSocket, payload: any) {
    // Supplementary message handler for WS platform event routing
  }
}
