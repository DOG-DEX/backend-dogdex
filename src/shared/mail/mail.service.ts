import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { logger } from '../../common/utils/logger.util';

export type EmailLanguage = 'vi' | 'en';

export interface OtpEmailOptions {
  to: string;
  otp: string;
  userName?: string;
  language?: EmailLanguage;
}

export interface QrScanAlertOptions {
  to: string;
  ownerName: string;
  dogName: string;
  locationInfo: string;
  scanTime: string;
  language?: EmailLanguage;
}

export interface FoundDogNotificationOptions {
  to: string;
  ownerName: string;
  dogId: string;
  finderName: string;
  finderPhone: string;
  finderEmail?: string;
  message?: string;
  location?: { lat: number; lng: number; address?: string };
  verificationType?: 'qr' | 'camera';
  evidenceUrl?: string;
  language?: EmailLanguage;
}

export interface ThankFinderOptions {
  to: string;
  finderName: string;
  dogName: string;
  dogBreed: string;
  location?: string;
  verificationType: 'qr' | 'camera';
  hasAccount: boolean;
  language?: EmailLanguage;
}

export interface MatchNotificationOptions {
  to: string;
  userName: string;
  breed: string;
  matchCount: number;
  isLost: boolean;
  distanceKm: number;
  matchListHtml: string;
  language?: EmailLanguage;
}

export interface HealthReminderOptions {
  to: string;
  ownerName: string;
  dogName: string;
  recordTitle: string;
  recordType: string;
  formattedDate: string;
  isToday: boolean;
  language?: EmailLanguage;
}

export interface FeedbackApprovedOptions {
  to: string;
  userName: string;
  breedLabel: string;
  language?: EmailLanguage;
}

export interface ContactFormPayload {
  fromEmail: string;
  message: string;
}

const translations = {
  vi: {
    common: {
      footer: 'Ứng dụng nhận diện giống chó thông minh bằng AI.',
      autoEmail:
        'Email này được gửi tự động, vui lòng không trả lời trực tiếp.',
      ctaViewDetails: 'Xem chi tiết',
      ctaViewAll: 'Xem tất cả',
    },
    passwordReset: {
      subject: '[DogDex] Đặt lại mật khẩu',
      greeting: (name: string) => `Xin chào ${name}`,
      intro:
        'Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản <strong>DogDex</strong> của mình.',
      instruction:
        'Vui lòng sử dụng mã xác thực bên dưới để hoàn tất quá trình:',
      expireNotice: (mins: number) =>
        `Mã xác thực này sẽ hết hạn sau <strong>${mins} phút</strong>.`,
      warning:
        'Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này hoặc liên hệ bộ phận hỗ trợ.',
    },
    verification: {
      subject: '[DogDex] Xác thực tài khoản của bạn',
      greeting: (name: string) => `Chào mừng ${name} đến với DogDex`,
      intro:
        'Cảm ơn bạn đã đăng ký tài khoản. Để bắt đầu sử dụng dịch vụ, vui lòng xác thực địa chỉ email của bạn.',
      instruction: 'Mã xác thực của bạn là:',
      expireNotice: (mins: number) =>
        `Mã xác thực này sẽ hết hạn sau <strong>${mins} phút</strong>.`,
      warning: 'Nếu bạn không tạo tài khoản DogDex, vui lòng bỏ qua email này.',
    },
    qrScanAlert: {
      subject: (dogName: string) =>
        `[DogDex] Có người vừa quét mã QR của ${dogName}`,
      title: 'Có người vừa quét mã QR chó của bạn',
      intro: (dogName: string) =>
        `Ai đó vừa quét mã QR trên vòng cổ của bé <strong>${dogName}</strong>. Đây có thể là dấu hiệu cho thấy bé đang ở gần đó.`,
      labelLocation: 'Vị trí phát hiện:',
      labelTime: 'Thời gian:',
      advice:
        'Hãy kiểm tra ứng dụng DogDex ngay để xem chi tiết bài đăng hoặc liên hệ với người tìm thấy.',
    },
    dogFound: {
      subject: (dogName: string) =>
        `[DogDex] ĐÃ TÌM THẤY BÉ ${dogName.toUpperCase()}`,
      title: 'Có người vừa báo tìm thấy chó của bạn',
      intro: (dogName: string) =>
        `Một người tốt bụng vừa báo cáo đã nhìn thấy/tìm thấy bé <strong>${dogName}</strong>.`,
      finderDetails: 'Thông tin người tìm thấy:',
      labelName: 'Họ tên:',
      labelPhone: 'Số điện thoại:',
      labelEmail: 'Email:',
      labelMessage: 'Lời nhắn:',
      labelLocation: 'Vị trí:',
      labelVerification: 'Phương thức xác thực:',
      verificationCamera: 'AI Camera (Phân tích hình ảnh)',
      verificationQr: 'Quét mã QR (Chính xác 100%)',
      evidenceTitle: 'Ảnh bằng chứng:',
    },
    thankFinder: {
      subject: '[DogDex] Cảm ơn bạn đã giúp đỡ tìm cún lạc',
      title: 'Cảm ơn tấm lòng tốt bụng của bạn',
      intro: (dogName: string, breed: string) =>
        `Cảm ơn bạn rất nhiều vì đã báo cáo thông tin giúp đỡ tìm thấy bé <strong>${dogName}</strong> (giống ${breed}).`,
      rewardNotice:
        'Bạn vừa được thưởng <strong>+10 Token</strong> vào tài khoản DogDex để tiếp tục sử dụng các tính năng AI.',
      signupInvite:
        'Tạo tài khoản DogDex ngay để nhận 10 Token thưởng và tham gia cộng đồng bảo vệ thú cưng.',
    },
    matchNotification: {
      subject: (isLost: boolean, breed: string, count: number) =>
        isLost
          ? `[DogDex] Có ${count} kết quả phù hợp với cún ${breed} bị mất của bạn`
          : `[DogDex] Có cún ${breed} lạc phù hợp với bài đăng của bạn`,
      title: (isLost: boolean) =>
        isLost
          ? 'Tìm thấy bài đăng phù hợp với cún bị mất'
          : 'Tìm thấy cún bị mất phù hợp với bài đăng',
      intro: (name: string, breed: string, count: number, isLost: boolean) =>
        isLost
          ? `Xin chào ${name}, hệ thống DogDex vừa phát hiện <strong>${count} bài đăng</strong> chó đi lạc gần đây có thể là bé <strong>${breed}</strong> của bạn.`
          : `Xin chào ${name}, hệ thống DogDex phát hiện bài đăng của bạn có thể trùng khớp với <strong>${count} bé ${breed}</strong> đang được báo tìm chủ.`,
    },
    healthReminder: {
      subject: (dogName: string, title: string) =>
        `[DogDex] Nhắc nhở lịch khám cho ${dogName}: ${title}`,
      title: 'Nhắc nhở lịch trình sức khỏe',
      intro: (ownerName: string, dogName: string) =>
        `Xin chào ${ownerName}, bé <strong>${dogName}</strong> có một lịch trình sức khỏe cần chú ý:`,
    },
    feedbackApproved: {
      subject: '[DogDex] Phản hồi của bạn về AI đã được phê duyệt',
      title: 'Cảm ơn sự đóng góp của bạn',
      intro: (userName: string, breed: string) =>
        `Xin chào ${userName}, đóng góp phản hồi về nhận diện giống chó <strong>${breed}</strong> của bạn đã được quản trị viên chấp nhận.`,
    },
  },
  en: {
    common: {
      footer: 'AI-Powered Dog Breed Identification App.',
      autoEmail:
        'This email was generated automatically. Please do not reply directly.',
      ctaViewDetails: 'View Details',
      ctaViewAll: 'View All',
    },
    passwordReset: {
      subject: '[DogDex] Reset your password',
      greeting: (name: string) => `Hello ${name}`,
      intro:
        'You requested a password reset for your <strong>DogDex</strong> account.',
      instruction:
        'Please use the verification code below to complete the process:',
      expireNotice: (mins: number) =>
        `This code will expire in <strong>${mins} minutes</strong>.`,
      warning:
        'If you did not request a password reset, please ignore this email.',
    },
    verification: {
      subject: '[DogDex] Verify your account',
      greeting: (name: string) => `Welcome ${name} to DogDex`,
      intro:
        'Thank you for registering. Please verify your email address to get started.',
      instruction: 'Your verification code is:',
      expireNotice: (mins: number) =>
        `This code will expire in <strong>${mins} minutes</strong>.`,
      warning:
        'If you did not create a DogDex account, please ignore this email.',
    },
    qrScanAlert: {
      subject: (dogName: string) =>
        `[DogDex] Someone scanned ${dogName}'s QR code`,
      title: "Someone scanned your dog's QR code",
      intro: (dogName: string) =>
        `Someone just scanned the QR code on <strong>${dogName}</strong>'s collar.`,
      labelLocation: 'Location:',
      labelTime: 'Time:',
      advice: 'Check your DogDex app for details or to contact the finder.',
    },
    dogFound: {
      subject: (dogName: string) =>
        `[DogDex] ${dogName.toUpperCase()} HAS BEEN FOUND`,
      title: 'Someone reported finding your dog',
      intro: (dogName: string) =>
        `A kind person just reported seeing/finding <strong>${dogName}</strong>.`,
      finderDetails: 'Finder details:',
      labelName: 'Name:',
      labelPhone: 'Phone:',
      labelEmail: 'Email:',
      labelMessage: 'Message:',
      labelLocation: 'Location:',
      labelVerification: 'Verification Method:',
      verificationCamera: 'AI Camera',
      verificationQr: 'QR Scan (100% accurate)',
      evidenceTitle: 'Evidence Photo:',
    },
    thankFinder: {
      subject: '[DogDex] Thank you for helping find a lost dog',
      title: 'Thank you for your kindness',
      intro: (dogName: string, breed: string) =>
        `Thank you so much for reporting information to help find <strong>${dogName}</strong> (${breed}).`,
      rewardNotice:
        'You have been rewarded <strong>+10 Tokens</strong> in your DogDex account.',
      signupInvite:
        'Sign up for DogDex now to claim 10 bonus tokens and join the pet protection community.',
    },
    matchNotification: {
      subject: (isLost: boolean, breed: string, count: number) =>
        isLost
          ? `[DogDex] Found ${count} potential matches for your lost ${breed}`
          : `[DogDex] Lost ${breed} post matching yours`,
      title: (isLost: boolean) =>
        isLost
          ? 'Matches Found for your Lost Dog'
          : 'Found a Matching Lost Dog Post',
      intro: (name: string, breed: string, count: number, isLost: boolean) =>
        isLost
          ? `Hello ${name}, DogDex system found <strong>${count} recent posts</strong> that might match your lost <strong>${breed}</strong>.`
          : `Hello ${name}, your post matches <strong>${count} ${breed}</strong> dogs reported found.`,
    },
    healthReminder: {
      subject: (dogName: string, title: string) =>
        `[DogDex] Health Reminder for ${dogName}: ${title}`,
      title: 'Health Schedule Reminder',
      intro: (ownerName: string, dogName: string) =>
        `Hello ${ownerName}, <strong>${dogName}</strong> has an upcoming health event:`,
    },
    feedbackApproved: {
      subject: '[DogDex] Your AI Feedback has been approved',
      title: 'Thank you for your contribution',
      intro: (userName: string, breed: string) =>
        `Hello ${userName}, your feedback for <strong>${breed}</strong> breed identification has been approved.`,
    },
  },
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log(`SMTP Mailer initialized successfully (${host}:${port})`);
    } else {
      this.logger.warn(
        `SMTP credentials not fully set. Email sending will be logged to console (Mock Mode).`,
      );
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    htmlContent: string,
  ): Promise<void> {
    const brevoApiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.EMAIL_FROM || 'ctytest8@gmail.com';
    const senderName = 'DogDex Support';

    if (brevoApiKey) {
      try {
        this.logger.log(`[Brevo API] Sending email to: ${to}`);
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'api-key': brevoApiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: senderName, email: senderEmail },
            to: [{ email: to }],
            subject: subject,
            htmlContent: htmlContent,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          this.logger.error(
            `[Brevo API Error] (${response.status}): ${JSON.stringify(errorData)}`,
          );
          throw new Error(`Brevo API Error: ${response.statusText}`);
        }

        const data = await response.json();
        this.logger.log(
          `[Email Sent via Brevo] To: ${to} | MessageId: ${data.messageId}`,
        );
        return;
      } catch (err: any) {
        this.logger.error(`[Brevo API Exception] ${err.message}`);
      }
    }

    const from = process.env.EMAIL_FROM || '"DogDex App" <noreply@dogdex.com>';

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from,
          to,
          subject,
          html: htmlContent,
        });
        this.logger.log(
          `[Email Sent via SMTP] To: ${to} | Subject: ${subject}`,
        );
      } catch (err: any) {
        this.logger.error(
          `[Email Failed via SMTP] To: ${to} | Error: ${err.message}`,
        );
      }
    } else {
      this.logger.log(
        `[MOCK EMAIL] To: ${to}\nSubject: ${subject}\nHTML Preview:\n${htmlContent.substring(0, 300)}...`,
      );
    }
  }

  private buildRetroOtpEmailTemplate(
    otp: string,
    userName: string,
    type: 'verification' | 'passwordReset',
    lang: EmailLanguage = 'vi',
  ): { subject: string; html: string } {
    const t = translations[lang][type];
    const isVerify = type === 'verification';

    const badgeColor = isVerify ? '#00A170' : '#FF6B00';
    const badgeText = isVerify
      ? 'TRẠM XÁC THỰC TÀI KHOẢN'
      : 'TRẠM KHÔI PHỤC MẬT KHẨU';
    const accentBg = isVerify ? '#E8F5E9' : '#FFF3E0';

    const emailSubject = isVerify
      ? '[DogDex] Xác thực tài khoản - Mã OTP của bạn'
      : '[DogDex] Khôi phục mật khẩu - Mã OTP của bạn';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${emailSubject}</title>
      </head>
      <body style="margin: 0; padding: 24px 12px; background-color: #F0EDE6; font-family: Arial, 'Segoe UI', Roboto, Helvetica, sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" style="max-width: 560px; background-color: #ffffff; border: 4px solid #232B26; border-radius: 20px; box-shadow: 8px 8px 0px #232B26; overflow: hidden;" cellspacing="0" cellpadding="0" border="0">
                <!-- Header Bar -->
                <tr>
                  <td style="background-color: #232B26; padding: 24px 20px; text-align: center; border-bottom: 4px solid #232B26;">
                    <div style="font-size: 24px; font-weight: 900; color: #ffffff; font-family: Arial, 'Segoe UI', sans-serif; letter-spacing: 3px;">
                      DOGDEX
                    </div>
                    <div style="display: inline-block; margin-top: 8px; background-color: ${badgeColor}; color: #ffffff; padding: 4px 14px; border-radius: 8px; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; border: 2px solid #ffffff; font-family: Arial, 'Segoe UI', sans-serif;">
                      ${badgeText}
                    </div>
                  </td>
                </tr>

                <!-- Main Content Body -->
                <tr>
                  <td style="padding: 32px 24px; color: #232B26;">
                    <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 800; color: #232B26; font-family: Arial, 'Segoe UI', sans-serif; line-height: 1.4;">
                      ${t.greeting(userName)}
                    </h2>
                    <p style="margin: 0 0 16px 0; font-size: 14px; font-weight: 400; line-height: 1.6; color: #333333; font-family: Arial, 'Segoe UI', sans-serif;">
                      ${t.intro}
                    </p>
                    <p style="margin: 0 0 24px 0; font-size: 14px; font-weight: 700; color: #232B26; font-family: Arial, 'Segoe UI', sans-serif;">
                      ${t.instruction}
                    </p>

                    <!-- Copy-Friendly 6-Digit OTP Box -->
                    <div style="background-color: ${accentBg}; border: 3px solid #232B26; border-radius: 16px; box-shadow: 4px 4px 0px #232B26; padding: 24px 16px; text-align: center; margin: 24px 0;">
                      <div style="font-family: Arial, 'Segoe UI', sans-serif; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #232B26; margin-bottom: 12px;">
                        MÃ BẢO MẬT OTP (6 CHỮ SỐ)
                      </div>
                      <div style="display: inline-block; background-color: #ffffff; border: 3px solid #232B26; border-radius: 12px; box-shadow: 3px 3px 0px #232B26; padding: 12px 24px; margin: 4px 0;">
                        <span style="font-family: 'Consolas', 'Courier New', Monaco, monospace; font-size: 32px; font-weight: 900; letter-spacing: 10px; color: #232B26; -webkit-user-select: all; user-select: all; cursor: pointer;">${otp}</span>
                      </div>
                      <div style="font-family: Arial, 'Segoe UI', sans-serif; font-size: 11px; font-weight: 600; color: #555555; margin-top: 10px;">
                        (Nhấp đúp hoặc đè chọn chuỗi số trên để sao chép nhanh)
                      </div>
                    </div>

                    <!-- Security Notice Box -->
                    <div style="background-color: #FFF9E6; border: 3px solid #232B26; border-radius: 12px; box-shadow: 3px 3px 0px #232B26; padding: 14px 18px; margin: 24px 0;">
                      <div style="font-size: 13px; font-weight: 700; color: #232B26; line-height: 1.5; font-family: Arial, 'Segoe UI', sans-serif;">
                        ${t.expireNotice(10)}
                      </div>
                    </div>

                    <p style="margin: 20px 0 0 0; font-size: 12px; font-weight: 400; color: #666666; line-height: 1.5; border-top: 2px dashed #232B26; padding-top: 16px; font-family: Arial, 'Segoe UI', sans-serif;">
                      ${(t as any).warning || t.intro}
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #232B26; color: #F0EDE6; padding: 16px 20px; text-align: center; font-size: 11px; font-weight: 700; letter-spacing: 1px; border-top: 4px solid #232B26; font-family: Arial, 'Segoe UI', sans-serif;">
                    DOGDEX SMART PET SYSTEM • EMAIL HỆ THỐNG TỰ ĐỘNG
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return { subject: emailSubject, html };
  }

  async sendVerificationOtp(options: OtpEmailOptions): Promise<void> {
    const lang = options.language || 'vi';
    const name = options.userName || 'Trainer';
    const { subject, html } = this.buildRetroOtpEmailTemplate(
      options.otp,
      name,
      'verification',
      lang,
    );
    await this.sendEmail(options.to, subject, html);
  }

  async sendPasswordResetOtp(options: OtpEmailOptions): Promise<void> {
    const lang = options.language || 'vi';
    const name = options.userName || 'Trainer';
    const { subject, html } = this.buildRetroOtpEmailTemplate(
      options.otp,
      name,
      'passwordReset',
      lang,
    );
    await this.sendEmail(options.to, subject, html);
  }

  async sendQrScanAlert(options: QrScanAlertOptions): Promise<void> {
    const lang = options.language || 'vi';
    const t = translations[lang].qrScanAlert;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #D97706;">${t.title}</h2>
        <p style="font-size: 16px;">${t.intro(options.dogName)}</p>
        <div style="background: #FFFBEB; padding: 15px; border-radius: 6px; border-left: 4px solid #F59E0B; margin: 20px 0;">
          <p><strong>${t.labelLocation}</strong> ${options.locationInfo}</p>
          <p><strong>${t.labelTime}</strong> ${options.scanTime}</p>
        </div>
        <p style="color: #4B5563;">${t.advice}</p>
      </div>
    `;
    await this.sendEmail(options.to, t.subject(options.dogName), html);
  }

  async sendDogFoundNotification(
    options: FoundDogNotificationOptions,
  ): Promise<void> {
    const lang = options.language || 'vi';
    const t = translations[lang].dogFound;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #059669;">${t.title}</h2>
        <p style="font-size: 16px;">${t.intro(options.ownerName)}</p>
        <div style="background: #ECFDF5; padding: 15px; border-radius: 6px; border-left: 4px solid #10B981; margin: 20px 0;">
          <h3>${t.finderDetails}</h3>
          <p><strong>${t.labelName}</strong> ${options.finderName}</p>
          <p><strong>${t.labelPhone}</strong> ${options.finderPhone}</p>
          ${options.finderEmail ? `<p><strong>${t.labelEmail}</strong> ${options.finderEmail}</p>` : ''}
          ${options.message ? `<p><strong>${t.labelMessage}</strong> ${options.message}</p>` : ''}
          ${options.location?.address ? `<p><strong>${t.labelLocation}</strong> ${options.location.address}</p>` : ''}
        </div>
        ${options.evidenceUrl ? `<p><strong>${t.evidenceTitle}</strong></p><img src="${options.evidenceUrl}" style="max-width: 100%; border-radius: 6px;" />` : ''}
      </div>
    `;
    await this.sendEmail(options.to, t.subject(options.ownerName), html);
  }

  async sendThankFinderEmail(options: ThankFinderOptions): Promise<void> {
    const lang = options.language || 'vi';
    const t = translations[lang].thankFinder;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #4F46E5;">${t.title}</h2>
        <p style="font-size: 16px;">${t.intro(options.dogName, options.dogBreed)}</p>
        <div style="background: #EEF2FF; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p>${options.hasAccount ? t.rewardNotice : t.signupInvite}</p>
        </div>
      </div>
    `;
    await this.sendEmail(options.to, t.subject, html);
  }

  async sendFeedbackThankYouEmail(
    options: FeedbackApprovedOptions,
  ): Promise<void> {
    const lang = options.language || 'vi';
    const t = translations[lang].feedbackApproved;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #4F46E5;">${t.title}</h2>
        <p style="font-size: 16px;">${t.intro(options.userName, options.breedLabel)}</p>
      </div>
    `;
    await this.sendEmail(options.to, t.subject, html);
  }

  async sendContactFormEmail(payload: ContactFormPayload): Promise<void> {
    const receiverEmail = process.env.EMAIL_FROM || process.env.SMTP_USER;
    if (!receiverEmail) return;

    const html = `
      <h2>Feedback từ Contact Form</h2>
      <p><strong>Từ:</strong> ${payload.fromEmail}</p>
      <p><strong>Nội dung:</strong></p>
      <pre style="background: #F3F4F6; padding: 15px; border-radius: 6px;">${payload.message}</pre>
    `;
    await this.sendEmail(
      receiverEmail,
      `[Contact Form] Từ ${payload.fromEmail}`,
      html,
    );
  }
}
