export default function handler(req, res) {
    if (req.method === "DELETE") {
        globalThis._pixelHits = [];
        return res.status(200).json({ success: true });
    }

    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const hits = globalThis._pixelHits || [];
    res.status(200).json({ hits, total: hits.length });
}
