import pool from "./db.js";

async function buildChart(range) {
    let trunc, interval, labelFn, points;

    if (range === "week") {
        trunc    = "day";
        interval = "6 days";
        points   = 7;
        labelFn  = (d) => new Date(d).toLocaleDateString("en-US", { weekday: "short" });
    } else if (range === "year") {
        trunc    = "month";
        interval = "11 months";
        points   = 12;
        labelFn  = (d) => new Date(d).toLocaleDateString("en-US", { month: "short" });
    } else {
        // month
        trunc    = "day";
        interval = "29 days";
        points   = 30;
        labelFn  = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }

    const sql = `
        WITH series AS (
            SELECT generate_series(
                DATE_TRUNC($1, NOW() - INTERVAL '${interval}'),
                DATE_TRUNC($1, NOW()),
                INTERVAL '1 ${trunc}'
            ) AS bucket
        )
        SELECT
            s.bucket,
            COUNT(e.id) FILTER (WHERE e.sent_at IS NOT NULL)   AS sent,
            COUNT(e.id) FILTER (WHERE e.status = 'OPENED')     AS opened
        FROM series s
        LEFT JOIN emails e
            ON DATE_TRUNC($1, e.sent_at) = s.bucket
        GROUP BY s.bucket
        ORDER BY s.bucket
        LIMIT $2
    `;

    const { rows } = await pool.query(sql, [trunc, points]);

    return {
        labels: rows.map((r) => labelFn(r.bucket)),
        sent:   rows.map((r) => parseInt(r.sent)   || 0),
        opened: rows.map((r) => parseInt(r.opened) || 0),
    };
}

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const [totals, week, month, year] = await Promise.all([
            pool.query(`
                SELECT
                    COUNT(*)::int                                      AS "totalSent",
                    COUNT(*) FILTER (WHERE status = 'OPENED')::int    AS "totalOpened"
                FROM emails
            `),
            buildChart("week"),
            buildChart("month"),
            buildChart("year"),
        ]);

        const { totalSent, totalOpened } = totals.rows[0];

        res.status(200).json({
            totalSent,
            totalOpened,
            chart: { week, month, year },
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
