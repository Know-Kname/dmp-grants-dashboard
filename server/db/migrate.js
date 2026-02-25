import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    // 1. Run base schema
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, 'schema.sql'),
      'utf8'
    );
    await pool.query(schemaSQL);
    console.log('[migrate] Base schema applied.');

    // 2. Run optimization migration (indexes, triggers, search vectors)
    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort(); // Run in order (001_, 002_, etc.)

      for (const file of files) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        console.log(`[migrate] Running ${file}...`);
        await pool.query(sql);
        console.log(`[migrate] ${file} applied.`);
      }
    }

    // 3. Create default admin user (password: admin123)
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);

    await pool.query(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO NOTHING
    `, ['admin@dmp.com', hashedPassword, 'Admin User', 'admin']);

    console.log('[migrate] Default admin user ensured (admin@dmp.com).');
    console.log('[migrate] All migrations completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('[migrate] Migration error:', error);
    process.exit(1);
  }
}

runMigration();
