import nodemailer from "nodemailer";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { to, subject, message } = req.body;

    if (!to || !subject) {
        return res.status(400).json({ error: "Fields 'to' and 'subject' are required." });
    }

    if (!process.env.GMAIL_USER) {
        return res.status(500).json({ error: "GMAIL_USER environment variable is not set." });
    }
    if (!process.env.GMAIL_APP_PASSWORD) {
        return res.status(500).json({ error: "GMAIL_APP_PASSWORD environment variable is not set." });
    }

    const baseUrl =
        process.env.PIXEL_BASE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const trackingId = `track_${Date.now()}`;
    const bodyText   = message || "Hi, this is a tracked test email.";
    const safeText   = bodyText.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family:sans-serif;font-size:15px;color:#222;line-height:1.6;max-width:600px;margin:0 auto;padding:20px;">
  <p>${safeText}</p>
  <p style="color:#888;font-size:12px;margin-top:32px;">
    This email was sent for academic research on email open tracking.
  </p>
  <img src="${baseUrl}/api/pixel?id=${trackingId}"
       width="1" height="1"
       style="display:block;width:1px;height:1px;opacity:0;" alt="" />
</body>
</html>`;

    // Plain-text alternative — required to avoid spam filters
    const text = `${bodyText}\n\n---\nThis email was sent for academic research on email open tracking.`;

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });

    try {
        await transporter.sendMail({
            from:    `Pixel Tracker <${process.env.GMAIL_USER}>`,
            replyTo: process.env.GMAIL_USER,
            to,
            subject,
            text,
            html,
        });
        res.status(200).json({ success: true, trackingId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
