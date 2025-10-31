import dotenv from "dotenv";
dotenv.config(); // debe ser la primera línea

import pkg from "pg";
const { Pool } = pkg;

export const pool = new Pool({
  connectionString:"postgresql://postgres.pqmnyxvkwoeurrogfenh:proyectoaro@aws-1-eu-north-1.pooler.supabase.com:6543/postgres",
  ssl: {
    rejectUnauthorized: false
  }
});


export async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows;
  } finally {
    client.release();
  }
}

export async function testConnection() {
  const r = await query("SELECT 1 AS ok");
  return r[0].ok === 1;
}
