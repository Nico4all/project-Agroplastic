import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

type VerificationPurpose = 'REGISTER' | 'PASSWORD_CHANGE' | 'PASSWORD_RESET';

const SUBJECTS: Record<VerificationPurpose, string> = {
  REGISTER: 'Verifica tu correo en Caudalia',
  PASSWORD_CHANGE: 'Confirma el cambio de contrasena en Caudalia',
  PASSWORD_RESET: 'Recupera tu contrasena en Caudalia',
};

const INTRO: Record<VerificationPurpose, string> = {
  REGISTER: 'Usa este codigo para activar tu cuenta.',
  PASSWORD_CHANGE: 'Usa este codigo para confirmar el cambio de contrasena.',
  PASSWORD_RESET: 'Usa este codigo para recuperar el acceso a tu cuenta.',
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter?: Transporter;

  constructor(private readonly config: ConfigService) {}

  async sendVerificationCode(to: string, code: string, purpose: VerificationPurpose, ttlMinutes: number) {
    const from = this.config.get<string>('SMTP_FROM') || this.config.get<string>('SMTP_USER');
    if (!from) throw new InternalServerErrorException('SMTP_FROM no esta configurado');

    try {
      await this.getTransporter().sendMail({
        from,
        to,
        subject: SUBJECTS[purpose],
        text: this.textTemplate(code, purpose, ttlMinutes),
        html: this.htmlTemplate(code, purpose, ttlMinutes),
      });
    } catch (error) {
      this.logger.error(`No se pudo enviar correo a ${to}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('No se pudo enviar el codigo por correo');
    }
  }

  private getTransporter() {
    if (this.transporter) return this.transporter;

    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const port = Number(this.config.get<string>('SMTP_PORT') || 465);
    const secure = (this.config.get<string>('SMTP_SECURE') || 'true') === 'true';

    if (!host || !user || !pass) {
      throw new InternalServerErrorException('Credenciales SMTP incompletas');
    }

    this.transporter = createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    return this.transporter;
  }

  private textTemplate(code: string, purpose: VerificationPurpose, ttlMinutes: number) {
    return [
      'Caudalia',
      '',
      INTRO[purpose],
      '',
      `Codigo: ${code}`,
      '',
      `Este codigo vence en ${ttlMinutes} minutos.`,
      'Si no solicitaste este codigo, puedes ignorar este correo.',
    ].join('\n');
  }

  private htmlTemplate(code: string, purpose: VerificationPurpose, ttlMinutes: number) {
    return `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#16251E">
        <h1 style="margin:0 0 12px;font-size:24px">Caudalia</h1>
        <p style="font-size:15px;color:#5C6B62">${INTRO[purpose]}</p>
        <div style="margin:24px 0;padding:18px;border-radius:12px;background:#E7F5EE;text-align:center">
          <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#0B7A4D">Codigo de verificacion</p>
          <p style="margin:0;font-size:34px;font-weight:700;letter-spacing:6px;color:#16251E">${code}</p>
        </div>
        <p style="font-size:14px;color:#5C6B62">Este codigo vence en ${ttlMinutes} minutos.</p>
        <p style="font-size:12px;color:#5C6B62">Si no solicitaste este codigo, puedes ignorar este correo.</p>
      </div>
    `;
  }
}
