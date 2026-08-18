import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';
import { logger } from '../../../common/utils/logger.util';

@Injectable()
export class MomoService {
  constructor(private readonly config: ConfigService) {}

  async createPaymentRequest(
    amount: number,
    orderInfo: string,
    orderId: string,
    requestId: string,
  ): Promise<any> {
    const partnerCode = this.config.get<string>('MOMO_PARTNER_CODE') || 'MOMO';
    const accessKey = this.config.get<string>('MOMO_ACCESS_KEY') || '';
    const secretKey = this.config.get<string>('MOMO_SECRET_KEY') || '';
    const hostname =
      this.config.get<string>('MOMO_HOSTNAME') || 'test-payment.momo.vn';
    const frontendUrl = (this.config.get<string>('FRONTEND_URL') || '').trim();
    const backendUrl = (this.config.get<string>('BACKEND_URL') || '').trim();

    const redirectUrl = `${frontendUrl}/profile?upgrade_status=true`;
    const ipnUrl = `${backendUrl}/api/plans/momo-ipn`;
    const requestType = 'captureWallet';
    const extraData = '';

    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(rawSignature)
      .digest('hex');

    const payload = {
      partnerCode,
      accessKey,
      requestId,
      amount: amount.toString(),
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      extraData,
      requestType,
      signature,
      lang: 'vi',
    };

    try {
      const url = `https://${hostname}/v2/gateway/api/create`;
      const { data } = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (data.resultCode !== 0) {
        logger.error(
          `[MoMo] Payment creation error (${data.resultCode}): ${data.message}`,
        );
        throw new BadRequestException(
          data.message || 'Thanh toán MoMo thất bại.',
        );
      }
      return data;
    } catch (error: any) {
      logger.error(
        '[MoMo] Error creating payment request:',
        error?.response?.data || error.message,
      );
      throw new BadRequestException(
        error?.response?.data?.message ||
          error.message ||
          'Lỗi kết nối cổng thanh toán MoMo.',
      );
    }
  }

  verifyIpnSignature(ipnPayload: any): boolean {
    const { signature, ...rest } = ipnPayload || {};
    if (!signature) return false;

    const accessKey = this.config.get<string>('MOMO_ACCESS_KEY') || '';
    const secretKey = this.config.get<string>('MOMO_SECRET_KEY') || '';
    if (!accessKey || !secretKey) return false;

    const {
      partnerCode,
      orderId,
      requestId,
      amount,
      orderInfo,
      orderType,
      transId,
      resultCode,
      message,
      payType,
      responseTime,
      extraData,
    } = rest;
    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

    const expected = crypto
      .createHmac('sha256', secretKey)
      .update(rawSignature)
      .digest('hex');
    const receivedBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    return (
      receivedBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    );
  }
}
