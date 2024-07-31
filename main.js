import { GuildScan } from './guild_scan.js';
import { Database } from './database.js';
import auth from './auth.js';





const run = async () => {
  const epochTimeSeconds = Math.floor(Date.now() / 1000);
  const guildScan = new GuildScan();
  const userIdToNickname = await guildScan.run();
  const db = new Database(auth.dbPath, userIdToNickname, epochTimeSeconds);
  db.run();
}

run();