import nodemailer from "nodemailer";
import { id } from "./security.mjs";
export async function enqueue(db, recipient, subject, body) {
  if (recipient)
    await db.query(
      "INSERT INTO email_outbox(id,recipient,subject,body,created_at) VALUES(?,?,?,?,?)",
      [id(), recipient, subject, body, Date.now()],
    );
}
export async function drainMail(db) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM)
    return { configured: false, sent: 0 };
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_PORT === "465",
    disableFileAccess: true,
    disableUrlAccess: true,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  let sent = 0;
  for (const m of await db.all(
    "SELECT * FROM email_outbox WHERE state='pending' AND attempts<5 ORDER BY created_at LIMIT 15",
  )) {
    const claimed = await db.query(
      "UPDATE email_outbox SET state='sending',attempts=attempts+1 WHERE id=? AND state='pending'",
      [m.id],
    );
    if (!claimed.changes) continue;
    try {
      await transport.sendMail({
        from: process.env.SMTP_FROM,
        to: m.recipient,
        subject: m.subject,
        text: m.body,
      });
      await db.query("UPDATE email_outbox SET state='sent' WHERE id=?", [m.id]);
      sent++;
    } catch {
      await db.query("UPDATE email_outbox SET state='pending' WHERE id=?", [
        m.id,
      ]);
    }
  }
  return { configured: true, sent };
}
