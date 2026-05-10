export default function handler(req, res) {
    const ip =
        req.headers["x-forwarded-for"] ||
        req.socket?.remoteAddress ||
        "Unknown";

    const userAgent = req.headers["user-agent"] || "Unknown";
    const timestamp = new Date().toISOString();
    const referer = req.headers["referer"] || "None";
    const language = req.headers["accept-language"] || "Unknown";
    const acceptEncoding = req.headers["accept-encoding"] || "Unknown";

    // Log all collectable data
    const data = {
        timestamp,
        ip: ip.split(",")[0].trim(), // first IP if multiple
        userAgent,
        referer,
        language,
        acceptEncoding,
    };

    console.log("PIXEL HIT:", JSON.stringify(data, null, 2));

    // Return a 1x1 transparent GIF
    const pixel = Buffer.from(
        "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        "base64"
    );

    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(pixel);
}