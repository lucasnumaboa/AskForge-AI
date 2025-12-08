import mysql, { Pool } from 'mysql2/promise';

// Declaração global para evitar múltiplos pools em desenvolvimento
declare global {
  var mysqlPool: Pool | undefined;
}

function createPool(): Pool {
  return mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'acore',
    password: process.env.DB_PASSWORD || 'acore',
    database: process.env.DB_NAME || 'knowledge_base',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });
}

// Em desenvolvimento, reutiliza o pool para evitar "Too many connections"
const pool: Pool = global.mysqlPool || createPool();

if (process.env.NODE_ENV !== 'production') {
  global.mysqlPool = pool;
}

export default pool;

export async function query<T>(sql: string, params?: any[]): Promise<T> {
  const [rows] = await pool.execute(sql, params);
  return rows as T;
}
