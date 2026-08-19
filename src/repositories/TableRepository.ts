import { db } from '../config/database.js';
import { Table, TableStatus } from '../models/types.js';

export class TableRepository {
  static findAll(): Table[] {
    return db.prepare('SELECT * FROM tables ORDER BY number ASC').all() as Table[];
  }

  static findById(id: string): Table | null {
    const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(id) as Table | undefined;
    return table || null;
  }

  static findByNumber(number: number): Table | null {
    const table = db.prepare('SELECT * FROM tables WHERE number = ?').get(number) as Table | undefined;
    return table || null;
  }

  static updateStatus(id: string, status: TableStatus): Table | null {
    db.prepare(`
      UPDATE tables 
      SET status = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(status, id);

    return this.findById(id);
  }

  static create(table: Omit<Table, 'created_at' | 'updated_at'>): Table {
    db.prepare(`
      INSERT INTO tables (id, number, name, status)
      VALUES (?, ?, ?, ?)
    `).run(table.id, table.number, table.name, table.status || 'FREE');

    return this.findById(table.id)!;
  }
}
