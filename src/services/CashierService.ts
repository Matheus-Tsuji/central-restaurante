import { CashierRepository } from '../repositories/CashierRepository.js';
import { TableRepository } from '../repositories/TableRepository.js';
import { CashRegisterSession, PaymentMethod, DailyReport } from '../models/types.js';
import { notifyPaymentProcessed, notifyTableStatusChanged } from '../sockets/socketManager.js';

export class CashierService {
  static getActiveSession(): CashRegisterSession | null {
    return CashierRepository.getActiveSession();
  }

  static openSession(userId: string, initialBalance: number): CashRegisterSession {
    return CashierRepository.openSession(userId, initialBalance);
  }

  static closeSession(sessionId: string, userId: string, finalBalance: number): CashRegisterSession {
    return CashierRepository.closeSession(sessionId, userId, finalBalance);
  }

  static processTablePayment(
    tableId: string,
    cashierUserId: string,
    payments: { method: PaymentMethod; amount: number; amount_paid?: number }[]
  ): { success: boolean; change_given: number; message: string } {
    const result = CashierRepository.processPayment(tableId, payments, cashierUserId);

    const updatedTable = TableRepository.findById(tableId);
    if (updatedTable) {
      notifyTableStatusChanged(updatedTable);
    }

    notifyPaymentProcessed(result.payments);

    return {
      success: true,
      change_given: result.change_given,
      message: `Pagamento processado com sucesso. Troco a devolver: R$ ${result.change_given.toFixed(2)}.`
    };
  }

  static getDailyReport(dateStr?: string): DailyReport {
    return CashierRepository.getDailyReport(dateStr);
  }
}
