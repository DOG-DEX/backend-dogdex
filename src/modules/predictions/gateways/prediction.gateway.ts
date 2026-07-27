import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import * as WebSocket from 'ws';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ path: '/ws/prediction-status' })
export class PredictionGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: WebSocket.Server;

  private readonly logger = new Logger(PredictionGateway.name);
  private subscriptions = new Map<string, Set<WebSocket>>();

  handleConnection(client: WebSocket) {
    this.logger.log(`Client connected`);
  }

  handleDisconnect(client: WebSocket) {
    this.logger.log(`Client disconnected`);
    this.removeConnection(client);
  }

  @SubscribeMessage('message')
  handleMessage(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() data: any,
  ) {
    try {
      const payload = typeof data === 'string' ? JSON.parse(data) : data;

      if (payload.action === 'subscribe' && payload.predictionId) {
        this.subscribe(payload.predictionId, client);
        client.send(
          JSON.stringify({
            event: 'subscribed',
            predictionId: payload.predictionId,
          }),
        );
      } else if (payload.action === 'unsubscribe' && payload.predictionId) {
        this.unsubscribe(payload.predictionId, client);
      }
    } catch (e) {
      this.logger.warn('[WS] Invalid message format');
    }
  }

  subscribe(predictionId: string, client: WebSocket) {
    if (!this.subscriptions.has(predictionId)) {
      this.subscriptions.set(predictionId, new Set());
    }
    this.subscriptions.get(predictionId)?.add(client);
  }

  unsubscribe(predictionId: string, client: WebSocket) {
    this.subscriptions.get(predictionId)?.delete(client);
  }

  removeConnection(client: WebSocket) {
    for (const [predictionId, clients] of this.subscriptions.entries()) {
      if (clients.has(client)) {
        clients.delete(client);
        if (clients.size === 0) {
          this.subscriptions.delete(predictionId);
        }
      }
    }
  }

  broadcastStatus(predictionId: string, statusData: any) {
    const clients = this.subscriptions.get(predictionId);
    if (clients) {
      const message = JSON.stringify({ predictionId, ...statusData });
      clients.forEach((client) => {
        if (client.readyState === 1 /* OPEN */) {
          client.send(message);
        }
      });
    }
  }
}
