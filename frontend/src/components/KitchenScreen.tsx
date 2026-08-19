import React, { useState, useEffect } from 'react';
import type { Order } from '../types';
import { api } from '../services/api';
import { socket } from '../services/socket';
import { Clock, CheckCircle2, Play, AlertCircle } from 'lucide-react';

export const KitchenScreen: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadKitchenQueue();

    // Escutar eventos Socket.IO em tempo real
    socket.on('order:created', (newOrder: Order) => {
      console.log('🍳 Novo pedido recebido via Socket.IO na Cozinha:', newOrder);
      loadKitchenQueue();
    });

    socket.on('order:status_changed', () => {
      loadKitchenQueue();
    });

    return () => {
      socket.off('order:created');
      socket.off('order:status_changed');
    };
  }, []);

  async function loadKitchenQueue() {
    try {
      const data = await api.getKitchenQueue();
      setOrders(data);
    } catch (err) {
      console.error('Erro ao carregar fila da cozinha:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateItemStatus(itemId: string, newStatus: string) {
    try {
      await api.updateKitchenItemStatus(itemId, newStatus);
      loadKitchenQueue();
    } catch (err: any) {
      alert(`Erro ao atualizar status: ${err.message}`);
    }
  }

  function getTimeElapsed(createdAt: string): string {
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (minutes < 1) return 'Agora mesmo';
    return `Há ${minutes} min`;
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem' }}>Painel da Cozinha (KDS)</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Gerenciador de comandas e tempo de preparo dos pratos em tempo real
          </p>
        </div>

        <div className="badge badge-free" style={{ padding: '8px 14px', fontSize: '0.8rem' }}>
          <Clock size={14} /> Atualização via WebSocket Ativa
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          Carregando comandas da cozinha...
        </div>
      ) : orders.length === 0 ? (
        <div className="clean-card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <CheckCircle2 size={48} color="var(--accent-emerald)" style={{ marginBottom: '12px' }} />
          <h3>Nenhum pedido pendente na cozinha!</h3>
          <p style={{ fontSize: '0.85rem' }}>Todos os pratos foram preparados e entregues.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '20px'
        }}>
          {orders.map(order => (
            <div
              key={order.id}
              className="clean-card animate-fade-in"
              style={{
                padding: '18px',
                borderLeft: '5px solid var(--accent-blue)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px'
              }}
            >
              <div>
                {/* Header do Card */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px', marginBottom: '12px' }}>
                  <div>
                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Mesa {order.table_number || order.table_id}
                    </span>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Atendido por: {order.waiter_name || 'Garçom'}
                    </div>
                  </div>

                  <span className="badge badge-pending" style={{ fontSize: '0.7rem' }}>
                    <Clock size={12} /> {getTimeElapsed(order.created_at)}
                  </span>
                </div>

                {/* Lista de Itens do Pedido */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {order.items?.map(item => {
                    let statusColor = '#94A3B8';
                    let statusBg = 'var(--bg-subtle)';

                    if (item.status === 'PREPARING') {
                      statusColor = 'var(--accent-blue)';
                      statusBg = 'var(--accent-blue-light)';
                    } else if (item.status === 'READY') {
                      statusColor = 'var(--accent-emerald)';
                      statusBg = 'var(--accent-emerald-light)';
                    }

                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          background: statusBg,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                            {item.quantity}x {item.menu_item_name || 'Prato'}
                          </span>

                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: statusColor }}>
                            {item.status === 'PENDING' ? 'PENDENTE' : item.status === 'PREPARING' ? 'EM PREPARO' : 'PRONTO'}
                          </span>
                        </div>

                        {item.notes && (
                          <div style={{ fontSize: '0.75rem', color: '#B45309', background: '#FEF3C7', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={12} /> Obs: {item.notes}
                          </div>
                        )}

                        {/* Botão Ação por Item */}
                        <div style={{ marginTop: '4px', display: 'flex', gap: '6px' }}>
                          {item.status === 'PENDING' && (
                            <button
                              onClick={() => handleUpdateItemStatus(item.id, 'PREPARING')}
                              className="btn btn-primary"
                              style={{ padding: '4px 10px', fontSize: '0.75rem', width: '100%' }}
                            >
                              <Play size={12} /> Iniciar Preparo
                            </button>
                          )}

                          {item.status === 'PREPARING' && (
                            <button
                              onClick={() => handleUpdateItemStatus(item.id, 'READY')}
                              className="btn btn-success"
                              style={{ padding: '4px 10px', fontSize: '0.75rem', width: '100%' }}
                            >
                              <CheckCircle2 size={12} /> Marcar como Pronto
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
};
