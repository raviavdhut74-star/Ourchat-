import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transport = null;
if (config.smtp.host) {
  transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
}

export async function sendMail({ to, subject, text }) {
  if (!transport) {
    console.log(`\n[mail disabled] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  await transport.sendMail({ from: config.smtp.from, to, subject, text });
}
