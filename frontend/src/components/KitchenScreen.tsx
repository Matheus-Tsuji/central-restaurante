import React, { useState, useEffect } from 'react';
import type { Order } from '../types';
import { api } from '../services/api';
import { socket } from '../services/socket';
import { Clock, CheckCircle2, Play, AlertCircle, ChefHat, GlassWater } from 'lucide-react';

interface KitchenScreenProps {
  type?: 'FOOD' | 'BAR';
}

export const KitchenScreen: React.FC<KitchenScreenProps> = ({ type = 'FOOD' }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const isBar = type === 'BAR';

  useEffect(() => {
    loadQueue();

    if (socket) {
      socket.on('order:created', () => {
        loadQueue();
      });

      socket.on('order:status_changed', () => {
        loadQueue();
      });
    }

    return () => {
      if (socket) {
        socket.off('order:created');
        socket.off('order:status_changed');
      }
    };
  }, [type]);

  async function loadQueue() {
    try {
      const data = isBar ? await api.getBarQueue() : await api.getKitchenQueue();
      setOrders(data);
    } catch (err) {
      console.error(`Erro ao carregar fila (${type}):`, err);
    } finally {
      setLoading(false);
    }
  }

  async function handleBatchUpdateStatus(orderId: string, newStatus: 'PREPARING' | 'READY') {
    try {
      await api.updateOrderBatchStatus(orderId, newStatus, type);
      loadQueue();
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isBar ? <GlassWater size={28} color="#0284C7" /> : <ChefHat size={28} color="var(--accent-emerald)" />}
            <h1 className="kds-tv-title" style={{ fontSize: '1.4rem' }}>
              {isBar ? 'Painel do Bar (Bebidas)' : 'Painel da Cozinha (KDS Pratos)'}
            </h1>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isBar
              ? 'Gerenciamento exclusivo de drinks, sucos e bebidas em tempo real'
              : 'Gerenciamento exclusivo de lanches, porções e pratos em tempo real'}
          </p>
        </div>

        <div className="badge badge-free" style={{ padding: '8px 14px', fontSize: '0.8rem' }}>
          <Clock size={14} /> Atualização em Tempo Real Ativa
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          Carregando comandas de {isBar ? 'bebidas' : 'pratos'}...
        </div>
      ) : orders.length === 0 ? (
        <div className="clean-card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <CheckCircle2 size={48} color="var(--accent-emerald)" style={{ marginBottom: '12px' }} />
          <h3>Nenhum pedido pendente no {isBar ? 'Bar' : 'KDS da Cozinha'}!</h3>
          <p style={{ fontSize: '0.85rem' }}>
            {isBar ? 'Todas as bebidas foram preparadas.' : 'Todos os pratos foram preparados e entregues.'}
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '20px'
        }}>
          {orders.map(order => {
            const anyPending = order.items?.some(i => i.status === 'PENDING');
            const isPreparing = !anyPending && order.items?.some(i => i.status === 'PREPARING');

            return (
              <div
                key={order.id}
                className="clean-card animate-fade-in"
                style={{
                  padding: '18px',
                  borderLeft: `6px solid ${isBar ? '#0284C7' : 'var(--accent-emerald)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px'
                }}
              >
                <div>
                  {/* Header do Card com Alta Visibilidade em TVs */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px', marginBottom: '12px' }}>
                    <div>
                      <span className="kds-tv-card-header" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Mesa {order.table_number || order.table_id}
                      </span>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Atendido por: {order.waiter_name || 'Garçom'}
                      </div>
                    </div>

                    <span className="badge badge-pending" style={{ fontSize: '0.78rem', padding: '6px 10px' }}>
                      <Clock size={14} /> {getTimeElapsed(order.created_at)}
                    </span>
                  </div>

                  {/* Lista de Itens do Pedido */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {order.items?.map(item => (
                      <div
                        key={item.id}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          background: item.status === 'PREPARING' ? (isBar ? '#E0F2FE' : 'var(--accent-emerald-light)') : 'var(--bg-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '1rem' }}>
                            {item.quantity}x {item.menu_item_name || 'Item'}
                          </span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: item.status === 'PREPARING' ? 'var(--accent-blue)' : 'var(--text-secondary)' }}>
                            {item.status === 'PENDING' ? 'PENDENTE' : item.status === 'PREPARING' ? 'EM PREPARO' : 'PRONTO'}
                          </span>
                        </div>

                        {item.notes && (
                          <div style={{ fontSize: '0.8rem', color: '#B45309', background: '#FEF3C7', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                            <AlertCircle size={14} /> Obs: {item.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* BOTÃO ÚNICO PARA TODA A MESA DE ALTA VISIBILIDADE */}
                <div>
                  {anyPending ? (
                    <button
                      onClick={() => handleBatchUpdateStatus(order.id, 'PREPARING')}
                      className="btn btn-primary kds-tv-btn"
                      style={{ width: '100%', padding: '14px', fontSize: '1rem', background: isBar ? '#0284C7' : undefined }}
                    >
                      <Play size={18} />
                      {isBar ? '🍸 Iniciar Preparo das Bebidas' : '👨‍🍳 Iniciar Preparo dos Pratos'}
                    </button>
                  ) : isPreparing ? (
                    <button
                      onClick={() => handleBatchUpdateStatus(order.id, 'READY')}
                      className="btn btn-success kds-tv-btn"
                      style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
                    >
                      <CheckCircle2 size={18} />
                      {isBar ? '✅ Marcar Bebidas Prontas' : '✅ Marcar Pratos Prontos'}
                    </button>
                  ) : (
                    <div style={{ textTransform: 'uppercase', textAlign: 'center', fontWeight: 800, color: 'var(--accent-emerald)', fontSize: '0.95rem', padding: '10px' }}>
                      ✅ Pedido Pronto
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
