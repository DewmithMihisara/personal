import pool from "./db.js";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;

    try {
        const [rows, count] = await Promise.all([
            pool.query(
                `SELECT id, tracking_id, company_name, recipient_name, email_to,
                        subject, status, sent_at, opened_at
                 FROM emails
                 ORDER BY sent_at DESC
                 LIMIT $1 OFFSET $2`,
                [limit, offset]
            ),
            pool.query("SELECT COUNT(*)::int AS total FROM emails"),
        ]);

        const total      = count.rows[0].total;
        const totalPages = Math.max(1, Math.ceil(total / limit));

        res.status(200).json({ emails: rows.rows, total, page, totalPages });
    } catch (err) {
        console.error("[emails] DB query failed:", err.message, "| code:", err.code);
        res.status(500).json({ error: err.message });
    }
}
