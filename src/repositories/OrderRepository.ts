import { db } from '../config/database.js';
import { Order, OrderItem, OrderStatus, OrderItemStatus, TableBillSummary } from '../models/types.js';
import { InventoryRepository } from './InventoryRepository.js';
import { MenuItemRepository } from './MenuItemRepository.js';
import { TableRepository } from './TableRepository.js';
import { randomUUID } from 'node:crypto';

export class OrderRepository {
  static findById(id: string): Order | null {
    const order = db.prepare(`
      SELECT o.*, t.number as table_number, u.name as waiter_name
      FROM orders o
      JOIN tables t ON t.id = o.table_id
      JOIN users u ON u.id = o.waiter_id
      WHERE o.id = ?
    `).get(id) as (Order & { table_number: number; waiter_name: string }) | undefined;

    if (!order) return null;

    const items = db.prepare(`
      SELECT oi.*, mi.name as menu_item_name
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE oi.order_id = ?
    `).all(order.id) as OrderItem[];

    return { ...order, items };
  }

  static findByOfflineSyncId(offlineSyncId: string): Order | null {
    const order = db.prepare('SELECT * FROM orders WHERE offline_sync_id = ?').get(offlineSyncId) as Order | undefined;
    if (!order) return null;
    return this.findById(order.id);
  }

  static findOpenOrdersByTable(tableId: string): Order[] {
    const orders = db.prepare(`
      SELECT o.*, t.number as table_number, u.name as waiter_name
      FROM orders o
      JOIN tables t ON t.id = o.table_id
      JOIN users u ON u.id = o.waiter_id
      WHERE o.table_id = ? AND o.status IN ('OPEN', 'PREPARING', 'READY', 'DELIVERED')
      ORDER BY o.created_at ASC
    `).all(tableId) as (Order & { table_number: number; waiter_name: string })[];

    const getItems = db.prepare(`
      SELECT oi.*, mi.name as menu_item_name
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE oi.order_id = ?
    `);

    return orders.map(order => ({
      ...order,
      items: getItems.all(order.id) as OrderItem[]
    }));
  }

  static findKitchenOrders(): Order[] {
    const orders = db.prepare(`
      SELECT DISTINCT o.*, t.number as table_number, u.name as waiter_name
      FROM orders o
      JOIN tables t ON t.id = o.table_id
      JOIN users u ON u.id = o.waiter_id
      JOIN order_items oi ON oi.order_id = o.id
      WHERE oi.status IN ('PENDING', 'PREPARING') AND o.status NOT IN ('CLOSED', 'CANCELLED')
      ORDER BY o.created_at ASC
    `).all() as (Order & { table_number: number; waiter_name: string })[];

    const getItems = db.prepare(`
      SELECT oi.*, mi.name as menu_item_name
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE oi.order_id = ? AND oi.status IN ('PENDING', 'PREPARING', 'READY')
    `);

    return orders.map(order => ({
      ...order,
      items: getItems.all(order.id) as OrderItem[]
    }));
  }

  static createOrder(
    orderData: { table_id: string; waiter_id: string; notes?: string; offline_sync_id?: string },
    itemsData: { menu_item_id: string; quantity: number; notes?: string }[]
  ): { order: Order | null; error?: string } {
    // 1. Idempotência para pedidos vindos do sincronismo offline do garçom
    if (orderData.offline_sync_id) {
      const existing = this.findByOfflineSyncId(orderData.offline_sync_id);
      if (existing) {
        return { order: existing };
      }
    }

    const table = TableRepository.findById(orderData.table_id);
    if (!table) {
      return { order: null, error: 'Mesa não encontrada.' };
    }

    // 2. Validar preços e estoque de cada item
    let calculatedTotal = 0;
    const preparedItems: { id: string; menu_item_id: string; quantity: number; unit_price: number; total_price: number; notes?: string }[] = [];

    for (const item of itemsData) {
      const menuItem = MenuItemRepository.findById(item.menu_item_id);
      if (!menuItem || !menuItem.active) {
        return { order: null, error: `Item do cardápio '${item.menu_item_id}' não encontrado ou inativo.` };
      }

      // Tentar abater estoque dos ingredientes
      const stockCheck = InventoryRepository.deductStockForMenuItem(item.menu_item_id, item.quantity);
      if (!stockCheck.success) {
        return { order: null, error: `Estoque insuficiente para ${menuItem.name}: ${stockCheck.missingIngredient}` };
      }

      const total_price = Number((menuItem.price * item.quantity).toFixed(2));
      calculatedTotal += total_price;

      preparedItems.push({
        id: randomUUID(),
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: menuItem.price,
        total_price,
        notes: item.notes
      });
    }

    const orderId = randomUUID();

    // 3. Executar transação de criação
    const createTransaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO orders (id, table_id, waiter_id, status, total_amount, notes, offline_sync_id)
        VALUES (?, ?, ?, 'OPEN', ?, ?, ?)
      `).run(orderId, orderData.table_id, orderData.waiter_id, calculatedTotal, orderData.notes || null, orderData.offline_sync_id || null);

      const insertItem = db.prepare(`
        INSERT INTO order_items (id, order_id, menu_item_id, quantity, unit_price, total_price, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
      `);

      for (const pi of preparedItems) {
        insertItem.run(pi.id, orderId, pi.menu_item_id, pi.quantity, pi.unit_price, pi.total_price, pi.notes || null);
      }

      // Atualizar status da mesa para Ocupada se estivesse Livre
      if (table.status === 'FREE') {
        TableRepository.updateStatus(table.id, 'OCCUPIED');
      }
    });

    createTransaction();

    const createdOrder = this.findById(orderId);
    return { order: createdOrder };
  }

  static updateOrderStatus(orderId: string, status: OrderStatus): Order | null {
    db.prepare(`
      UPDATE orders 
      SET status = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(status, orderId);

    return this.findById(orderId);
  }

  static updateOrderItemStatus(itemId: string, status: OrderItemStatus): OrderItem | null {
    db.prepare(`
      UPDATE order_items
      SET status = ?
      WHERE id = ?
    `).run(status, itemId);

    const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(itemId) as OrderItem | undefined;
    return item || null;
  }

  static getTableBill(tableId: string): TableBillSummary | null {
    const table = TableRepository.findById(tableId);
    if (!table) return null;

    const orders = this.findOpenOrdersByTable(tableId);
    let total_amount = 0;

    const itemsMap = new Map<string, { menu_item_id: string; name: string; quantity: number; unit_price: number; total_price: number }>();

    for (const order of orders) {
      if (order.status !== 'CANCELLED') {
        total_amount += order.total_amount;
        if (order.items) {
          for (const item of order.items) {
            if (item.status !== 'CANCELLED') {
              const existing = itemsMap.get(item.menu_item_id);
              if (existing) {
                existing.quantity += item.quantity;
                existing.total_price += item.total_price;
              } else {
                itemsMap.set(item.menu_item_id, {
                  menu_item_id: item.menu_item_id,
                  name: item.menu_item_name || 'Item',
                  quantity: item.quantity,
                  unit_price: item.unit_price,
                  total_price: item.total_price
                });
              }
            }
          }
        }
      }
    }

    return {
      table,
      orders,
      total_amount: Number(total_amount.toFixed(2)),
      items_summary: Array.from(itemsMap.values())
    };
  }
}
