import nodemailer from 'nodemailer';

// Função serverless (Vercel) — envia avisos gerais por email via SMTP próprio
// (cm-viladerei.pt). Credenciais ficam só nas variáveis de ambiente do projeto
// Vercel (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM), nunca no repo.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { subject, html, recipients } = req.body || {};

  if (!subject || !html || !Array.isArray(recipients) || recipients.length === 0) {
    res.status(400).json({ error: 'Campos obrigatórios: subject, html, recipients[]' });
    return;
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    res.status(500).json({ error: 'SMTP não configurado no servidor (variáveis de ambiente em falta).' });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const BATCH_SIZE = 50;
  const failed: string[] = [];

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    try {
      await transporter.sendMail({
        from: SMTP_FROM || SMTP_USER,
        to: SMTP_FROM || SMTP_USER,
        bcc: batch,
        subject,
        html,
      });
    } catch (e: any) {
      console.error('Erro ao enviar lote de email:', e.message);
      failed.push(...batch);
    }
  }

  res.status(failed.length > 0 ? 207 : 200).json({
    sent: recipients.length - failed.length,
    failed,
  });
}
