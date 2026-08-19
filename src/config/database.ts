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

  // Seed Estoque Completo com Gramaturas e Unidades Reais
  const inventoryCount = (db.prepare('SELECT COUNT(*) as count FROM inventory').get() as { count: number }).count;
  if (inventoryCount === 0) {
    const insertInv = db.prepare(
      'INSERT INTO inventory (id, name, unit, quantity, min_quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?)'
    );

    // Insumos Básicos
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

    // Novos Insumos Expandidos
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

    insertInv.run(paoBrioche, 'Pão de Hambúrguer Brioche', 'un', 150, 30, 1.80);
    insertInv.run(carne180g, 'Hambúrguer Artesanal 180g', 'un', 80, 15, 8.50);
    insertInv.run(carneSmash90g, 'Hambúrguer Smash 90g (Grama)', 'g', 15000, 2000, 0.04);
    insertInv.run(queijoCheddar, 'Queijo Cheddar Fatiado', 'un', 300, 40, 0.90);
    insertInv.run(baconFatiado, 'Bacon Defumado Fatiado (Grama)', 'g', 5000, 1000, 0.06);
    insertInv.run(batataInNatura, 'Batata Porção (Grama)', 'g', 20000, 3000, 0.02);

    insertInv.run(refriCola, 'Lata Refrigerante Cola 350ml', 'un', 150, 30, 3.50);
    insertInv.run(refriGuarana, 'Lata Refrigerante Guaraná 350ml', 'un', 120, 24, 3.50);
    insertInv.run(sucoLaranja, 'Laranja in Natura (Unidade)', 'un', 200, 40, 1.00);
    insertInv.run(sorveteCreme, 'Sorvete de Creme (Grama)', 'g', 10000, 1500, 0.04);

    insertInv.run(picanhaBovina, 'Picanha Bovina (Grama)', 'g', 15000, 2500, 0.12);
    insertInv.run(filetMignon, 'Filé Mignon Bovino (Grama)', 'g', 12000, 2000, 0.10);
    insertInv.run(peitoFrango, 'Peito de Frango (Grama)', 'g', 18000, 3000, 0.03);
    insertInv.run(peixeFile, 'Filé de Peixe (Grama)', 'g', 10000, 1500, 0.07);
    insertInv.run(costelaBovina, 'Costela Bovina Desfiada (Grama)', 'g', 8000, 1000, 0.08);

    insertInv.run(limaoTahiti, 'Limão Tahiti (Unidade)', 'un', 250, 50, 0.60);
    insertInv.run(ginGarrafa, 'Gin Garrafa (Dose 50ml)', 'dose', 100, 20, 3.50);
    insertInv.run(cachacaGarrafa, 'Cachaça Artesanal (Dose 50ml)', 'dose', 100, 20, 2.50);
    insertInv.run(aperolGarrafa, 'Aperol (Dose 50ml)', 'dose', 80, 15, 4.00);
    insertInv.run(brownieBolo, 'Brownie Chocolate (Unidade)', 'un', 50, 10, 5.00);

    // Seed Cardápio Expandido (20+ Itens)
    const insertMenu = db.prepare(
      'INSERT INTO menu_items (id, name, description, price, category) VALUES (?, ?, ?, ?, ?)'
    );

    // Lanches
    insertMenu.run('m1', 'X-Burguer Especial', 'Pão brioche, artesanal 180g, duplo cheddar', 32.90, 'Lanches');
    insertMenu.run('m2', 'Smash Bacon Supreme', 'Dois smash 90g (180g total), cheddar, bacon crocante', 36.50, 'Lanches');
    insertMenu.run('m7', 'Monster Cheddar Bacon', 'Três smash 90g (270g carne), triplo cheddar, bacon', 42.00, 'Lanches');
    insertMenu.run('m8', 'Chicken Crispy Mayo', 'Sobrecoxa empanada super crocante e maionese da casa', 29.90, 'Lanches');

    // Pratos Principais
    insertMenu.run('m10', 'Picanha na Grelha 500g', 'Acompanha arroz, farofa artesanal e vinagrete', 89.90, 'Pratos Principais');
    insertMenu.run('m11', 'Parmegiana de Mignon', 'Filé mignon empanado, molho de tomate e mussarela', 58.00, 'Pratos Principais');
    insertMenu.run('m12', 'Filé de Frango Grelhado', 'Servido com legumes na manteiga e purê', 34.90, 'Pratos Principais');

    // Porções
    insertMenu.run('m3', 'Batata Rústica c/ Páprica', 'Porção 400g servida com maionese da casa', 22.00, 'Porções');
    insertMenu.run('m13', 'Anéis de Cebola Empanados 300g', 'Anéis de cebola crocantes com molho barbecue', 26.00, 'Porções');
    insertMenu.run('m14', 'Isca de Peixe c/ Molho Tártaro', 'Porção 400g de peixe empanado', 48.00, 'Porções');
    insertMenu.run('m15', 'Coxinha de Costela (6un)', 'Coxinhas recheadas com costela desfiada e catupiry', 32.00, 'Porções');

    // Bebidas
    insertMenu.run('m4', 'Refrigerante Cola 350ml', 'Lata trincando de gelada', 7.50, 'Bebidas');
    insertMenu.run('m5', 'Suco Natural Laranja 500ml', 'Suco da fruta feito na hora', 11.00, 'Bebidas');
    insertMenu.run('m16', 'Refrigerante Guaraná 350ml', 'Lata trincando de gelada', 7.50, 'Bebidas');
    insertMenu.run('m17', 'Água Mineral c/ Gás 500ml', 'Garrafa 500ml gelada', 5.00, 'Bebidas');

    // Drinks do Bar
    insertMenu.run('m19', 'Caipirinha de Limão Tradicional', 'Cachaça artesanal, limão fresquinho e açúcar', 22.00, 'Bebidas');
    insertMenu.run('m20', 'Gin Tônica Tropical', 'Gin importado, tônica e xarope de maracujá', 28.00, 'Bebidas');
    insertMenu.run('m21', 'Aperol Spritz', 'Aperol, espumante e fatia de laranja', 30.00, 'Bebidas');

    // Sobremesas
    insertMenu.run('m6', 'Petit Gâteau Chocolate', 'Acompanha sorvete de creme e calda', 24.90, 'Sobremesas');
    insertMenu.run('m23', 'Brownie c/ Sorvete de Creme', 'Brownie aquecido com bola de sorvete', 22.00, 'Sobremesas');
    insertMenu.run('m24', 'Pudim de Leite Condensado', 'Fatia generosa com calda de caramelo', 14.00, 'Sobremesas');

    // Ficha técnica (Mapeamento de Insumos para Abatimento Real no Estoque)
    const insertIng = db.prepare(
      'INSERT INTO menu_item_ingredients (id, menu_item_id, inventory_id, quantity_required) VALUES (?, ?, ?, ?)'
    );

    // m1: X-Burguer Especial (1 Pão, 1 Carne 180g, 2 Queijos)
    insertIng.run(randomUUID(), 'm1', paoBrioche, 1);
    insertIng.run(randomUUID(), 'm1', carne180g, 1);
    insertIng.run(randomUUID(), 'm1', queijoCheddar, 2);

    // m2: Smash Bacon Supreme (1 Pão, 2 Carnes Smash 90g = 180g carne, 50g bacon)
    insertIng.run(randomUUID(), 'm2', paoBrioche, 1);
    insertIng.run(randomUUID(), 'm2', carneSmash90g, 180);
    insertIng.run(randomUUID(), 'm2', queijoCheddar, 2);
    insertIng.run(randomUUID(), 'm2', baconFatiado, 50);

    // m7: Monster Cheddar Bacon (1 Pão, 3 Carnes Smash 90g = 270g carne, 80g bacon)
    insertIng.run(randomUUID(), 'm7', paoBrioche, 1);
    insertIng.run(randomUUID(), 'm7', carneSmash90g, 270);
    insertIng.run(randomUUID(), 'm7', queijoCheddar, 3);
    insertIng.run(randomUUID(), 'm7', baconFatiado, 80);

    // m10: Picanha na Grelha (500g picanha)
    insertIng.run(randomUUID(), 'm10', picanhaBovina, 500);

    // m11: Parmegiana de Mignon (300g mignon)
    insertIng.run(randomUUID(), 'm11', filetMignon, 300);

    // m12: Filé de Frango (250g frango)
    insertIng.run(randomUUID(), 'm12', peitoFrango, 250);

    // m3: Batata Rústica (400g batata)
    insertIng.run(randomUUID(), 'm3', batataInNatura, 400);

    // m14: Isca de Peixe (400g peixe)
    insertIng.run(randomUUID(), 'm14', peixeFile, 400);

    // m15: Coxinha de Costela (200g costela)
    insertIng.run(randomUUID(), 'm15', costelaBovina, 200);

    // m4 & m16: Latas
    insertIng.run(randomUUID(), 'm4', refriCola, 1);
    insertIng.run(randomUUID(), 'm16', refriGuarana, 1);

    // m5: Suco Laranja (4 laranjas)
    insertIng.run(randomUUID(), 'm5', sucoLaranja, 4);

    // Drinks
    insertIng.run(randomUUID(), 'm19', cachacaGarrafa, 1);
    insertIng.run(randomUUID(), 'm19', limaoTahiti, 1);

    insertIng.run(randomUUID(), 'm20', ginGarrafa, 1);
    insertIng.run(randomUUID(), 'm21', aperolGarrafa, 1);

    // m6 & m23: Sorvetes
    insertIng.run(randomUUID(), 'm6', sorveteCreme, 100);
    insertIng.run(randomUUID(), 'm23', brownieBolo, 1);
    insertIng.run(randomUUID(), 'm23', sorveteCreme, 100);

    console.log('✅ Cardápio e Estoque Expandidos criados com Ficha Técnica completa.');
  }
}
