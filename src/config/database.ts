import Database, { type Database as SqliteDatabase } from 'better-sqlite3';
import { env } from './env.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';
import path from 'node:path';
import fs from 'node:fs';

const dbDir = path.dirname(env.DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db: SqliteDatabase = new Database(env.DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      min_quantity REAL NOT NULL DEFAULT 0,
      unit_price REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
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
      cashier_session_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (table_id) REFERENCES tables(id),
      FOREIGN KEY (waiter_id) REFERENCES users(id),
      FOREIGN KEY (cashier_session_id) REFERENCES cashier_sessions(id)
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

    CREATE TABLE IF NOT EXISTS restaurant_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_payments_session ON payments(cashier_session_id);
  `);

  try {
    const tableInfo = db.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
    const hasCashierSessionId = tableInfo.some(col => col.name === 'cashier_session_id');
    if (!hasCashierSessionId) {
      db.exec("ALTER TABLE orders ADD COLUMN cashier_session_id TEXT;");
    }
    db.exec("CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(cashier_session_id);");
  } catch (migErr) {
    console.warn('Aviso na verificação de colunas da tabela orders:', migErr);
  }

  seedDefaultData();
  normalizeInventoryNames();
}

function seedDefaultData(): void {
  // ---------------------------------------------------------------- Usuários
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;

  if (userCount === 0) {
    const insertUser = db.prepare(
      'INSERT INTO users (id, name, username, role, password_hash) VALUES (?, ?, ?, ?, ?)'
    );
    insertUser.run('u_admin', 'Administrador Central', 'admin', 'ADMIN', hashPassword('123456'));
    insertUser.run('u_caixa', 'Caixa Principal', 'caixa', 'CASHIER', hashPassword('caixa123'));
    insertUser.run('u_garcom', 'Garçom João', 'garcom', 'WAITER', hashPassword('garcom123'));
    insertUser.run('u_cozinha', 'Cozinha Chefe', 'cozinha', 'KITCHEN', hashPassword('cozinha123'));
    console.log('✅ Usuários iniciais cadastrados (admin, caixa, garcom, cozinha).');
  } else {
    const existingAdmin = db.prepare("SELECT * FROM users WHERE username = 'admin' OR role = 'ADMIN'").get() as any;
    if (existingAdmin && verifyPassword('admin123', existingAdmin.password_hash)) {
      const newHash = hashPassword('123456');
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, existingAdmin.id);
      console.log('🔑 Senha do administrador atualizada automaticamente para: 123456');
    }
  }

  // ------------------------------------------------------------------ Mesas
  const tableCount = (db.prepare('SELECT COUNT(*) as count FROM tables').get() as { count: number }).count;
  if (tableCount === 0) {
    const insertTable = db.prepare('INSERT INTO tables (id, number, name) VALUES (?, ?, ?)');
    for (let i = 1; i <= 10; i++) {
      insertTable.run(`t${i}`, i, `Mesa ${i}`);
    }
    console.log('✅ 10 mesas iniciais criadas.');
  }

  // ---------------------------------------------------------------- Estoque
  //
  // CORREÇÃO IMPORTANTE: antes este bloco usava INSERT OR REPLACE e rodava a
  // cada inicialização do servidor. Isso reescrevia a quantidade de TODOS os
  // insumos de volta ao valor de fábrica, apagando todo o consumo e toda a
  // reposição feita pelo gerente sempre que o sistema era reiniciado.
  //
  // Agora usamos INSERT OR IGNORE: o insumo é criado apenas na primeira vez e
  // a quantidade em estoque nunca mais é sobrescrita pelo seed.
  const insertInv = db.prepare(
    'INSERT OR IGNORE INTO inventory (id, name, unit, quantity, min_quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const paoBrioche = 'inv-pao';
  const carne180g = 'inv-carne';
  const carneSmash90g = 'inv-carne-smash';
  const queijoCheddar = 'inv-queijo';
  const baconFatiado = 'inv-bacon';
  const batataInNatura = 'inv-batata';
  const refriCola = 'inv-refri-cola';
  const refriGuarana = 'inv-refri-guarana';
  const sucoLaranja = 'inv-laranja';
  const sorveteCreme = 'inv-sorvete';
  const picanhaBovina = 'inv-picanha';
  const filetMignon = 'inv-mignon';
  const peitoFrango = 'inv-frango';
  const peixeFile = 'inv-peixe';
  const costelaBovina = 'inv-costela';
  const limaoTahiti = 'inv-limao';
  const ginGarrafa = 'inv-gin';
  const cachacaGarrafa = 'inv-cachaca';
  const aperolGarrafa = 'inv-aperol';
  const brownieBolo = 'inv-brownie';

  // Nomes sem sufixo de unidade: a unidade já aparece na coluna própria.
  insertInv.run(paoBrioche, 'Pão de Hambúrguer Brioche', 'un', 150, 30, 1.80);
  insertInv.run(carne180g, 'Hambúrguer Artesanal 180g', 'un', 80, 15, 8.50);
  insertInv.run(carneSmash90g, 'Carne Smash', 'g', 15000, 2000, 0.04);
  insertInv.run(queijoCheddar, 'Queijo Cheddar Fatiado', 'un', 300, 40, 0.90);
  insertInv.run(baconFatiado, 'Bacon Defumado Fatiado', 'g', 5000, 1000, 0.06);
  insertInv.run(batataInNatura, 'Batata para Porção', 'g', 20000, 3000, 0.02);
  insertInv.run(refriCola, 'Lata Refrigerante Cola 350ml', 'un', 150, 30, 3.50);
  insertInv.run(refriGuarana, 'Lata Refrigerante Guaraná 350ml', 'un', 120, 24, 3.50);
  insertInv.run(sucoLaranja, 'Laranja in Natura', 'un', 200, 40, 1.00);
  insertInv.run(sorveteCreme, 'Sorvete de Creme', 'g', 10000, 1500, 0.04);
  insertInv.run(picanhaBovina, 'Picanha Bovina', 'g', 15000, 2500, 0.12);
  insertInv.run(filetMignon, 'Filé Mignon Bovino', 'g', 12000, 2000, 0.10);
  insertInv.run(peitoFrango, 'Peito de Frango', 'g', 18000, 3000, 0.03);
  insertInv.run(peixeFile, 'Filé de Peixe', 'g', 10000, 1500, 0.07);
  insertInv.run(costelaBovina, 'Costela Bovina Desfiada', 'g', 8000, 1000, 0.08);
  insertInv.run(limaoTahiti, 'Limão Tahiti', 'un', 250, 50, 0.60);
  insertInv.run(ginGarrafa, 'Gin', 'dose', 100, 20, 3.50);
  insertInv.run(cachacaGarrafa, 'Cachaça Artesanal', 'dose', 100, 20, 2.50);
  insertInv.run(aperolGarrafa, 'Aperol', 'dose', 80, 15, 4.00);
  insertInv.run(brownieBolo, 'Brownie de Chocolate', 'un', 50, 10, 5.00);

  // --------------------------------------------------------------- Cardápio
  // O cardápio inicial é cadastrado apenas se não houver itens ativos.
  // Usamos INSERT OR IGNORE para NUNCA mais sobrescrever alterações feitas
  // pelo usuário no painel de administração sempre que o sistema reiniciar.
  const activeMenuCount = (db.prepare('SELECT COUNT(*) as count FROM menu_items WHERE active = 1').get() as { count: number }).count;

  const DEFAULT_MENU_ITEMS = [
    // ENTRADAS
    { id: 'm_ent_1', name: 'Casquinha de Siri', price: 30.00, category: 'Entradas', description: 'Unidade' },
    { id: 'm_ent_2', name: 'Salada da Casa', price: 28.00, category: 'Entradas', description: 'Individual. Alface, Tomate Cereja, Palmito, Cenoura' },
    { id: 'm_ent_3', name: 'Pão de Alho', price: 20.00, category: 'Entradas', description: 'Unidade' },
    { id: 'm_ent_4', name: 'Polvo ao Vinagrete', price: 55.00, category: 'Entradas', description: '' },

    // PETISCOS
    { id: 'm_pet_1', name: 'Isca de Peixe', price: 89.00, category: 'Petiscos', description: '' },
    { id: 'm_pet_2', name: 'Lula à Dorê', price: 95.00, category: 'Petiscos', description: '' },
    { id: 'm_pet_3', name: 'Camarão ao Alho e Óleo', price: 145.00, category: 'Petiscos', description: '' },
    { id: 'm_pet_4', name: 'Batata Frita', price: 39.00, category: 'Petiscos', description: '' },
    { id: 'm_pet_5', name: 'Aipim Frito', price: 42.00, category: 'Petiscos', description: '' },

    // PASTÉIS
    { id: 'm_pas_1', name: 'Pastel de Camarão com Catupiry', price: 75.00, category: 'Pastéis', description: 'Porção com 6 unidades' },
    { id: 'm_pas_2', name: 'Pastel de Camarão', price: 70.00, category: 'Pastéis', description: 'Porção com 6 unidades' },
    { id: 'm_pas_3', name: 'Pastel de Siri', price: 70.00, category: 'Pastéis', description: 'Porção com 6 unidades' },
    { id: 'm_pas_4', name: 'Pastel de Carne', price: 55.00, category: 'Pastéis', description: 'Porção com 6 unidades' },
    { id: 'm_pas_5', name: 'Pastel de Queijo', price: 50.00, category: 'Pastéis', description: 'Porção com 6 unidades. Opção vegetariana' },

    // VEGETARIANO
    { id: 'm_veg_1', name: 'Queijo Coalho à Brasileira', price: 55.00, category: 'Vegetariano', description: 'Arroz, Batata Frita, Farofa, Vinagrete. Opção vegetariana' },

    // CARNES
    { id: 'm_car_1', name: 'Picanha na Chapa', price: 189.00, category: 'Carnes', description: 'Serve 2 Pessoas. Acompanha Arroz, Batata Frita, Farofa, Vinagrete' },
    { id: 'm_car_2', name: 'Contra Filé com Fritas', price: 69.00, category: 'Carnes', description: 'Individual. Acompanha Arroz, Batata Frita, Farofa, Vinagrete' },
    { id: 'm_car_3', name: 'Filé de Frango com Fritas', price: 59.00, category: 'Carnes', description: 'Individual. Acompanha Arroz, Batata Frita, Farofa, Vinagrete' },

    // FRUTOS DO MAR
    { id: 'm_fdm_1', name: 'Polvo na Brasa', price: 159.00, category: 'Frutos do Mar', description: 'Serve 2 Pessoas. Batata Frita, Arroz, Farofa, Vinagrete' },
    { id: 'm_fdm_2', name: 'Camarão no Abacaxi', price: 159.00, category: 'Frutos do Mar', description: 'Serve 2 Pessoas. Arroz, Batata Frita, Salada' },
    { id: 'm_fdm_3', name: 'Camarão ao Catupiry', price: 89.00, category: 'Frutos do Mar', description: 'Individual. Arroz, Batata Palha' },
    { id: 'm_fdm_4', name: 'Camarão Tropical', price: 85.00, category: 'Frutos do Mar', description: 'Individual. Camarões com Bacon, Purê de Banana da Terra, Arroz e Farofa' },
    { id: 'm_fdm_5', name: 'Filé de Peixe ao Molho de Camarão', price: 89.00, category: 'Frutos do Mar', description: 'Individual. Arroz, Batata Frita, Salada' },
    { id: 'm_fdm_6', name: 'Filé de Peixe ao Molho de Maracujá', price: 85.00, category: 'Frutos do Mar', description: 'Individual. Arroz, Batata Frita, Salada' },
    { id: 'm_fdm_7', name: 'Lula Recheada do Chef', price: 75.00, category: 'Frutos do Mar', description: 'Individual. Lula Recheada com Vinagrete e Parmesão, Arroz, Batata Frita, Farofa' },

    // MASSAS
    { id: 'm_mas_1', name: 'Talharim com Camarão', price: 79.00, category: 'Massas', description: 'Ao Molho Branco de Limão Siciliano' },
    { id: 'm_mas_2', name: 'Talharim com Lula', price: 69.00, category: 'Massas', description: 'Ao Molho Branco' },
    { id: 'm_mas_3', name: 'Nhoque ao Molho de Camarão', price: 79.00, category: 'Massas', description: '' },
    { id: 'm_mas_4', name: 'Nhoque ao Sugo e Manjericão', price: 55.00, category: 'Massas', description: 'Opção vegetariana' },

    // ÁGUA E REFRIGERANTE
    { id: 'm_ref_1', name: 'Água (500 ml)', price: 6.00, category: 'Água e Refrigerante', description: '' },
    { id: 'm_ref_2', name: 'Água com gás (500 ml)', price: 8.00, category: 'Água e Refrigerante', description: '' },
    { id: 'm_ref_3', name: 'Coca-Cola (Comum ou Zero) (Lata)', price: 12.00, category: 'Água e Refrigerante', description: 'Lata' },
    { id: 'm_ref_4', name: 'Guaraná (Comum ou Zero) (Lata)', price: 12.00, category: 'Água e Refrigerante', description: 'Lata' },
    { id: 'm_ref_5', name: 'Sprite (Comum ou Zero) (Lata)', price: 12.00, category: 'Água e Refrigerante', description: 'Lata' },
    { id: 'm_ref_6', name: 'Água Tônica (Lata)', price: 12.00, category: 'Água e Refrigerante', description: 'Lata' },
    { id: 'm_ref_7', name: 'Shot de Limão Espremido (30 ml)', price: 2.00, category: 'Água e Refrigerante', description: '30 ml' },

    // SUCOS NATURAIS
    { id: 'm_suc_1', name: 'Suco Natural (350 ml)', price: 18.00, category: 'Sucos Naturais', description: '350 ml. Sabores: Abacaxi, Limão, Manga, Maracujá, Morango' },

    // SODA ITALIANA
    { id: 'm_sod_1', name: 'Soda Italiana (350 ml)', price: 18.00, category: 'Soda Italiana', description: '350 ml. Drink não alcoólico, refrescante, produzido com xarope de frutas, água com gás e gelo. Sabores: Maçã Verde, Tangerina, Framboesa' },

    // CAIPIRINHA E CAIPIVODCA
    { id: 'm_cai_1', name: 'Caipirinha', price: 25.00, category: 'Caipirinha e Caipivodca', description: 'Sabores: Abacaxi, Limão, Manga, Maracujá, Morango' },
    { id: 'm_cai_2', name: 'Caipivodca', price: 30.00, category: 'Caipirinha e Caipivodca', description: 'Sabores: Abacaxi, Limão, Manga, Maracujá, Morango' },

    // CERVEJA
    { id: 'm_cer_1', name: 'Brahma (Latão 473 ml)', price: 15.00, category: 'Cerveja', description: 'Latão 473 ml' },
    { id: 'm_cer_2', name: 'Original (Latão 473 ml)', price: 18.00, category: 'Cerveja', description: 'Latão 473 ml' },
    { id: 'm_cer_3', name: 'Heineken (Latão 473 ml)', price: 18.00, category: 'Cerveja', description: 'Latão 473 ml' },
    { id: 'm_cer_4', name: 'Corona (Long Neck)', price: 20.00, category: 'Cerveja', description: 'Long Neck' },
    { id: 'm_cer_5', name: 'Praya (Long Neck)', price: 20.00, category: 'Cerveja', description: 'Long Neck' },

    // VINHO
    { id: 'm_vin_1', name: 'Vinho Meia Garrafa (375 ml)', price: 0.00, category: 'Vinho', description: 'Sob consulta. Consulte a disponibilidade' },
    { id: 'm_vin_2', name: 'Vinho Garrafa (750 ml)', price: 0.00, category: 'Vinho', description: 'Sob consulta. Consulte a disponibilidade' },

    // AÇAÍ
    { id: 'm_aca_1', name: 'Açaí Simples', price: 25.00, category: 'Açaí', description: 'Bowl de 400 ml. Açaí Batido' },
    { id: 'm_aca_2', name: 'Açaí Completo', price: 35.00, category: 'Açaí', description: 'Bowl de 400 ml. Açaí Batido + Banana + Granola + Paçoca + Leite Ninho' },

    // SOBREMESAS
    { id: 'm_sob_1', name: 'Sorvete', price: 22.00, category: 'Sobremesas', description: '2 Bolas. Sabores: Chocolate e Creme' },
    { id: 'm_sob_2', name: 'Brownie com Sorvete', price: 35.00, category: 'Sobremesas', description: 'Sorvete de Chocolate ou Creme' },
    { id: 'm_sob_3', name: 'Banana Caramelizada com Sorvete', price: 35.00, category: 'Sobremesas', description: 'Sorvete de Chocolate ou Creme' },
    { id: 'm_sob_4', name: 'Petit Gateau com Sorvete', price: 38.00, category: 'Sobremesas', description: 'Sorvete de Chocolate ou Creme' }
  ];

  if (activeMenuCount === 0) {
    const insertMenu = db.prepare(
      'INSERT OR IGNORE INTO menu_items (id, name, description, price, category, active) VALUES (?, ?, ?, ?, ?, 1)'
    );

    for (const item of DEFAULT_MENU_ITEMS) {
      insertMenu.run(item.id, item.name, item.description, item.price, item.category);
    }
    console.log(`✅ Cardápio inicial cadastrado com ${DEFAULT_MENU_ITEMS.length} itens em 14 categorias.`);
  }
}

/**
 * Remove sufixos de unidade dos nomes de insumos já gravados em bancos
 * antigos ("Bacon Defumado Fatiado (Grama)" -> "Bacon Defumado Fatiado").
 * A unidade já é exibida em coluna própria, então o sufixo só poluía a tela.
 */
function normalizeInventoryNames(): void {
  try {
    const items = db.prepare('SELECT id, name FROM inventory').all() as { id: string; name: string }[];
    const update = db.prepare('UPDATE inventory SET name = ? WHERE id = ?');
    const pattern = /\s*\((grama|gramas|g|unidade|unidades|un|dose\s*50ml|dose|ml|litro|litros|l|pacote|pct)\)\s*$/i;

    let changed = 0;
    for (const item of items) {
      const cleaned = item.name.replace(pattern, '').trim();
      if (cleaned && cleaned !== item.name) {
        update.run(cleaned, item.id);
        changed++;
      }
    }

    if (changed > 0) {
      console.log(`✅ ${changed} nome(s) de insumo padronizados.`);
    }
  } catch (err) {
    console.warn('Aviso ao padronizar nomes de insumos:', err);
  }
}
