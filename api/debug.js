export default function handler(req, res) {
    res.status(200).json({
        GMAIL_USER:         !!process.env.GMAIL_USER,
        GMAIL_APP_PASSWORD: !!process.env.GMAIL_APP_PASSWORD,
        PIXEL_BASE_URL:     process.env.PIXEL_BASE_URL || "(using VERCEL_URL fallback)",
        VERCEL_URL:         process.env.VERCEL_URL     || "(not set)",
        node_env:           process.env.NODE_ENV,
    });
}
