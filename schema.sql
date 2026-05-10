CREATE TABLE IF NOT EXISTS emails (
    id              SERIAL PRIMARY KEY,
    tracking_id     VARCHAR(64)   UNIQUE NOT NULL,
    company_name    VARCHAR(255)  NOT NULL,
    recipient_name  VARCHAR(255)  NOT NULL,
    email_to        VARCHAR(255)  NOT NULL,
    subject         VARCHAR(500)  NOT NULL,
    body            TEXT          NOT NULL,
    status          VARCHAR(10)   NOT NULL DEFAULT 'PENDING',
    sent_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    opened_at       TIMESTAMPTZ
);
