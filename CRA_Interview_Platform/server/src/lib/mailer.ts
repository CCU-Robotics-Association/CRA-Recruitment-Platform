import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { config } from '../config.ts';

let transporter: Transporter | null = null;

function getTransporter() {
  if (!config.smtp) return null;
  transporter ??= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transporter;
}

export async function sendVerificationEmail(
  recipient: string,
  code: string,
  purpose: 'registration' | 'password_reset',
): Promise<boolean> {
  const sender = getTransporter();
  if (!sender || !config.smtp) return false;

  const action = purpose === 'registration' ? '报名邮箱验证' : '重置报名密码';
  await sender.sendMail({
    from: config.smtp.from,
    to: recipient,
    subject: 'CRA ' + action + '验证码',
    text: '你的验证码是 ' + code + '，10 分钟内有效。请勿将验证码告诉他人。如非本人操作，请忽略本邮件。',
    html:
      '<div style="font-family:system-ui,sans-serif;line-height:1.7;color:#222">' +
      '<h2>CRA ' +
      action +
      '</h2><p>你的验证码是：</p><p style="font-size:30px;font-weight:700;letter-spacing:8px">' +
      code +
      '</p><p>验证码 10 分钟内有效，请勿将验证码告诉他人。</p><p style="color:#777">如非本人操作，请忽略本邮件。</p></div>',
  });
  return true;
}

export async function verifyMailerConfiguration(): Promise<void> {
  const sender = getTransporter();
  if (!sender) throw new Error('SMTP 未配置');
  await sender.verify();
}

export function closeMailer(): void {
  transporter?.close();
  transporter = null;
}
