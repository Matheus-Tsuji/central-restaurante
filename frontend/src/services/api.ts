import type { Table, MenuItem, Order, InventoryItem, DailyReport } from '../types';

let activeToken: string | null = null;
let isAuthenticating = false;

export function setAuthToken(token: string) {
  activeToken = token;
}

// Garante autenticação automática prévia com o backend
async function ensureAuth(role: 'ADMIN' | 'CASHIER' | 'WAITER' | 'KITCHEN' = 'ADMIN') {
  if (activeToken || isAuthenticating) return;
  isAuthenticating = true;
  try {
    const credsMap = {
      ADMIN: { username: 'admin', password: 'admin123' },
      CASHIER: { username: 'caixa', password: 'caixa123' },
      WAITER: { username: 'garcom', password: 'garcom123' },
      KITCHEN: { username: 'cozinha', password: 'cozinha123' }
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credsMap[role]),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      activeToken = data.token;
    }
  } catch {
    // Ignora erro se backend indisponível
  } finally {
    isAuthenticating = false;
  }
}

async function fetchWithTimeout(endpoint: string, options: RequestInit = {}, timeoutMs = 5000) {
  await ensureAuth();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    'Content-Type': 'application/json',
    ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
    ...options.headers
  };

  try {
    const res = await fetch(`/api${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    return await res.json();
  } catch (err: any) {
    clearTimeout(timer);
    throw err;
  }
}

export const api = {
  async getTables(): Promise<Table[]> {
    try {
      return await fetchWithTimeout('/tables');
    } catch {
      return Array.from({ length: 10 }, (_, i) => ({
        id: `t${i + 1}`,
        number: i + 1,
        name: `Mesa ${i + 1}`,
        status: 'FREE'
      }));
    }
  },

  async getMenuItems(): Promise<MenuItem[]> {
    try {
      return await fetchWithTimeout('/menu-items');
    } catch {
      return [];
    }
  },

  async createOrder(tableId: string, items: { menu_item_id: string; quantity: number; notes?: string }[], offline_sync_id?: string) {
    return await fetchWithTimeout('/orders', {
      method: 'POST',
      body: JSON.stringify({ table_id: tableId, items, offline_sync_id })
    }, 5000);
  },

  async getKitchenQueue(): Promise<Order[]> {
    try {
      return await fetchWithTimeout('/kitchen/queue');
    } catch {
      return [];
    }
  },

  async getBarQueue(): Promise<Order[]> {
    try {
      return await fetchWithTimeout('/kitchen/bar-queue');
    } catch {
      return [];
    }
  },

  async updateKitchenItemStatus(itemId: string, status: string) {
    return await fetchWithTimeout(`/kitchen/item/${itemId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }, 5000);
  },

  async updateOrderBatchStatus(orderId: string, status: string, filterType?: 'FOOD' | 'DRINK' | 'BAR') {
    return await fetchWithTimeout(`/kitchen/order/${orderId}/batch-status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, filterType })
    }, 5000);
  },

  async deleteOrderItem(itemId: string) {
    return await fetchWithTimeout(`/orders/item/${itemId}`, {
      method: 'DELETE'
    }, 5000);
  },

  async updateOrderItemQuantity(itemId: string, quantity: number) {
    return await fetchWithTimeout(`/orders/item/${itemId}/quantity`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity })
    }, 5000);
  },

  async getTableBill(tableId: string) {
    return await fetchWithTimeout(`/orders/table/${tableId}/bill`);
  },

  async processPayment(tableId: string, payments: { method: string; amount: number; amount_paid?: number }[]) {
    return await fetchWithTimeout('/cashier/payment', {
      method: 'POST',
      body: JSON.stringify({ table_id: tableId, payments })
    }, 5000);
  },

  async reprintReceipt(orderId: string): Promise<{ receipt_text: string }> {
    return await fetchWithTimeout(`/cashier/receipt/order/${orderId}`);
  },

  async getDailyReport(): Promise<DailyReport> {
    try {
      return await fetchWithTimeout('/cashier/report');
    } catch (err) {
      console.warn('Erro ao obter relatório real do backend, usando valores zerados padrão:', err);
      return {
        date: new Date().toISOString().split('T')[0]!,
        cashier_session: null,
        total_sales: 0,
        total_orders_closed: 0,
        by_payment_method: {
          CASH: 0,
          CREDIT_CARD: 0,
          DEBIT_CARD: 0,
          PIX: 0
        },
        table_orders_detail: [],
        inventory_alerts: []
      };
    }
  },

  async closeDailyExpedient(): Promise<any> {
    return await fetchWithTimeout('/cashier/close-expedient', {
      method: 'POST'
    }, 8000);
  },

  async getInventory(): Promise<InventoryItem[]> {
    try {
      return await fetchWithTimeout('/inventory');
    } catch {
      return [];
    }
  }
};
