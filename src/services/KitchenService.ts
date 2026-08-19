import { OrderRepository } from '../repositories/OrderRepository.js';
import { Order, OrderItemStatus } from '../models/types.js';
import { notifyOrderStatusChanged } from '../sockets/socketManager.js';

export class KitchenService {
  static listKitchenQueue(): Order[] {
    return OrderRepository.findKitchenOrders();
  }

  static updateItemStatus(itemId: string, status: OrderItemStatus): Order {
    const updatedItem = OrderRepository.updateOrderItemStatus(itemId, status);
    if (!updatedItem) {
      throw new Error('Item do pedido não encontrado.');
    }

    const order = OrderRepository.findById(updatedItem.order_id);
    if (!order) {
      throw new Error('Pedido correspondente não encontrado.');
    }

    // Verificar se todos os itens do pedido já estão PRONTOS
    if (order.items && order.items.length > 0) {
      const allReady = order.items.every(i => i.status === 'READY' || i.status === 'DELIVERED' || i.status === 'CANCELLED');
      const anyPreparing = order.items.some(i => i.status === 'PREPARING');

      if (allReady) {
        OrderRepository.updateOrderStatus(order.id, 'READY');
      } else if (anyPreparing) {
        OrderRepository.updateOrderStatus(order.id, 'PREPARING');
      }
    }

    const updatedOrder = OrderRepository.findById(order.id)!;
    notifyOrderStatusChanged(updatedOrder);

    return updatedOrder;
  }
}
