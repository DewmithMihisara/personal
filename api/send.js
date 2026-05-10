import nodemailer from "nodemailer";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { to, subject, message } = req.body;

    if (!to || !subject) {
        return res.status(400).json({ error: "Fields 'to' and 'subject' are required." });
    }

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        return res.status(500).json({ error: "Server email credentials are not configured." });
    }

    const baseUrl =
        process.env.PIXEL_BASE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const trackingId = `track_${Date.now()}`;

    const html = `
<html>
  <body>
    <p>${message ? message.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "Hi, this is a tracked test email."}</p>
    <img
      src="${baseUrl}/api/pixel?id=${trackingId}"
      width="1" height="1" style="display:block;width:1px;height:1px;opacity:0;" alt=""
    />
  </body>
</html>`;

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });

    try {
        await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to,
            subject,
            html,
        });
        res.status(200).json({ success: true, trackingId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
