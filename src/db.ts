import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const RETRYABLE_CODES = new Set(['57P01', '57P02', '57P03', '53300', '08000', '08003', '08006', '08001', '08004', '08P01']);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    query_timeout: 10000,
    statement_timeout: 10000,
});

const isRetryableError = (error: unknown) => {
    if (!error || typeof error !== 'object') return false;
    const code = 'code' in error ? String((error as { code?: unknown }).code || '') : '';
    const message = 'message' in error ? String((error as { message?: unknown }).message || '') : '';
    return RETRYABLE_CODES.has(code)
        || message.includes('Connection terminated unexpectedly')
        || message.includes('ETIMEDOUT')
        || message.includes('ECONNRESET')
        || message.includes('timeout expired');
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const queryWithRetry = async (text: string, params?: any[], retries = 1) => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await pool.query(text, params);
        } catch (error) {
            lastError = error;
            if (attempt === retries || !isRetryableError(error)) {
                throw error;
            }
            console.error(`[db] retrying query after transient error (attempt ${attempt + 1}/${retries + 1})`, {
                code: (error as { code?: unknown }).code,
                message: (error as { message?: unknown }).message
            });
            await sleep(150 * (attempt + 1));
        }
    }

    throw lastError;
};

export const db = {
    query: (text: string, params?: any[]) => pool.query(text, params),
    queryWithRetry,
    getClient: () => pool.connect(),
};
