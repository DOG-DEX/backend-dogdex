import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { logger } from '../../utils/logger.util';

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
      autoEmail: 'Email này được gửi tự động, vui lòng không trả lời trực tiếp.',
      ctaViewDetails: 'Xem chi tiết',
      ctaViewAll: 'Xem tất cả',
    },
    passwordReset: {
      subject: '🔐 Đặt lại mật khẩu DogDex',
      greeting: (name: string) => `Xin chào ${name} 👋`,
      intro: 'Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản <strong>DogDex</strong> của mình.',
      instruction: 'Vui lòng sử dụng mã xác thực bên dưới để hoàn tất quá trình:',
      expireNotice: (mins: number) => `⚠️ Mã xác thực này sẽ hết hạn sau <strong>${mins} phút</strong>.`,
      warning: 'Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này hoặc liên hệ bộ phận hỗ trợ.',
    },
    verification: {
      subject: '✨ Xác thực tài khoản DogDex của bạn',
      greeting: (name: string) => `Chào mừng ${name} đến với DogDex! 🎉`,
      intro: 'Cảm ơn bạn đã đăng ký tài khoản. Để bắt đầu sử dụng dịch vụ, vui lòng xác thực địa chỉ email của bạn.',
      instruction: 'Mã xác thực của bạn là:',
      expireNotice: (mins: number) => `⚠️ Mã xác thực này sẽ hết hạn sau <strong>${mins} phút</strong>.`,
      warning: 'Nếu bạn không tạo tài khoản DogDex, vui lòng bỏ qua email này.',
    },
    qrScanAlert: {
      subject: (dogName: string) => `📍 [DogDex] Có người vừa quét mã QR của ${dogName}!`,
      title: '📍 Có người vừa quét mã QR chó của bạn!',
      intro: (dogName: string) => `Ai đó vừa quét mã QR trên vòng cổ của bé <strong>${dogName}</strong>! Đây có thể là dấu hiệu cho thấy bé đang ở gần đó.`,
      labelLocation: 'Vị trí phát hiện:',
      labelTime: 'Thời gian:',
      advice: '💡 Hãy kiểm tra ứng dụng DogDex ngay để xem chi tiết bài đăng hoặc liên hệ với người tìm thấy.',
    },
    dogFound: {
      subject: (dogName: string) => `🚨 [DogDex] ĐÃ TÌM THẤY BÉ ${dogName.toUpperCase()}!`,
      title: '🎉 Có người vừa báo tìm thấy chó của bạn!',
      intro: (dogName: string) => `Một người tốt bụng vừa báo cáo đã nhìn thấy/tìm thấy bé <strong>${dogName}</strong>!`,
      finderDetails: 'Thông tin người tìm thấy:',
      labelName: 'Họ tên:',
      labelPhone: 'Số điện thoại:',
      labelEmail: 'Email:',
      labelMessage: 'Lời nhắn:',
      labelLocation: 'Vị trí:',
      labelVerification: 'Phương thức xác thực:',
      verificationCamera: 'AI Camera (Phân tích hình ảnh)',
      verificationQr: 'Quét mã QR (Chính xác 100%)',
      evidenceTitle: '📷 Ảnh bằng chứng:',
    },
    thankFinder: {
      subject: '❤️ Cảm ơn bạn đã giúp đỡ tìm cún lạc trên DogDex!',
      title: '❤️ Cảm ơn tấm lòng tốt bụng của bạn!',
      intro: (dogName: string, breed: string) => `Cảm ơn bạn rất nhiều vì đã báo cáo thông tin giúp đỡ tìm thấy bé <strong>${dogName}</strong> (giống ${breed}).`,
      rewardNotice: '🎁 Bạn vừa được thưởng <strong>+10 Token</strong> vào tài khoản DogDex để tiếp tục sử dụng các tính năng AI!',
      signupInvite: '💡 Tạo tài khoản DogDex ngay để nhận 10 Token thưởng và tham gia cộng đồng bảo vệ thú cưng!',
    },
    matchNotification: {
      subject: (isLost: boolean, breed: string, count: number) =>
        isLost
          ? `🔍 [DogDex] Có ${count} kết quả phù hợp với cún ${breed} bị mất của bạn!`
          : `📢 [DogDex] Có cún ${breed} lạc phù hợp với bài đăng của bạn!`,
      title: (isLost: boolean) => isLost ? '🔍 Tìm thấy bài đăng phù hợp với cún bị mất!' : '📢 Tìm thấy cún bị mất phù hợp với bài đăng!',
      intro: (name: string, breed: string, count: number, isLost: boolean) =>
        isLost
          ? `Xin chào ${name}, hệ thống DogDex vừa phát hiện <strong>${count} bài đăng</strong> chó đi lạc gần đây có thể là bé <strong>${breed}</strong> của bạn.`
          : `Xin chào ${name}, hệ thống DogDex phát hiện bài đăng của bạn có thể trùng khớp với <strong>${count} bé ${breed}</strong> đang được báo tìm chủ.`,
    },
    healthReminder: {
      subject: (dogName: string, title: string) => `⏰ [DogDex] Nhắc nhở lịch khám cho ${dogName}: ${title}`,
      title: '⏰ Nhắc nhở lịch trình sức khỏe',
      intro: (ownerName: string, dogName: string) => `Xin chào ${ownerName}, bé <strong>${dogName}</strong> có một lịch trình sức khỏe cần chú ý:`,
    },
    feedbackApproved: {
      subject: '🌟 Feedback của bạn về AI đã được phê duyệt!',
      title: '🌟 Cảm ơn sự đóng góp của bạn!',
      intro: (userName: string, breed: string) => `Xin chào ${userName}, đóng góp phản hồi về nhận diện giống chó <strong>${breed}</strong> của bạn đã được quản trị viên chấp nhận.`,
    },
  },
  en: {
    common: {
      footer: 'AI-Powered Dog Breed Identification App.',
      autoEmail: 'This email was generated automatically. Please do not reply directly.',
      ctaViewDetails: 'View Details',
      ctaViewAll: 'View All',
    },
    passwordReset: {
      subject: '🔐 Reset your DogDex Password',
      greeting: (name: string) => `Hello ${name} 👋`,
      intro: 'You requested a password reset for your <strong>DogDex</strong> account.',
      instruction: 'Please use the verification code below to complete the process:',
      expireNotice: (mins: number) => `⚠️ This code will expire in <strong>${mins} minutes</strong>.`,
      warning: 'If you did not request a password reset, please ignore this email.',
    },
    verification: {
      subject: '✨ Verify your DogDex account',
      greeting: (name: string) => `Welcome ${name} to DogDex! 🎉`,
      intro: 'Thank you for registering. Please verify your email address to get started.',
      instruction: 'Your verification code is:',
      expireNotice: (mins: number) => `⚠️ This code will expire in <strong>${mins} minutes</strong>.`,
      warning: 'If you did not create a DogDex account, please ignore this email.',
    },
    qrScanAlert: {
      subject: (dogName: string) => `📍 [DogDex] Someone just scanned ${dogName}'s QR code!`,
      title: '📍 Someone scanned your dog\'s QR code!',
      intro: (dogName: string) => `Someone just scanned the QR code on <strong>${dogName}</strong>'s collar!`,
      labelLocation: 'Location:',
      labelTime: 'Time:',
      advice: '💡 Check your DogDex app for details or to contact the finder.',
    },
    dogFound: {
      subject: (dogName: string) => `🚨 [DogDex] ${dogName.toUpperCase()} HAS BEEN FOUND!`,
      title: '🎉 Someone reported finding your dog!',
      intro: (dogName: string) => `A kind person just reported seeing/finding <strong>${dogName}</strong>!`,
      finderDetails: 'Finder details:',
      labelName: 'Name:',
      labelPhone: 'Phone:',
      labelEmail: 'Email:',
      labelMessage: 'Message:',
      labelLocation: 'Location:',
      labelVerification: 'Verification Method:',
      verificationCamera: 'AI Camera',
      verificationQr: 'QR Scan (100% accurate)',
      evidenceTitle: '📷 Evidence Photo:',
    },
    thankFinder: {
      subject: '❤️ Thank you for helping find a lost dog on DogDex!',
      title: '❤️ Thank you for your kindness!',
      intro: (dogName: string, breed: string) => `Thank you so much for reporting information to help find <strong>${dogName}</strong> (${breed}).`,
      rewardNotice: '🎁 You have been rewarded <strong>+10 Tokens</strong> in your DogDex account!',
      signupInvite: '💡 Sign up for DogDex now to claim 10 bonus tokens and join the pet protection community!',
    },
    matchNotification: {
      subject: (isLost: boolean, breed: string, count: number) =>
        isLost ? `🔍 [DogDex] Found ${count} potential matches for your lost ${breed}!` : `📢 [DogDex] Lost ${breed} post matching yours!`,
      title: (isLost: boolean) => isLost ? '🔍 Matches Found for your Lost Dog!' : '📢 Found a Matching Lost Dog Post!',
      intro: (name: string, breed: string, count: number, isLost: boolean) =>
        isLost
          ? `Hello ${name}, DogDex system found <strong>${count} recent posts</strong> that might match your lost <strong>${breed}</strong>.`
          : `Hello ${name}, your post matches <strong>${count} ${breed}</strong> dogs reported found.`,
    },
    healthReminder: {
      subject: (dogName: string, title: string) => `⏰ [DogDex] Health Reminder for ${dogName}: ${title}`,
      title: '⏰ Health Schedule Reminder',
      intro: (ownerName: string, dogName: string) => `Hello ${ownerName}, <strong>${dogName}</strong> has an upcoming health event:`,
    },
    feedbackApproved: {
      subject: '🌟 Your AI Feedback has been approved!',
      title: '🌟 Thank you for your contribution!',
      intro: (userName: string, breed: string) => `Hello ${userName}, your feedback for <strong>${breed}</strong> breed identification has been approved.`,
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
      this.logger.warn(`SMTP credentials not fully set. Email sending will be logged to console (Mock Mode).`);
    }
  }

  async sendEmail(to: string, subject: string, htmlContent: string): Promise<void> {
    const from = process.env.EMAIL_FROM || '"DogDex App" <noreply@dogdex.com>';

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from,
          to,
          subject,
          html: htmlContent,
        });
        this.logger.log(`[Email Sent] To: ${to} | Subject: ${subject}`);
      } catch (err: any) {
        this.logger.error(`[Email Failed] To: ${to} | Error: ${err.message}`);
      }
    } else {
      this.logger.log(`[MOCK EMAIL] To: ${to}\nSubject: ${subject}\nHTML Preview:\n${htmlContent.substring(0, 300)}...`);
    }
  }

  async sendVerificationOtp(options: OtpEmailOptions): Promise<void> {
    const lang = options.language || 'vi';
    const t = translations[lang].verification;
    const name = options.userName || 'bạn';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; borderRadius: 8px;">
        <h2>${t.greeting(name)}</h2>
        <p>${t.intro}</p>
        <p style="font-size: 16px;">${t.instruction}</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4F46E5; background: #EEF2FF; padding: 15px; text-align: center; border-radius: 6px; margin: 20px 0;">
          ${options.otp}
        </div>
        <p style="color: #6B7280;">${t.expireNotice(10)}</p>
        <p style="color: #9CA3AF; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
          ${translations[lang].common.autoEmail}
        </p>
      </div>
    `;
    await this.sendEmail(options.to, t.subject, html);
  }

  async sendPasswordResetOtp(options: OtpEmailOptions): Promise<void> {
    const lang = options.language || 'vi';
    const t = translations[lang].passwordReset;
    const name = options.userName || 'bạn';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2>${t.greeting(name)}</h2>
        <p>${t.intro}</p>
        <p style="font-size: 16px;">${t.instruction}</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #DC2626; background: #FEF2F2; padding: 15px; text-align: center; border-radius: 6px; margin: 20px 0;">
          ${options.otp}
        </div>
        <p style="color: #6B7280;">${t.expireNotice(10)}</p>
        <p style="color: #6B7280;">${t.warning}</p>
      </div>
    `;
    await this.sendEmail(options.to, t.subject, html);
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

  async sendDogFoundNotification(options: FoundDogNotificationOptions): Promise<void> {
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

  async sendFeedbackThankYouEmail(options: FeedbackApprovedOptions): Promise<void> {
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
    await this.sendEmail(receiverEmail, `[Contact Form] Từ ${payload.fromEmail}`, html);
  }
}
