// Single file handles both /api/pixel and /api/hits so they share
// the same process and the same globalThis._pixelHits array.
// vercel.json rewrites both paths here.

function parseUA(ua) {
    if (!ua || ua === "Unknown") return { os: "Unknown", device: "Desktop", emailClient: "Unknown" };

    let emailClient = "Unknown";
    if (/GoogleImageProxy|APIs-Google/i.test(ua))         emailClient = "Gmail (Google Proxy)";
    else if (/Outlook-iOS/i.test(ua))                     emailClient = "Outlook (iOS)";
    else if (/Outlook-Android/i.test(ua))                 emailClient = "Outlook (Android)";
    else if (/Microsoft Outlook|MSOffice/i.test(ua))      emailClient = "Outlook (Desktop)";
    else if (/Thunderbird/i.test(ua))                     emailClient = "Thunderbird";
    else if (/YahooMailProxy|Yahoo/i.test(ua))            emailClient = "Yahoo Mail";
    else if (/Apple Mail|AppleMail/i.test(ua))            emailClient = "Apple Mail";
    else if (/ProtonMail/i.test(ua))                      emailClient = "ProtonMail";
    else if (/Fastmail/i.test(ua))                        emailClient = "Fastmail";

    let os = "Unknown";
    if (/Windows NT 10\.0/i.test(ua))        os = "Windows 10/11";
    else if (/Windows NT 6\.3/i.test(ua))    os = "Windows 8.1";
    else if (/Windows NT 6\.1/i.test(ua))    os = "Windows 7";
    else if (/Windows/i.test(ua))            os = "Windows";
    else if (/iPhone OS ([\d_]+)/i.test(ua)) {
        const v = ua.match(/iPhone OS ([\d_]+)/i)[1].replace(/_/g, ".");
        os = `iOS ${v}`;
    }
    else if (/iPad/i.test(ua))               os = "iPadOS";
    else if (/Mac OS X ([\d_]+)/i.test(ua))  {
        const v = ua.match(/Mac OS X ([\d_]+)/i)[1].replace(/_/g, ".");
        os = `macOS ${v}`;
    }
    else if (/Android ([\d.]+)/i.test(ua))   {
        const v = ua.match(/Android ([\d.]+)/i)[1];
        os = `Android ${v}`;
    }
    else if (/Linux/i.test(ua))              os = "Linux";

    let device = "Desktop";
    if (/iPhone/i.test(ua))               device = "iPhone";
    else if (/iPad/i.test(ua))            device = "iPad";
    else if (/Android.*Mobile/i.test(ua)) device = "Android Phone";
    else if (/Android/i.test(ua))         device = "Android Tablet";

    return { os, device, emailClient };
}

async function getLocation(ip) {
    const isPrivate =
        !ip || ip === "Unknown" ||
        ip === "::1" || ip === "127.0.0.1" ||
        ip.startsWith("192.168.") || ip.startsWith("10.") ||
        ip.startsWith("172.16.")  || ip.startsWith("::ffff:127.");

    if (isPrivate) return "Local / Private Network";

    try {
        const res  = await fetch(`https://ipapi.co/${ip}/json/`, {
            signal: AbortSignal.timeout(3000),
        });
        const data = await res.json();
        if (data.error) return "Unknown";
        return [data.city, data.region, data.country_name].filter(Boolean).join(", ") || "Unknown";
    } catch {
        return "Unknown";
    }
}

async function handlePixel(req, res) {
    const raw = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "Unknown";
    const ip  = raw.split(",")[0].trim();
    const ua  = req.headers["user-agent"] || "Unknown";

    const { os, device, emailClient } = parseUA(ua);
    const location = await getLocation(ip);

    const hit = {
        id:         req.query?.id || "unknown",
        timestamp:  new Date().toISOString(),
        ip,
        location,
        os,
        device,
        emailClient,
        language:   (req.headers["accept-language"] || "Unknown").split(",")[0].trim(),
        userAgent:  ua,
    };

    console.log("PIXEL HIT:", JSON.stringify(hit, null, 2));

    globalThis._pixelHits = globalThis._pixelHits || [];
    globalThis._pixelHits.unshift(hit);
    if (globalThis._pixelHits.length > 500) globalThis._pixelHits.length = 500;

    const pixel = Buffer.from(
        "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        "base64"
    );
    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(pixel);
}

function handleHits(req, res) {
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

export default async function handler(req, res) {
    const action = req.query.action;
    if (action === "hits") return handleHits(req, res);
    return handlePixel(req, res);
}
