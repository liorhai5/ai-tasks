import type Database from 'better-sqlite3';

type Migration = (db: Database.Database) => void;

const migrations: Migration[] = [
  // Version 1: initial schema — handled by schema.ts CREATE IF NOT EXISTS
];

export function runMigrations(db: Database.Database): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number;
  for (let i = currentVersion; i < migrations.length; i++) {
    migrations[i](db);
    db.pragma(`user_version = ${i + 1}`);
  }
}
