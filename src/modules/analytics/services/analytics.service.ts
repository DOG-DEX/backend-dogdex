import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AnalyticsEventDoc } from '../schemas/analytics_event.model';
import { Request } from 'express';
import { logger } from '../../../utils/logger.util';

export interface TrackEventArgs {
  eventName: string;
  req: Request;
  eventData?: Record<string, any>;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel('AnalyticsEvent') private analyticsEventModel: Model<AnalyticsEventDoc>
  ) {}

  public async trackEvent(args: TrackEventArgs & { processingTime?: number }): Promise<void> {
    const { eventName, req, eventData, processingTime } = args;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const query: any = {
        eventName,
        date: today,
      };
      
      const user = (req as any).user;
      if (user?._id) {
        query.user = user._id;
      } else if ((req as any).fingerprint?.hash) {
        query.fingerprint = (req as any).fingerprint.hash;
      } else {
        logger.warn(`[AnalyticsService] Could not track event '${eventName}' due to missing identifier.`);
        return;
      }

      const update = {
        $inc: {
          count: 1,
          totalProcessingTime: processingTime || 0
        },
        $setOnInsert: {
          ip: req.ip,
          userAgent: req.headers["user-agent"],
          eventData: eventData || {},
        },
      };

      await this.analyticsEventModel.findOneAndUpdate(query, update, {
        upsert: true,
      });
    } catch (error: any) {
      logger.error('[AnalyticsService Error] Failed to track event:', {
        eventName,
        error: error.message,
      });
    }
  }
}
