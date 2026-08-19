import { db } from '../config/database.js';
import { CashRegisterSession, Payment, PaymentMethod, DailyReport } from '../models/types.js';
import { TableRepository } from './TableRepository.js';
import { OrderRepository } from './OrderRepository.js';
import { InventoryRepository } from './InventoryRepository.js';
import { generateReceiptTxt } from '../utils/receiptGenerator.js';
import { randomUUID } from 'node:crypto';

export class CashierRepository {
  static getActiveSession(): CashRegisterSession | null {
    const session = db.prepare(`
      SELECT cs.*, u1.name as opened_by_name, u2.name as closed_by_name
      FROM cashier_sessions cs
      JOIN users u1 ON u1.id = cs.opened_by_id
      LEFT JOIN users u2 ON u2.id = cs.closed_by_id
      WHERE cs.status = 'OPEN'
      ORDER BY cs.opened_at DESC
      LIMIT 1
    `).get() as CashRegisterSession | undefined;

    return session || null;
  }

  static openSession(userId: string, initialBalance: number): CashRegisterSession {
    const active = this.getActiveSession();
    if (active) {
      return active;
    }

    const id = randomUUID();
    db.prepare(`
      INSERT INTO cashier_sessions (id, opened_by_id, initial_balance, status)
      VALUES (?, ?, ?, 'OPEN')
    `).run(id, userId, initialBalance);

    return this.getActiveSession()!;
  }

  static closeSession(sessionId: string, userId: string, finalBalance: number): CashRegisterSession {
    const session = this.getActiveSession();
    if (!session || session.id !== sessionId) {
      throw new Error('Sessão de caixa não encontrada ou já encerrada.');
    }

    db.prepare(`
      UPDATE cashier_sessions
      SET closed_by_id = ?, closed_at = datetime('now', 'localtime'), final_balance = ?, status = 'CLOSED'
      WHERE id = ?
    `).run(userId, finalBalance, sessionId);

    const closed = db.prepare('SELECT * FROM cashier_sessions WHERE id = ?').get(sessionId) as CashRegisterSession;
    return closed;
  }

  static processPayment(
    tableId: string,
    paymentsInput: { method: PaymentMethod; amount: number; amount_paid?: number }[],
    cashierUserId: string
  ): { payments: Payment[]; change_given: number; receipt_file: string; receipt_text: string } {
    let session = this.getActiveSession();
    if (!session) {
      // Auto-abrir caixa do dia para não travar pagamentos se o caixa não foi aberto manualmente
      session = this.openSession(cashierUserId || 'u_caixa', 0);
    }

    const tableBill = OrderRepository.getTableBill(tableId);
    if (!tableBill || tableBill.orders.length === 0) {
      throw new Error('Nenhum pedido aberto encontrado para esta mesa.');
    }

    let totalPaidInInput = 0;
    for (const p of paymentsInput) {
      totalPaidInInput += (p.amount_paid !== undefined ? p.amount_paid : p.amount);
    }

    if (totalPaidInInput < tableBill.total_amount) {
      throw new Error(`Valor total pago (R$ ${totalPaidInInput.toFixed(2)}) é inferior ao total da conta (R$ ${tableBill.total_amount.toFixed(2)}).`);
    }

    const createdPayments: Payment[] = [];
    let totalChangeGiven = 0;

    const processTransaction = db.transaction(() => {
      let remainingBill = tableBill.total_amount;

      for (const p of paymentsInput) {
        const paymentAmount = Math.min(p.amount, remainingBill);
        const amountPaid = p.amount_paid !== undefined ? p.amount_paid : p.amount;
        const change = p.method === 'CASH' && amountPaid > paymentAmount ? Number((amountPaid - paymentAmount).toFixed(2)) : 0;
        
        totalChangeGiven += change;
        remainingBill -= paymentAmount;

        const paymentId = randomUUID();
        const orderId = tableBill.orders[0]!.id;

        db.prepare(`
          INSERT INTO payments (id, table_id, order_id, cashier_session_id, payment_method, amount, amount_paid, change_given)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(paymentId, tableId, orderId, session!.id, p.method, paymentAmount, amountPaid, change);

        // Atualizar estatísticas do caixa
        if (p.method === 'CASH') {
          db.prepare('UPDATE cashier_sessions SET total_sales = total_sales + ?, total_cash = total_cash + ? WHERE id = ?').run(paymentAmount, paymentAmount, session!.id);
        } else if (p.method === 'PIX') {
          db.prepare('UPDATE cashier_sessions SET total_sales = total_sales + ?, total_pix = total_pix + ? WHERE id = ?').run(paymentAmount, paymentAmount, session!.id);
        } else {
          db.prepare('UPDATE cashier_sessions SET total_sales = total_sales + ?, total_card = total_card + ? WHERE id = ?').run(paymentAmount, paymentAmount, session!.id);
        }

        createdPayments.push({
          id: paymentId,
          table_id: tableId,
          order_id: orderId,
          cashier_session_id: session!.id,
          payment_method: p.method,
          amount: paymentAmount,
          amount_paid: amountPaid,
          change_given: change,
          created_at: new Date().toISOString()
        });
      }

      // Marcar todos os pedidos da mesa como FECHADOS (CLOSED)
      for (const order of tableBill.orders) {
        db.prepare("UPDATE orders SET status = 'CLOSED', updated_at = datetime('now', 'localtime') WHERE id = ?").run(order.id);
      }

      // Liberar a mesa (FREE)
      TableRepository.updateStatus(tableId, 'FREE');
    });

    processTransaction();

    // GERAR COMPROVANTE FISCAL EM ARQUIVO .TXT NA PASTA comprovantes_mesas/
    const receiptResult = generateReceiptTxt(tableBill, paymentsInput, totalChangeGiven, session.opened_by_name);

    return {
      payments: createdPayments,
      change_given: totalChangeGiven,
      receipt_file: receiptResult.filePath,
      receipt_text: receiptResult.receiptContent
    };
  }

  static getDailyReport(dateStr?: string): DailyReport {
    const targetDate = dateStr || new Date().toISOString().split('T')[0]!;

    const session = db.prepare(`
      SELECT cs.*, u1.name as opened_by_name, u2.name as closed_by_name
      FROM cashier_sessions cs
      JOIN users u1 ON u1.id = cs.opened_by_id
      LEFT JOIN users u2 ON u2.id = cs.closed_by_id
      WHERE date(cs.opened_at) = date(?)
      ORDER BY cs.opened_at DESC
      LIMIT 1
    `).get(targetDate) as CashRegisterSession | undefined;

    const paymentTotals = db.prepare(`
      SELECT payment_method, SUM(amount) as total
      FROM payments
      WHERE date(created_at) = date(?)
      GROUP BY payment_method
    `).all(targetDate) as { payment_method: PaymentMethod; total: number }[];

    const by_payment_method = {
      CASH: 0,
      CREDIT_CARD: 0,
      DEBIT_CARD: 0,
      PIX: 0
    };

    let total_sales = 0;
    for (const p of paymentTotals) {
      if (p.payment_method in by_payment_method) {
        by_payment_method[p.payment_method] = p.total;
        total_sales += p.total;
      }
    }

    const closedOrders = db.prepare(`
      SELECT o.id as order_id, o.total_amount, o.updated_at as closed_at, t.number as table_number, u.name as waiter_name
      FROM orders o
      JOIN tables t ON t.id = o.table_id
      JOIN users u ON u.id = o.waiter_id
      WHERE o.status = 'CLOSED' AND date(o.updated_at) = date(?)
      ORDER BY o.updated_at ASC
    `).all(targetDate) as { order_id: string; total_amount: number; closed_at: string; table_number: number; waiter_name: string }[];

    const getItemDetails = db.prepare(`
      SELECT mi.name, oi.quantity, oi.unit_price, oi.total_price
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE oi.order_id = ?
    `);

    const getPaymentDetails = db.prepare(`
      SELECT payment_method as method, amount
      FROM payments
      WHERE order_id = ?
    `);

    const table_orders_detail = closedOrders.map(order => ({
      table_number: order.table_number,
      order_id: order.order_id,
      waiter_name: order.waiter_name,
      total_amount: order.total_amount,
      closed_at: order.closed_at,
      items: getItemDetails.all(order.order_id) as { name: string; quantity: number; unit_price: number; total_price: number }[],
      payments: getPaymentDetails.all(order.order_id) as { method: PaymentMethod; amount: number }[]
    }));

    const inventory_alerts = InventoryRepository.findLowStock();

    return {
      date: targetDate,
      cashier_session: session || null,
      total_sales: Number(total_sales.toFixed(2)),
      total_orders_closed: closedOrders.length,
      by_payment_method,
      table_orders_detail,
      inventory_alerts
    };
  }
}
