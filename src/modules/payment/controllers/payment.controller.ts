import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PlanService, IPlanQuery } from '../services/plan.service';
import { SubscriptionService } from '../services/subscription.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Plans')
@Controller('api/plans')
export class PaymentController {
  constructor(
    private readonly planService: PlanService,
    private readonly subscriptionService: SubscriptionService
  ) {}

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Get public plans' })
  async getPublicPlans() {
    return this.planService.getPublicPlans();
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get plan by slug' })
  async getPlanBySlug(@Param('slug') slug: string) {
    return this.planService.getBySlug(slug);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'de')
  @Get()
  @ApiOperation({ summary: 'Get all plans paginated (Admin/DE)' })
  async getAllPlans(@Query() query: any) {
    const q: IPlanQuery = {
      page: parseInt(query.page, 10) || 1,
      limit: parseInt(query.limit, 10) || 10,
      search: query.search,
    };
    return this.planService.getAllPaginated(q);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  @ApiOperation({ summary: 'Create a plan (Admin)' })
  async createPlan(@Body() planData: any) {
    return this.planService.create(planData);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Put(':id')
  @ApiOperation({ summary: 'Update a plan (Admin)' })
  async updatePlan(@Param('id') id: string, @Body() updateData: any) {
    return this.planService.update(id, updateData);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a plan (Admin)' })
  async deletePlan(@Param('id') id: string) {
    await this.planService.softDelete(id);
    return { message: 'Xóa gói cước thành công' };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  @ApiOperation({ summary: 'Create Momo Checkout Session' })
  async createCheckoutSession(@Body() body: any, @Query('userId') userId: string) {
    // Usually userId is from req.user, but matching legacy behavior
    const { planSlug, billingPeriod } = body;
    return this.subscriptionService.createCheckoutSession(userId, planSlug, billingPeriod);
  }

  @Public()
  @Post('momo-ipn')
  @ApiOperation({ summary: 'Handle Momo IPN' })
  async handleMomoIpn(@Body() payload: any) {
    await this.subscriptionService.handleMomoIpn(payload);
    return { message: 'Received' };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('cancel')
  @ApiOperation({ summary: 'Cancel current subscription' })
  async cancelSubscription(@Query('userId') userId: string) {
    return this.subscriptionService.cancelSubscription(userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/transactions')
  @ApiOperation({ summary: 'Get all transactions (Admin)' })
  async getTransactions(@Query() query: any) {
    return this.subscriptionService.getAllTransactions({
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 10,
      search: query.search,
      status: query.status,
      planId: query.planId,
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/subscriptions')
  @ApiOperation({ summary: 'Get all subscriptions (Admin)' })
  async getSubscriptions(@Query() query: any) {
    return this.subscriptionService.getAllSubscriptions({
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 10,
      search: query.search,
      status: query.status,
      planId: query.planId,
    });
  }
}

