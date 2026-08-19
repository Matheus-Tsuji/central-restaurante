import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './config/env.js';

const db = new Database(env.DB_PATH);

db.pragma('foreign_keys = OFF');

db.exec('DELETE FROM order_items;');
db.exec('DELETE FROM payments;');
db.exec('DELETE FROM orders;');
db.exec('DELETE FROM cashier_sessions;');

db.exec("UPDATE tables SET status = 'FREE', updated_at = datetime('now', 'localtime');");

db.exec("UPDATE inventory SET quantity = 100 WHERE id = 'inv-pao';");
db.exec("UPDATE inventory SET quantity = 50 WHERE id = 'inv-carne';");
db.exec("UPDATE inventory SET quantity = 200 WHERE id = 'inv-queijo';");
db.exec("UPDATE inventory SET quantity = 120 WHERE id = 'inv-refri';");
db.exec("UPDATE inventory SET quantity = 5000 WHERE id = 'inv-batata';");
db.exec("UPDATE inventory SET quantity = 3000 WHERE id = 'inv-sorvete';");

db.pragma('foreign_keys = ON');
console.log('✅ BANCO DE DADOS ZERADO COM SUCESSO!');
console.log('📊 Faturamento: R$ 0.00 | Pedidos encerrados: 0 | Mesas: Todas LIVRES.');

const receiptsDir = path.join(process.cwd(), 'comprovantes_mesas');
if (fs.existsSync(receiptsDir)) {
  fs.readdirSync(receiptsDir).forEach(file => fs.unlinkSync(path.join(receiptsDir, file)));
  console.log('📄 Pasta comprovantes_mesas/ limpa com sucesso!');
}
