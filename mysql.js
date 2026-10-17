import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { config } from '../config.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export const pool = mysql.createPool({
  ...config.mysql,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  timezone: 'Z',
});

// every connection works in UTC so DATETIME values are consistent
pool.pool.on('connection', (c) => c.query("SET time_zone = '+00:00'"));

/** Run a query. `?` placeholders; arrays expand inside IN (?). Returns rows (or the OK packet for writes). */
export async function q(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}
export async function one(sql, params = []) {
  const rows = await q(sql, params);
  return rows[0] || null;
}

/** Create the database (if missing) and all tables. */
export async function initMysql() {
  const { database, ...rest } = config.mysql;
  const boot = await mysql.createConnection({ ...rest, multipleStatements: false });
  await boot.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await boot.end();

  const sql = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');
  const statements = sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const s of statements) await pool.query(s);
}
