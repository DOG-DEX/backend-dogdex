import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlanService } from './services/plan.service';
import { SubscriptionService } from './services/subscription.service';
import { MomoService } from './services/momo.service';
import { PlanModel } from './schemas/plan.model';
import { SubscriptionModel } from './schemas/subscription.model';
import { TransactionModel } from './schemas/transaction.model';
import { UserModel } from '../users/schemas/user.model';
import { PaymentController } from './controllers/payment.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Plan', schema: PlanModel.schema },
      { name: 'Subscription', schema: SubscriptionModel.schema },
      { name: 'Transaction', schema: TransactionModel.schema },
      { name: 'User', schema: UserModel.schema },
    ]),
  ],
  controllers: [PaymentController],
  providers: [PlanService, SubscriptionService, MomoService],
  exports: [PlanService, SubscriptionService, MomoService],
})
export class PaymentModule {}
