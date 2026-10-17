// npm run db:init  -> creates the MySQL database + tables and the MongoDB indexes
import { initMysql, pool } from './mysql.js';
import { initMongo, closeMongo } from './mongo.js';

await initMysql();
await initMongo();
console.log('✅ MySQL tables and MongoDB indexes are ready');
await pool.end();
await closeMongo();
