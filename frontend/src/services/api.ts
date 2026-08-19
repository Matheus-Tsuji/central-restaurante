import type { Table, MenuItem, Order, InventoryItem, CashSession, DailyReport } from '../types';

let activeToken: string | null = null;
let isAuthenticating = false;

// Mock Fallback Instantâneo para renderização rápida se o servidor não estiver respondendo em 1s
const MOCK_TABLES: Table[] = [
  { id: 't1', number: 1, name: 'Mesa 1', status: 'OCCUPIED' },
  { id: 't2', number: 2, name: 'Mesa 2', status: 'FREE' },
  { id: 't3', number: 3, name: 'Mesa 3', status: 'PAYMENT_PENDING' },
  { id: 't4', number: 4, name: 'Mesa 4', status: 'FREE' },
  { id: 't5', number: 5, name: 'Mesa 5', status: 'OCCUPIED' },
  { id: 't6', number: 6, name: 'Mesa 6', status: 'FREE' },
  { id: 't7', number: 7, name: 'Mesa 7', status: 'FREE' },
  { id: 't8', number: 8, name: 'Mesa 8', status: 'FREE' },
  { id: 't9', number: 9, name: 'Mesa 9', status: 'FREE' },
  { id: 't10', number: 10, name: 'Mesa 10', status: 'FREE' }
];

const MOCK_MENU_ITEMS: MenuItem[] = [
  { id: 'm1', name: 'X-Burguer Especial', description: 'Pão brioche, artesanal 180g, duplo cheddar', price: 32.90, category: 'Lanches', active: true },
  { id: 'm2', name: 'Smash Bacon Supreme', description: 'Dois smash 90g, queijo prato, bacon crocante', price: 36.50, category: 'Lanches', active: true },
  { id: 'm3', name: 'Batata Rústica c/ Páprica', description: 'Porção 400g servida com maionese da casa', price: 22.00, category: 'Porções', active: true },
  { id: 'm4', name: 'Refrigerante Cola 350ml', description: 'Lata trincando de gelada', price: 7.50, category: 'Bebidas', active: true },
  { id: 'm5', name: 'Suco Natural Laranja 500ml', description: 'Suco da fruta feito na hora', price: 11.00, category: 'Bebidas', active: true },
  { id: 'm6', name: 'Petit Gâteau Chocolate', description: 'Acompanha sorvete de creme e calda', price: 24.90, category: 'Sobremesas', active: true }
];

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
    const timer = setTimeout(() => controller.abort(), 1200);

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
    // Se o backend não responder em 1.2s, ignora silenciosamente para usar os mocks
  } finally {
    isAuthenticating = false;
  }
}

async function fetchWithTimeout(endpoint: string, options: RequestInit = {}, timeoutMs = 1500) {
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
      return MOCK_TABLES;
    }
  },

  async getMenuItems(): Promise<MenuItem[]> {
    try {
      return await fetchWithTimeout('/menu-items');
    } catch {
      return MOCK_MENU_ITEMS;
    }
  },

  async createOrder(tableId: string, items: { menu_item_id: string; quantity: number; notes?: string }[], offline_sync_id?: string) {
    return await fetchWithTimeout('/orders', {
      method: 'POST',
      body: JSON.stringify({ table_id: tableId, items, offline_sync_id })
    }, 3000);
  },

  async getKitchenQueue(): Promise<Order[]> {
    try {
      return await fetchWithTimeout('/kitchen/queue');
    } catch {
      return [
        {
          id: 'ord-101',
          table_id: 't1',
          table_number: 1,
          waiter_id: 'w1',
          waiter_name: 'Garçom João',
          status: 'PREPARING',
          total_amount: 72.80,
          created_at: new Date(Date.now() - 12 * 60000).toISOString(),
          items: [
            { id: 'oi-1', order_id: 'ord-101', menu_item_id: 'm1', menu_item_name: 'X-Burguer Especial', quantity: 2, unit_price: 32.90, total_price: 65.80, notes: 'Um sem cebola', status: 'PREPARING' },
            { id: 'oi-2', order_id: 'ord-101', menu_item_id: 'm4', menu_item_name: 'Refrigerante Cola 350ml', quantity: 1, unit_price: 7.00, total_price: 7.00, status: 'READY' }
          ]
        },
        {
          id: 'ord-102',
          table_id: 't5',
          table_number: 5,
          waiter_id: 'w1',
          waiter_name: 'Garçom João',
          status: 'OPEN',
          total_amount: 58.50,
          created_at: new Date(Date.now() - 4 * 60000).toISOString(),
          items: [
            { id: 'oi-3', order_id: 'ord-102', menu_item_id: 'm2', menu_item_name: 'Smash Bacon Supreme', quantity: 1, unit_price: 36.50, total_price: 36.50, status: 'PENDING' },
            { id: 'oi-4', order_id: 'ord-102', menu_item_id: 'm3', menu_item_name: 'Batata Rústica c/ Páprica', quantity: 1, unit_price: 22.00, total_price: 22.00, status: 'PENDING' }
          ]
        }
      ];
    }
  },

  async updateKitchenItemStatus(itemId: string, status: string) {
    return await fetchWithTimeout(`/kitchen/item/${itemId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }, 3000);
  },

  async getTableBill(tableId: string) {
    try {
      return await fetchWithTimeout(`/orders/table/${tableId}/bill`);
    } catch {
      return {
        table: { id: tableId, number: 1, name: 'Mesa 1', status: 'OCCUPIED' },
        total_amount: 97.70,
        orders: [],
        items_summary: [
          { menu_item_id: 'm1', name: 'X-Burguer Especial', quantity: 2, unit_price: 32.90, total_price: 65.80 },
          { menu_item_id: 'm4', name: 'Refrigerante Cola 350ml', quantity: 1, unit_price: 7.00, total_price: 7.00 },
          { menu_item_id: 'm6', name: 'Petit Gâteau Chocolate', quantity: 1, unit_price: 24.90, total_price: 24.90 }
        ]
      };
    }
  },

  async processPayment(tableId: string, payments: { method: string; amount: number; amount_paid?: number }[]) {
    return await fetchWithTimeout('/cashier/payment', {
      method: 'POST',
      body: JSON.stringify({ table_id: tableId, payments })
    }, 3000);
  },

  async getDailyReport(): Promise<DailyReport> {
    try {
      return await fetchWithTimeout('/cashier/report');
    } catch {
      return {
        date: new Date().toISOString().split('T')[0]!,
        cashier_session: {
          id: 'cs-1',
          opened_at: new Date().toISOString(),
          initial_balance: 150.00,
          total_sales: 1450.90,
          total_cash: 320.00,
          total_card: 850.90,
          total_pix: 280.00,
          status: 'OPEN'
        },
        total_sales: 1450.90,
        total_orders_closed: 18,
        by_payment_method: {
          CASH: 320.00,
          CREDIT_CARD: 520.00,
          DEBIT_CARD: 330.90,
          PIX: 280.00
        },
        table_orders_detail: [
          {
            table_number: 2,
            order_id: 'ord-89',
            waiter_name: 'Garçom João',
            total_amount: 145.80,
            closed_at: '14:32',
            items: [
              { name: 'X-Burguer Especial', quantity: 3, unit_price: 32.90, total_price: 98.70 },
              { name: 'Refrigerante Cola 350ml', quantity: 3, unit_price: 7.50, total_price: 22.50 }
            ],
            payments: [{ method: 'PIX', amount: 145.80 }]
          }
        ],
        inventory_alerts: [
          { id: 'inv-2', name: 'Hambúrguer 180g', unit: 'un', quantity: 8, min_quantity: 10, unit_price: 8.0 }
        ]
      };
    }
  },

  async getInventory(): Promise<InventoryItem[]> {
    try {
      return await fetchWithTimeout('/inventory');
    } catch {
      return [
        { id: 'inv-1', name: 'Pão de Hambúrguer', unit: 'un', quantity: 85, min_quantity: 20, unit_price: 1.5 },
        { id: 'inv-2', name: 'Hambúrguer 180g', unit: 'un', quantity: 8, min_quantity: 10, unit_price: 8.0 },
        { id: 'inv-3', name: 'Fatia de Queijo Cheddar', unit: 'un', quantity: 140, min_quantity: 30, unit_price: 0.8 },
        { id: 'inv-4', name: 'Lata Refrigerante 350ml', unit: 'un', quantity: 95, min_quantity: 24, unit_price: 3.5 }
      ];
    }
  }
};
