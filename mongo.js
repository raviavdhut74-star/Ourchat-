import { MongoClient } from 'mongodb';
import { config } from '../config.js';

let client;
let db;

/** Collections used for chat data:
 *  messages  { _id, chatId, from, to, type, text, url, fileName, replyTo, pinned, edited, reactions{uid:emoji}, openedBy[], createdAt }
 *  calls     { _id, from, to, video, status, createdAt, answeredAt, endedAt }
 *  presence  { _id: userId, lastSeen, lastRead{ chatId: Date } }
 */
export const col = {};

export async function initMongo() {
  client = new MongoClient(config.mongoUrl);
  await client.connect();
  db = client.db(config.mongoDb);
  col.messages = db.collection('messages');
  col.calls = db.collection('calls');
  col.presence = db.collection('presence');
  await col.messages.createIndex({ chatId: 1, createdAt: 1 });
  await col.messages.createIndex({ to: 1, createdAt: -1 });
  await col.messages.createIndex({ from: 1, createdAt: -1 });
  await col.calls.createIndex({ from: 1, createdAt: -1 });
  await col.calls.createIndex({ to: 1, createdAt: -1 });
  return db;
}

export async function closeMongo() {
  if (client) await client.close();
}
