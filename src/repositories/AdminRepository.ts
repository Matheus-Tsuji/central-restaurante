import { db } from '../config/database.js';
import { randomUUID } from 'node:crypto';
import { Table, MenuItem, InventoryItem } from '../models/types.js';

export interface RestaurantSettings {
  restaurant_name: string;
  cnpj: string;
  phone: string;
  address: string;
  service_tax_percent: number;
  payment_methods_allowed: string[];
}

export class AdminRepository {
  // ==========================================
  // 1. GESTÃO DE MESAS (TABLES CRUD)
  // ==========================================
  static addTable(number: number, name?: string): Table {
    const existing = db.prepare('SELECT * FROM tables WHERE number = ?').get(number);
    if (existing) {
      throw new Error(`A mesa número ${number} já existe!`);
    }

    const id = `t${number}_${randomUUID().substring(0, 4)}`;
    const tableName = name && name.trim() ? name.trim() : `Mesa ${String(number).padStart(2, '0')}`;

    db.prepare(`
      INSERT INTO tables (id, number, name, status)
      VALUES (?, ?, ?, 'FREE')
    `).run(id, number, tableName);

    return db.prepare('SELECT * FROM tables WHERE id = ?').get(id) as Table;
  }

  static updateTable(id: string, number: number, name: string): Table {
    const existingNum = db.prepare('SELECT * FROM tables WHERE number = ? AND id != ?').get(number, id);
    if (existingNum) {
      throw new Error(`O número de mesa ${number} já está em uso por outra mesa!`);
    }

    db.prepare(`
      UPDATE tables
      SET number = ?, name = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(number, name, id);

    return db.prepare('SELECT * FROM tables WHERE id = ?').get(id) as Table;
  }

  static deleteTable(id: string): void {
    const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(id) as Table | undefined;
    if (!table) {
      throw new Error('Mesa não encontrada.');
    }
    if (table.status !== 'FREE') {
      throw new Error('Não é possível remover uma mesa que está ocupada ou com pagamento pendente!');
    }

    const hasOrders = db.prepare("SELECT count(*) as count FROM orders WHERE table_id = ? AND status != 'CLOSED' AND status != 'CANCELLED'").get(id) as any;
    if (hasOrders && hasOrders.count > 0) {
      throw new Error('Não é possível excluir uma mesa que possui pedidos abertos!');
    }

    db.prepare('DELETE FROM tables WHERE id = ?').run(id);
  }

  // ==========================================
  // 2. GESTÃO DO CARDÁPIO (MENU ITEMS CRUD)
  // ==========================================
  static addMenuItem(data: { name: string; description: string; price: number; category: string }): MenuItem {
    const id = `m_${randomUUID().substring(0, 6)}`;
    db.prepare(`
      INSERT INTO menu_items (id, name, description, price, category, active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(id, data.name, data.description || '', data.price, data.category);

    return db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id) as MenuItem;
  }

  static updateMenuItem(id: string, data: { name: string; description: string; price: number; category: string; active?: boolean }): MenuItem {
    db.prepare(`
      UPDATE menu_items
      SET name = ?, description = ?, price = ?, category = ?, active = ?
      WHERE id = ?
    `).run(data.name, data.description || '', data.price, data.category, data.active !== false ? 1 : 0, id);

    return db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id) as MenuItem;
  }

  static deleteMenuItem(id: string): void {
    db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);
  }

  // ==========================================
  // 3. GESTÃO DE CATEGORIAS DO CARDÁPIO
  // ==========================================
  static getCategories(): string[] {
    const rows = db.prepare('SELECT DISTINCT category FROM menu_items ORDER BY category ASC').all() as { category: string }[];
    return rows.map(r => r.category);
  }

  // ==========================================
  // 4. GESTÃO DE ESTOQUE (INVENTORY CRUD & RESTOCK)
  // ==========================================
  static addInventoryItem(data: { name: string; unit: string; quantity: number; min_quantity: number; unit_price: number }): InventoryItem {
    const id = `inv_${randomUUID().substring(0, 6)}`;
    db.prepare(`
      INSERT INTO inventory (id, name, unit, quantity, min_quantity, unit_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.name, data.unit, data.quantity, data.min_quantity, data.unit_price);

    return db.prepare('SELECT * FROM inventory WHERE id = ?').get(id) as InventoryItem;
  }

  static updateInventoryItem(id: string, data: { name: string; unit: string; quantity: number; min_quantity: number; unit_price: number }): InventoryItem {
    db.prepare(`
      UPDATE inventory
      SET name = ?, unit = ?, quantity = ?, min_quantity = ?, unit_price = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(data.name, data.unit, data.quantity, data.min_quantity, data.unit_price, id);

    return db.prepare('SELECT * FROM inventory WHERE id = ?').get(id) as InventoryItem;
  }

  static restockItem(id: string, addedQuantity: number): InventoryItem {
    db.prepare(`
      UPDATE inventory
      SET quantity = quantity + ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(addedQuantity, id);

    return db.prepare('SELECT * FROM inventory WHERE id = ?').get(id) as InventoryItem;
  }

  static deleteInventoryItem(id: string): void {
    db.prepare('DELETE FROM inventory WHERE id = ?').run(id);
  }

  // ==========================================
  // 5. CONFIGURAÇÕES DO RESTAURANTE (SETTINGS)
  // ==========================================
  static getSettings(): RestaurantSettings {
    const rows = db.prepare('SELECT key, value FROM restaurant_settings').all() as { key: string; value: string }[];
    const settingsMap: Record<string, string> = {};
    rows.forEach(r => { settingsMap[r.key] = r.value; });

    return {
      restaurant_name: settingsMap['restaurant_name'] || 'Central Restaurante S.A.',
      cnpj: settingsMap['cnpj'] || '12.345.678/0001-90',
      phone: settingsMap['phone'] || '(11) 99999-8888',
      address: settingsMap['address'] || 'Av. Principal, 1000 - Centro - São Paulo/SP',
      service_tax_percent: Number(settingsMap['service_tax_percent'] || 10),
      payment_methods_allowed: (settingsMap['payment_methods_allowed'] || 'CASH,CREDIT_CARD,DEBIT_CARD,PIX').split(',')
    };
  }

  static updateSettings(data: Partial<RestaurantSettings>): RestaurantSettings {
    const upsert = db.prepare(`
      INSERT INTO restaurant_settings (key, value, updated_at)
      VALUES (?, ?, datetime('now', 'localtime'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);

    if (data.restaurant_name !== undefined) upsert.run('restaurant_name', data.restaurant_name);
    if (data.cnpj !== undefined) upsert.run('cnpj', data.cnpj);
    if (data.phone !== undefined) upsert.run('phone', data.phone);
    if (data.address !== undefined) upsert.run('address', data.address);
    if (data.service_tax_percent !== undefined) upsert.run('service_tax_percent', String(data.service_tax_percent));
    if (data.payment_methods_allowed !== undefined) upsert.run('payment_methods_allowed', data.payment_methods_allowed.join(','));

    return this.getSettings();
  }
}
