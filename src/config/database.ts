import Database from 'better-sqlite3';
import { env } from './env.js';
import { hashPassword } from '../utils/crypto.js';
import { randomUUID } from 'node:crypto';

export const db: Database.Database = new Database(env.DB_PATH);

// Habilitar Foreign Keys e WAL mode para performance concorrente
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN', 'CASHIER', 'WAITER', 'KITCHEN')),
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      unit TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      min_quantity REAL NOT NULL DEFAULT 5,
      unit_price REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      category TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS menu_item_ingredients (
      id TEXT PRIMARY KEY,
      menu_item_id TEXT NOT NULL,
      inventory_id TEXT NOT NULL,
      quantity_required REAL NOT NULL,
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
      FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY,
      number INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'FREE' CHECK(status IN ('FREE', 'OCCUPIED', 'PAYMENT_PENDING')),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      waiter_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'PREPARING', 'READY', 'DELIVERED', 'CLOSED', 'CANCELLED')),
      total_amount REAL NOT NULL DEFAULT 0,
      notes TEXT,
      offline_sync_id TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (table_id) REFERENCES tables(id),
      FOREIGN KEY (waiter_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      menu_item_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
    );

    CREATE TABLE IF NOT EXISTS cashier_sessions (
      id TEXT PRIMARY KEY,
      opened_by_id TEXT NOT NULL,
      closed_by_id TEXT,
      opened_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      closed_at TEXT,
      initial_balance REAL NOT NULL DEFAULT 0,
      final_balance REAL,
      total_sales REAL NOT NULL DEFAULT 0,
      total_cash REAL NOT NULL DEFAULT 0,
      total_card REAL NOT NULL DEFAULT 0,
      total_pix REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'CLOSED')),
      FOREIGN KEY (opened_by_id) REFERENCES users(id),
      FOREIGN KEY (closed_by_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      cashier_session_id TEXT NOT NULL,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'PIX')),
      amount REAL NOT NULL,
      amount_paid REAL NOT NULL,
      change_given REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (table_id) REFERENCES tables(id),
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (cashier_session_id) REFERENCES cashier_sessions(id)
    );

    -- Índices para otimização de consultas
    CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_payments_session ON payments(cashier_session_id);
  `);

  seedDefaultData();
}

function seedDefaultData(): void {
  // Seed Usuários padrões se não existirem
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  if (userCount === 0) {
    const insertUser = db.prepare(
      'INSERT INTO users (id, name, username, role, password_hash) VALUES (?, ?, ?, ?, ?)'
    );

    insertUser.run('u_admin', 'Administrador Central', 'admin', 'ADMIN', hashPassword('admin123'));
    insertUser.run('u_caixa', 'Caixa Principal', 'caixa', 'CASHIER', hashPassword('caixa123'));
    insertUser.run('u_garcom', 'Garçom João', 'garcom', 'WAITER', hashPassword('garcom123'));
    insertUser.run('u_cozinha', 'Cozinha Chefe', 'cozinha', 'KITCHEN', hashPassword('cozinha123'));
    console.log('✅ Usuários iniciais cadastrados (admin, caixa, garcom, cozinha).');
  }

  // Seed Mesas (1 a 10) se não existirem
  const tableCount = (db.prepare('SELECT COUNT(*) as count FROM tables').get() as { count: number }).count;
  if (tableCount === 0) {
    const insertTable = db.prepare('INSERT INTO tables (id, number, name) VALUES (?, ?, ?)');
    for (let i = 1; i <= 10; i++) {
      insertTable.run(`t${i}`, i, `Mesa ${i}`);
    }
    console.log('✅ 10 mesas iniciais criadas.');
  }

  // Seed Estoque e Cardápio com IDs fixos m1..m6 para alinhamento total com o frontend
  const inventoryCount = (db.prepare('SELECT COUNT(*) as count FROM inventory').get() as { count: number }).count;
  if (inventoryCount === 0) {
    const insertInv = db.prepare(
      'INSERT INTO inventory (id, name, unit, quantity, min_quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const pãoId = 'inv-pao';
    const carneId = 'inv-carne';
    const queijoId = 'inv-queijo';
    const refriId = 'inv-refri';
    const batataId = 'inv-batata';
    const sorveteId = 'inv-sorvete';

    insertInv.run(pãoId, 'Pão de Hambúrguer', 'un', 100, 20, 1.5);
    insertInv.run(carneId, 'Hambúrguer 180g', 'un', 50, 10, 8.0);
    insertInv.run(queijoId, 'Fatia de Queijo Cheddar', 'un', 200, 30, 0.8);
    insertInv.run(refriId, 'Lata Refrigerante 350ml', 'un', 120, 24, 3.5);
    insertInv.run(batataId, 'Batata Porção', 'g', 5000, 1000, 0.02);
    insertInv.run(sorveteId, 'Sorvete Creme', 'g', 3000, 500, 0.05);

    // Seed Cardápio com IDs m1..m6 correspondentes ao frontend
    const insertMenu = db.prepare(
      'INSERT INTO menu_items (id, name, description, price, category) VALUES (?, ?, ?, ?, ?)'
    );

    insertMenu.run('m1', 'X-Burguer Especial', 'Pão brioche, artesanal 180g, duplo cheddar', 32.90, 'Lanches');
    insertMenu.run('m2', 'Smash Bacon Supreme', 'Dois smash 90g, queijo prato, bacon crocante', 36.50, 'Lanches');
    insertMenu.run('m3', 'Batata Rústica c/ Páprica', 'Porção 400g servida com maionese da casa', 22.00, 'Porções');
    insertMenu.run('m4', 'Refrigerante Cola 350ml', 'Lata trincando de gelada', 7.50, 'Bebidas');
    insertMenu.run('m5', 'Suco Natural Laranja 500ml', 'Suco da fruta feito na hora', 11.00, 'Bebidas');
    insertMenu.run('m6', 'Petit Gâteau Chocolate', 'Acompanha sorvete de creme e calda', 24.90, 'Sobremesas');

    // Ficha técnica dos pratos
    const insertIng = db.prepare(
      'INSERT INTO menu_item_ingredients (id, menu_item_id, inventory_id, quantity_required) VALUES (?, ?, ?, ?)'
    );
    insertIng.run(randomUUID(), 'm1', pãoId, 1);
    insertIng.run(randomUUID(), 'm1', carneId, 1);
    insertIng.run(randomUUID(), 'm1', queijoId, 2);
    
    insertIng.run(randomUUID(), 'm2', pãoId, 1);
    insertIng.run(randomUUID(), 'm2', carneId, 2);
    
    insertIng.run(randomUUID(), 'm3', batataId, 400);
    insertIng.run(randomUUID(), 'm4', refriId, 1);
    insertIng.run(randomUUID(), 'm6', sorveteId, 100);

    console.log('✅ Estoque e Cardápio m1..m6 com Ficha Técnica inicial criados.');
  }
}
