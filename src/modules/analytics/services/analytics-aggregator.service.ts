import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AnalyticsEventDoc } from '../schemas/analytics_event.model';
import { AnalyticsSummaryDoc } from '../schemas/analytics_summary.model';
import { logger } from '../../../common/utils/logger.util';

@Injectable()
export class AnalyticsAggregatorService {
  constructor(
    @InjectModel('AnalyticsEvent') private analyticsEventModel: Model<AnalyticsEventDoc>,
    @InjectModel('AnalyticsSummary') private analyticsSummaryModel: Model<AnalyticsSummaryDoc>
  ) {}

  public async runMonthlyRollup(): Promise<void> {
    logger.info('[AnalyticsRollup] Starting monthly analytics aggregation job...');

    const now = new Date();
    const firstDayOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfLastMonth = new Date(firstDayOfThisMonth.getTime() - 1);
    const firstDayOfLastMonth = new Date(lastDayOfLastMonth.getFullYear(), lastDayOfLastMonth.getMonth(), 1);

    const targetYear = lastDayOfLastMonth.getFullYear();
    const targetMonth = lastDayOfLastMonth.getMonth() + 1;

    logger.info(`[AnalyticsRollup] Aggregating data for ${targetMonth}/${targetYear}...`);

    try {
      const aggregationPipeline = [
        {
          $match: {
            createdAt: {
              $gte: firstDayOfLastMonth,
              $lt: firstDayOfThisMonth,
            },
          },
        },
        {
          $group: {
            _id: {
              eventName: '$eventName',
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            totalCount: { $sum: '$count' },
          },
        },
        {
          $project: {
            _id: 0,
            eventName: '$_id.eventName',
            year: '$_id.year',
            month: '$_id.month',
            totalCount: '$totalCount',
          },
        },
      ];

      const monthlySummaries = await this.analyticsEventModel.aggregate(aggregationPipeline);

      if (monthlySummaries.length === 0) {
        logger.info('[AnalyticsRollup] No data to aggregate for the last month.');
        return;
      }

      const bulkOps = monthlySummaries.map(summary => ({
        updateOne: {
          filter: { eventName: summary.eventName, year: summary.year, month: summary.month },
          update: { $inc: { totalCount: summary.totalCount } },
          upsert: true,
        },
      }));

      await this.analyticsSummaryModel.bulkWrite(bulkOps);
      logger.info(`[AnalyticsRollup] Successfully aggregated and saved ${monthlySummaries.length} summaries.`);

      const deleteResult = await this.analyticsEventModel.deleteMany({
        createdAt: {
          $gte: firstDayOfLastMonth,
          $lt: firstDayOfThisMonth,
        },
      });
      logger.info(`[AnalyticsRollup] Deleted ${deleteResult.deletedCount} old detailed analytics events.`);

    } catch (error: any) {
      logger.error('[AnalyticsRollup] Error during analytics aggregation job:', error.message);
    }
  }
}
