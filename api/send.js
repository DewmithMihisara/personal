import nodemailer from "nodemailer";
import pool from "./db.js";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { companyName, recipientName, to, subject, body } = req.body;

    if (!companyName || !recipientName || !to || !subject || !body) {
        return res.status(400).json({ error: "All fields are required: companyName, recipientName, to, subject, body." });
    }

    if (!process.env.GMAIL_USER) {
        return res.status(500).json({ error: "GMAIL_USER environment variable is not set." });
    }
    if (!process.env.GMAIL_APP_PASSWORD) {
        return res.status(500).json({ error: "GMAIL_APP_PASSWORD environment variable is not set." });
    }
    if (!process.env.DATABASE_URL) {
        return res.status(500).json({ error: "DATABASE_URL environment variable is not set." });
    }

    const baseUrl =
        process.env.PIXEL_BASE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const trackingId = `track_${Date.now()}`;
    const safeBody   = body.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family:sans-serif;font-size:15px;color:#222;line-height:1.6;max-width:600px;margin:0 auto;padding:20px;">
  <p>Dear ${recipientName},</p>
  <p>${safeBody}</p>
  <p style="margin-top:24px;">Best regards,<br/>${companyName}</p>
  <img src="${baseUrl}/api/pixel?id=${trackingId}"
       width="1" height="1"
       style="display:block;width:1px;height:1px;opacity:0;" alt="" />
</body>
</html>`;

    const text = `Dear ${recipientName},\n\n${body}\n\nBest regards,\n${companyName}`;

    try {
        await pool.query(
            `INSERT INTO emails (tracking_id, company_name, recipient_name, email_to, subject, body)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [trackingId, companyName, recipientName, to, subject, body]
        );
    } catch (err) {
        return res.status(500).json({ error: `Database error: ${err.message}` });
    }

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });

    try {
        await transporter.sendMail({
            from:    `${companyName} <${process.env.GMAIL_USER}>`,
            replyTo: process.env.GMAIL_USER,
            to,
            subject,
            text,
            html,
        });
        res.status(200).json({ success: true, trackingId });
    } catch (err) {
        await pool.query("DELETE FROM emails WHERE tracking_id = $1", [trackingId]);
        res.status(500).json({ error: err.message });
    }
}
