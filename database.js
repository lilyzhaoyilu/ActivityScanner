import sqlite3 from 'sqlite3';

// interface InFlightUser {
//   kook_id: number;
//   nick_name: string;
//   timestamp_start: number;
//   timestamp_last_update: number;
// }

// interface UserActivity {
//   kook_id: number;
//   nick_name: string;
//   accumulated_time: number;
//   // rewards: string
// }

export class Database {
  db // DB
  onlineUserIds // Set<string>;
  onlineUserIdToName // Map<string, string>
  timeNow; // number

  constructor(databasePath, onlineUserIdToName, timeNow) {
    this.db = new sqlite3.Database(databasePath);
    this.onlineUserIdToName = new Map(onlineUserIdToName);
    this.onlineUserIds = new Set(onlineUserIdToName.keys());
    this.timeNow = timeNow;
  }

  async run() {
    let inflightUsers = new Map();
    let userActivity = new Map();

    try {
      this.createTablesIfNotExist();
      inflightUsers = await this.getInflightUsers();
      userActivity = await this.getUserActivity(inflightUsers);
    } catch (err) {
      console.log('database run error', err);
      return;
    }

    // Handle online users
    for (const [id, nickname] of this.onlineUserIdToName) {
      this.db.run(`INSERT INTO InflightUsers (kook_id, nick_name, timestamp_start, timestamp_last_update) VALUES (${id}, '${nickname}', ${this.timeNow}, ${this.timeNow}) ON CONFLICT(kook_id) DO UPDATE SET timestamp_last_update = ${this.timeNow};`)
    }

    // Handle become-offline users
    for (const [id, inflight] of inflightUsers) {
      if (this.onlineUserIds.has(`${id}`)) {
        continue;
      }

      let duration = inflight.timestamp_last_update - inflight.timestamp_start;

      if (userActivity.has(id)) {
        const user_activity = userActivity.get(id);

        if (user_activity && user_activity.accumulated_time) {
          duration += user_activity.accumulated_time
        }
      }

      // TODO: clean this logic
      this.db.run(`INSERT INTO UserActivity (kook_id, nick_name, accumulated_time) VALUES (${id}, '${(inflightUsers.get(`${id}`)?.nick_name || '系统错误')}', ${duration}) ON CONFLICT(kook_id) DO UPDATE SET accumulated_time = ${duration}, nick_name = '${(inflightUsers.get(`${id}`)?.nick_name || '系统错误')}';`)

      this.removeUserFromInflightUsers(id);
    }

    this.db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database connection closed.');
      }
    });
  }

  createTablesIfNotExist() {
    const db = this.db;

    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS UserActivity (
          kook_id INTEGER PRIMARY KEY NOT NULL,
          nick_name TEXT NOT NULL,
          accumulated_time INTEGER NOT NULL,
          rewards TEXT
        )
      `, (err) => {
        if (err) {
          console.error('Error creating UserActivity table:', err);
        } else {
          console.log('UserActivity table created or already exists.');
        }
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS InflightUsers (
          kook_id INTEGER PRIMARY KEY NOT NULL,
          nick_name TEXT NOT NULL,
          timestamp_start INTEGER NOT NULL,
          timestamp_last_update INTEGER NOT NULL
        )
      `, (err) => {
        if (err) {
          console.error('Error creating InflightUsers table:', err);
        } else {
          console.log('InflightUsers table created or already exists.');
        }
      });
    });
  }

  async getInflightUsers() {
    const inflightUsers = new Map();
    // Wrap the database call in a promise
    await new Promise((resolve, reject) => {
      this.db.all("SELECT * from InflightUsers", (err, rows) => {
        if (err) {
          console.log(`getInflightUsers Error: `, err);
          reject(err);  // Reject the promise on error
          return;
        }
        rows.forEach(row => {
          inflightUsers.set(`${row.kook_id}`, row);
        });
        resolve();  // Resolve the promise after processing the rows
      });
    });

    return inflightUsers;
  }

  async getUserActivity(inflightUsers) {
    const kookIds = [...inflightUsers.keys()];
    const userActivity = new Map();
    await new Promise((resolve, reject) => {
      this.db.all(`SELECT * from UserActivity WHERE kook_id in (${kookIds})`, (err, rows) => {
        if (err) {
          console.log(`getUserActivity Error: ${err}`);
          reject(err);  // Reject the promise on error
          return;
        }
        rows.forEach(row => {
          userActivity.set(`${row.kook_id}`, row)
        });
        resolve();
      });
    });

    return userActivity;
  }

  removeUserFromInflightUsers(id) {
    this.db.run("DELETE FROM InflightUsers WHERE kook_id = ?", [id]);
  }
}
