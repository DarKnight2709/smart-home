import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from 'src/shared/services/config.service';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const emailHost = this.configService.get('EMAIL_HOST') || 'smtp.gmail.com';
    const emailPort = this.configService.get('EMAIL_PORT') || 587;
    const emailUser = this.configService.get('EMAIL_USER');
    const emailPassword = this.configService.get('EMAIL_PASSWORD');

    if (!emailUser || !emailPassword) {
      this.logger.warn(
        '⚠️ Email credentials not configured. Email notifications will be disabled.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: emailHost,
      port: emailPort,
      secure: emailPort === 465, // true for 465, false for other ports
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });

    this.logger.log(`✅ Email service initialized with ${emailHost}:${emailPort}`);
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('Email transporter not initialized. Skipping email send.');
      return false;
    }

    try {
      const emailFrom = this.configService.get('EMAIL_USER');
      
      const mailOptions = {
        from: `"Smart Home System" <${emailFrom}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };
      console.log("email send")

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`📧 Email sent successfully: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Failed to send email: ${error.message}`, error.stack);
      return false;
    }
  }

  async sendSecurityAlert(
    to: string | string[],
    title: string,
    message: string,
    metadata?: Record<string, any>,
  ): Promise<boolean> {
    const html = this.buildAlertHtml({
      headerTitle: '🚨 Cảnh báo bảo mật',
      titleColor: '#dc3545',
      metadataBorderColor: '#ffc107',
      title,
      message,
      metadata,
    });

    return await this.sendEmail({
      to,
      subject: `🚨 ${title}`,
      html,
      text: message,
    });
  }

  async sendSensorWarning(
    to: string | string[],
    title: string,
    message: string,
    metadata?: Record<string, any>,
  ): Promise<boolean> {
    const html = this.buildAlertHtml({
      headerTitle: '⚠️ Cảnh báo cảm biến',
      titleColor: '#b45309',
      metadataBorderColor: '#f59e0b',
      title,
      message,
      metadata,
    });

    return await this.sendEmail({
      to,
      subject: `⚠️ ${title}`,
      html,
      text: message,
    });
  }

  async sendDeviceOfflineAlert(
    to: string | string[],
    title: string,
    message: string,
    metadata?: Record<string, any>,
  ): Promise<boolean> {
    const html = this.buildAlertHtml({
      headerTitle: '📴 Thiết bị offline',
      titleColor: '#1d4ed8',
      metadataBorderColor: '#60a5fa',
      title,
      message,
      metadata,
    });

    return await this.sendEmail({
      to,
      subject: `📴 ${title}`,
      html,
      text: message,
    });
  }

  private buildAlertHtml(params: {
    headerTitle: string;
    titleColor: string;
    metadataBorderColor: string;
    title: string;
    message: string;
    metadata?: Record<string, any>;
  }): string {
    const { headerTitle, titleColor, metadataBorderColor, title, message, metadata } = params;
    const metadataHtml = metadata
      ? `
        <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #ffc107;">
          <h3 style="margin-top: 0; color: #495057;">Chi tiết:</h3>
          ${Object.entries(metadata)
            .map(
              ([key, value]) =>
                `<p style="margin: 5px 0;"><strong>${this.formatKey(key)}:</strong> ${this.formatValue(value || '') || "Không có"}</p>`,
            )
            .join('')}
        </div>
      `
      : '';

    const resolvedMetadataHtml = metadataHtml
      ? metadataHtml.replace('#ffc107', metadataBorderColor)
      : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">${headerTitle}</h1>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: ${titleColor}; margin-top: 0;">${title}</h2>
            <p style="font-size: 16px; color: #495057;">${message}</p>
            
            ${resolvedMetadataHtml}
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 14px; color: #6c757d;">
              <p style="margin: 5px 0;">
                <strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
              </p>
              <p style="margin: 15px 0 5px 0;">
                Đây là email tự động từ hệ thống Smart Home. Vui lòng không trả lời email này.
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #6c757d; font-size: 12px;">
            <p>© 2025 Smart Home System. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;
  }

  private formatKey(key: string): string {
    const keyMap: Record<string, string> = {
      failedAttempts: 'Số lần thử',
      firstAttemptTime: 'Thời gian thử đầu',
      lastAttemptTime: 'Thời gian thử cuối',
      deviceId: 'Thiết bị',
      location: 'Vị trí',
      ipAddress: 'Địa chỉ IP',
      roomStatus: 'Trạng thái phòng',
      occurredAt: 'Thời gian xảy ra',
      temperature: 'Nhiệt độ (°C)',
      humidity: 'Độ ẩm (%)',
      gas: 'Gas',
      gasWarningMessage: 'Cảnh báo gas',
      temperatureWarningMessage: 'Cảnh báo nhiệt độ',
      humidityWarningMessage: 'Cảnh báo độ ẩm',
    };

    return keyMap[key] || key.charAt(0).toUpperCase() + key.slice(1);
  }

  private formatValue(value: any): string {
    if (value instanceof Date) {
      return value.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    }
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) {
        return new Date(parsed).toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
      }
    }
    return String(value);
  }
}
