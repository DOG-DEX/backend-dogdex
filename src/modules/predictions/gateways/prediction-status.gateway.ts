import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Logger } from '@nestjs/common';
import { predictionNotifier } from '@/common/utils/predictionNotifier.util';

@WebSocketGateway({ path: '/ws/prediction-status' })
export class PredictionStatusGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(PredictionStatusGateway.name);

  handleConnection(client: WebSocket) {
    this.logger.log('Client connected to prediction status notifications');
  }

  handleDisconnect(client: WebSocket) {
    this.logger.log('Client disconnected from prediction status notifications');
    predictionNotifier.removeConnection(client);
  }

  @SubscribeMessage('message')
  handleMessage(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() data: any,
  ) {
    try {
      const payload = typeof data === 'string' ? JSON.parse(data) : data;

      if (payload.action === 'subscribe' && payload.predictionId) {
        predictionNotifier.subscribe(payload.predictionId, client);
        client.send(
          JSON.stringify({
            event: 'subscribed',
            predictionId: payload.predictionId,
          }),
        );
      } else if (payload.action === 'unsubscribe' && payload.predictionId) {
        predictionNotifier.unsubscribe(payload.predictionId, client);
      }
    } catch (e) {
      this.logger.warn('[PredictionStatusGateway] Invalid message format');
    }
  }
}
