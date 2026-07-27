import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { MomoService } from './momo.service';
import { PlanService } from './plan.service';
import { SubscriptionDoc } from '../schemas/subscription.model';
import { TransactionDoc } from '../schemas/transaction.model';
import { UserDoc } from '../../users/schemas/user.model';
import { PlanDoc } from '../schemas/plan.model';
import { logger } from '../../../common/utils/logger.util';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectModel('Subscription') private subscriptionModel: Model<SubscriptionDoc>,
    @InjectModel('Transaction') private transactionModel: Model<TransactionDoc>,
    @InjectModel('User') private userModel: Model<UserDoc>,
    @InjectModel('Plan') private planModel: Model<PlanDoc>,
    private readonly momoService: MomoService,
    private readonly planService: PlanService
  ) { }

  async getAvailablePlans(): Promise<any[]> {
    const plans = await this.planService.getPublicPlans();
    if (!plans || plans.length === 0) {
      throw new NotFoundException("Không tìm thấy gói cước nào.");
    }
    return plans.map(plan => ({
      ...plan.toObject(),
      id: plan._id.toString(),
    }));
  }

  async createCheckoutSession(userId: string, planSlug: string, billingPeriod: "monthly" | "yearly") {
    const [user, plan] = await Promise.all([
      this.userModel.findById(userId),
      this.planService.getBySlug(planSlug)
    ]);

    if (!user) throw new NotFoundException("Không tìm thấy người dùng");
    if (!plan) throw new NotFoundException("Không tìm thấy gói cước");

    const currentSubscription = await this.subscriptionModel.findOne({
      userId: user._id,
      status: { $in: ['active', 'trialing'] }
    });

    if (currentSubscription && currentSubscription.planSlug === planSlug) {
      const now = new Date();
      const threeDays = 3 * 24 * 60 * 60 * 1000;
      if (currentSubscription.currentPeriodEnd.getTime() - now.getTime() > threeDays) {
        throw new BadRequestException(`Bạn đang sử dụng gói ${plan.name}. Vui lòng chờ đến gần ngày hết hạn để gia hạn.`);
      }
    }

    const amount = billingPeriod === "monthly" ? plan.priceMonthly : plan.priceYearly;

    const orderId = uuidv4();
    const requestId = orderId;
    const orderInfo = `Nâng cấp tài khoản lên gói ${plan.name} (${billingPeriod === 'monthly' ? 'tháng' : 'năm'})`;

    await this.transactionModel.create({
      orderId,
      user: user._id,
      plan: plan._id,
      planSlug: plan.slug,
      amount,
      billingPeriod,
      paymentGateway: 'momo',
      status: 'pending',
    });
    logger.info(`[Transaction] Created pending transaction ${orderId} for user ${userId}`);

    const momoResponse = await this.momoService.createPaymentRequest(amount, orderInfo, orderId, requestId);
    return { payUrl: momoResponse.payUrl, deeplink: momoResponse.deeplink };
  }

  async getAllTransactions(options: { page: number; limit: number; search?: string; status?: string; planId?: string; }) {
    const { page = 1, limit = 10, search, status, planId } = options;
    const skip = (page - 1) * limit;

    const query: any = {};

    if (status) query.status = status;
    if (planId && planId !== 'all') query.plan = planId;

    if (search) {
      const users = await this.userModel.find({
        $or: [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');

      const userIds = users.map(u => u._id);
      if (userIds.length === 0) {
        return { data: [], pagination: { total: 0, page, limit, totalPages: 0 } };
      }
      query.user = { $in: userIds };
    }

    const [transactions, total] = await Promise.all([
      this.transactionModel.find(query)
        .populate('user', 'username email name')
        .populate('plan', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.transactionModel.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);
    return { data: transactions, pagination: { total, page, limit, totalPages } };
  }

  async getAllSubscriptions(options: { page: number; limit: number; search?: string; status?: string; planId?: string; }) {
    const { page = 1, limit = 10, search, status, planId } = options;
    const skip = (page - 1) * limit;

    const query: any = { isDeleted: false };

    if (status) query.status = status as any;
    if (planId && planId !== 'all') query.planId = new Types.ObjectId(planId) as any;

    if (search) {
      const users = await this.userModel.find({
        $or: [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');

      const userIds = users.map(u => u._id);
      if (userIds.length === 0) {
        return { data: [], pagination: { total: 0, page, limit, totalPages: 0 } };
      }
      query.userId = { $in: userIds } as any;
    }

    const [subscriptions, total] = await Promise.all([
      this.subscriptionModel.find(query)
        .populate('userId', 'username email name')
        .populate('planId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.subscriptionModel.countDocuments(query)
    ]);

    const processedSubscriptions = subscriptions.map((sub: any) => {
      if (sub.userId) {
        if (!sub.userId.name) {
          sub.userId.name = sub.userId.username || sub.userId.email.split('@')[0];
        }
      }
      return sub;
    });

    const totalPages = Math.ceil(total / limit);
    return { data: processedSubscriptions, pagination: { total, page, limit, totalPages } };
  }

  async handleMomoIpn(ipnPayload: any): Promise<void> {
    logger.info(`[MoMo IPN] Received payload: ${JSON.stringify(ipnPayload, null, 2)}`);

    const isSignatureValid = this.momoService.verifyIpnSignature(ipnPayload);
    if (!isSignatureValid) {
      logger.error('[MoMo IPN] Invalid signature. Aborting.');
      return;
    }

    const { orderId, resultCode, message, transId } = ipnPayload;

    const transaction = await this.transactionModel.findOne({ orderId });
    if (!transaction) {
      logger.error(`[MoMo IPN] Transaction ${orderId} not found.`);
      return;
    }

    if (transaction.status !== 'pending') {
      logger.warn(`[MoMo IPN] Transaction ${orderId} already processed.`);
      return;
    }

    if (resultCode === 0) {
      const [user, plan] = await Promise.all([
        this.userModel.findById(transaction.user),
        this.planModel.findById(transaction.plan)
      ]);

      if (!user || !plan) {
        transaction.status = 'failed';
        await transaction.save();
        return;
      }

      await this.subscriptionModel.updateMany(
        {
          userId: user._id,
          status: { $in: ['active', 'trialing'] }
        },
        {
          $set: {
            status: 'canceled',
            canceledAt: new Date()
          }
        }
      );

      logger.info(`[MoMo IPN] Canceled previous active subscriptions for user ${user._id}`);

      transaction.status = 'completed';
      transaction.gatewayTransactionId = transId;
      transaction.rawIpnResponse = JSON.stringify(ipnPayload);
      await transaction.save();

      const now = new Date();
      const periodEnd = new Date(now);
      if (transaction.billingPeriod === 'monthly') {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      } else {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      }

      const newSubscription = await this.subscriptionModel.create({
        userId: user._id,
        planId: plan._id,
        planSlug: plan.slug,
        provider: 'momo',
        providerSubscriptionId: `momo-${transId}`,
        status: 'active',
        billingPeriod: transaction.billingPeriod,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });

      transaction.subscriptionId = newSubscription._id as Types.ObjectId;
      await transaction.save();

      await this.userModel.findByIdAndUpdate(user._id, {
        $set: { plan: plan.slug, remainingTokens: plan.tokenAllotment, subscriptionId: newSubscription._id }
      });

      logger.info(`[MoMo IPN] Upgrade success for user ${user._id}.`);
    } else {
      transaction.status = 'failed';
      transaction.rawIpnResponse = JSON.stringify(ipnPayload);
      await transaction.save();
      logger.info(`[MoMo IPN] Payment failed for order ${orderId}.`);
    }
  }

  async checkExpiredSubscriptions() {
    logger.info("[SubscriptionCron] Checking for expired subscriptions...");
    const now = new Date();

    const expiredSubs = await this.subscriptionModel.find({
      status: 'active',
      currentPeriodEnd: { $lt: now }
    });

    if (expiredSubs.length === 0) {
      logger.info("[SubscriptionCron] No expired subscriptions found.");
      return;
    }

    logger.info(`[SubscriptionCron] Found ${expiredSubs.length} expired subscriptions.`);

    const freePlan = await this.planModel.findOne({ slug: 'free' });
    if (!freePlan) {
      logger.error("[SubscriptionCron] CRITICAL: Free plan not found!");
      return;
    }

    for (const sub of expiredSubs) {
      try {
        sub.status = 'expired';
        await sub.save();

        await this.userModel.findByIdAndUpdate(sub.userId, {
          $set: {
            plan: 'free',
            remainingTokens: freePlan.tokenAllotment,
            subscriptionId: null
          }
        });

        logger.info(`[SubscriptionCron] Expired subscription ${sub._id} for user ${sub.userId}. Downgraded to Free.`);
      } catch (err) {
        logger.error(`[SubscriptionCron] Error processing subscription ${sub._id}:`, err);
      }
    }
  }

  async cancelSubscription(userId: string) {
    const sub = await this.subscriptionModel.findOne({
      userId: new Types.ObjectId(userId) as any,
      status: { $in: ['active', 'trialing'] }
    });

    if (!sub) {
      throw new BadRequestException("Bạn không có gói đăng ký nào đang hoạt động.");
    }

    if (sub.cancelAtPeriodEnd) {
      throw new BadRequestException("Gói đăng ký của bạn đã được lên lịch hủy vào cuối kỳ.");
    }

    sub.cancelAtPeriodEnd = true;
    await sub.save();

    return {
      message: "Gói đăng ký của bạn sẽ bị hủy vào cuối chu kỳ thanh toán hiện tại.",
      currentPeriodEnd: sub.currentPeriodEnd
    };
  }
}
