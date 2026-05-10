import pool from "./db.js";

export default async function handler(req, res) {
    const trackingId = req.query?.id;

    if (trackingId) {
        try {
            await pool.query(
                `UPDATE emails SET status = 'OPENED', opened_at = NOW()
                 WHERE tracking_id = $1 AND status = 'PENDING'`,
                [trackingId]
            );
        } catch (err) {
            console.error("[tracker] DB update failed:", err.message, "| code:", err.code);
        }
    }

    const pixel = Buffer.from(
        "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        "base64"
    );
    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(pixel);
}
