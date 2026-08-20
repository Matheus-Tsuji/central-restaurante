import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './config/env.js';
import { initDatabase } from './config/database.js';

const db = new Database(env.DB_PATH);

db.pragma('foreign_keys = OFF');

db.exec('DELETE FROM order_items;');
db.exec('DELETE FROM payments;');
db.exec('DELETE FROM orders;');
db.exec('DELETE FROM cashier_sessions;');
db.exec('DELETE FROM menu_item_ingredients;');
db.exec('DELETE FROM menu_items;');
db.exec('DELETE FROM inventory;');

db.exec("UPDATE tables SET status = 'FREE', updated_at = datetime('now', 'localtime');");

db.pragma('foreign_keys = ON');

// Inicializar tabelas e repopular cardápio rico e estoque expandido
initDatabase();

console.log('✅ BANCO DE DADOS ZERADO E CARDÁPIO COMPLETO REPOPULADO!');
console.log('📊 Faturamento: R$ 0.00 | Pedidos encerrados: 0 | Mesas: Todas LIVRES.');

const receiptsDir = path.join(process.cwd(), 'comprovantes_mesas');
if (fs.existsSync(receiptsDir)) {
  fs.readdirSync(receiptsDir).forEach(file => fs.unlinkSync(path.join(receiptsDir, file)));
  console.log('📄 Pasta comprovantes_mesas/ limpa com sucesso!');
}

const reportsDir = path.join(process.cwd(), 'relatorios_expediente');
if (fs.existsSync(reportsDir)) {
  fs.readdirSync(reportsDir).forEach(file => fs.unlinkSync(path.join(reportsDir, file)));
  console.log('📄 Pasta relatorios_expediente/ limpa com sucesso!');
}
