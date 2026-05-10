import pg from "pg";
const { Pool } = pg;

globalThis._pgPool = globalThis._pgPool || new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

export default globalThis._pgPool;
