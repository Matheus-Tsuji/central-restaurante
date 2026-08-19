import React, { useState, useEffect } from 'react';
import type { DailyReport, InventoryItem } from '../types';
import { api } from '../services/api';
import { socket } from '../services/socket';
import { TrendingUp, DollarSign, Package, AlertTriangle, Calendar, Award, RefreshCw, Printer, X } from 'lucide-react';

export const ReportsStockScreen: React.FC = () => {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [receiptText, setReceiptText] = useState<string | null>(null);

  useEffect(() => {
    loadData();

    if (socket) {
      socket.on('payment:processed', () => {
        loadData();
      });
      socket.on('order:created', () => {
        loadData();
      });
    }

    return () => {
      if (socket) {
        socket.off('payment:processed');
        socket.off('order:created');
      }
    };
  }, []);

  async function loadData() {
    setRefreshing(true);
    try {
      const [rData, iData] = await Promise.all([api.getDailyReport(), api.getInventory()]);
      setReport(rData);
      setInventory(iData);
    } catch (err) {
      console.error('Erro ao carregar relatórios e estoque:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleReprintReceipt(orderId: string) {
    try {
      const res = await api.reprintReceipt(orderId);
      if (res.receipt_text) {
        setReceiptText(res.receipt_text);
      }
    } catch (err: any) {
      alert(`Erro ao carregar cupom para reimpressão: ${err.message}`);
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Carregando dados financeiros e estoque...</div>;
  }

  const lowStockCount = inventory.filter(i => i.quantity <= i.min_quantity).length;

  return (
    <div style={{ padding: '16px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Modal de Reimpressão Térmica do Cupom .TXT */}
      {receiptText && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            width: '460px',
            maxWidth: '92%',
            padding: '20px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={20} color="var(--accent-blue)" />
                <h3 style={{ fontSize: '1.1rem' }}>Reimpressão de Cupom</h3>
              </div>
              <button onClick={() => setReceiptText(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="var(--text-muted)" />
              </button>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>
              📄 Reemitido a partir do banco de dados em formato .TXT
            </p>

            <pre style={{
              background: '#1E293B',
              color: '#F8FAFC',
              padding: '14px',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              maxHeight: '340px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.4'
            }}>
              {receiptText}
            </pre>

            <button onClick={() => setReceiptText(null)} className="btn btn-primary" style={{ width: '100%' }}>
              Fechar Cupom
            </button>
          </div>
        </div>
      )}

      {/* Seção 1: Dashboard de Vendas do Dia */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h1 style={{ fontSize: '1.3rem' }}>Relatório Financeiro do Dia</h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Consolidado de vendas por forma de pagamento e histórico de comandas
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={loadData} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              <RefreshCw size={14} className={refreshing ? 'spin' : ''} /> Atualizar Relatório
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              <Calendar size={15} /> Data: {report?.date || new Date().toISOString().split('T')[0]}
            </div>
          </div>
        </div>

        {/* Metric Cards Responsivos no Celular */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
          
          <div className="clean-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', background: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={22} />
            </div>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Faturamento Total</span>
              <h2 style={{ fontSize: '1.35rem', color: 'var(--text-primary)' }}>
                R$ {report?.total_sales.toFixed(2) || '0.00'}
              </h2>
            </div>
          </div>

          <div className="clean-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', background: 'var(--accent-blue-light)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={22} />
            </div>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Pedidos Encerrados</span>
              <h2 style={{ fontSize: '1.35rem', color: 'var(--text-primary)' }}>
                {report?.total_orders_closed || 0} pedidos
              </h2>
            </div>
          </div>

          <div className="clean-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', background: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={22} />
            </div>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Saldo em Dinheiro</span>
              <h2 style={{ fontSize: '1.35rem', color: 'var(--text-primary)' }}>
                R$ {report?.by_payment_method.CASH.toFixed(2) || '0.00'}
              </h2>
            </div>
          </div>

          <div className="clean-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={22} />
            </div>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Alertas de Estoque</span>
              <h2 style={{ fontSize: '1.35rem', color: lowStockCount > 0 ? '#991B1B' : 'var(--text-primary)' }}>
                {lowStockCount} itens
              </h2>
            </div>
          </div>

        </div>
      </div>

      {/* Seção 2: Vendas por Método de Pagamento & Estoque */}
      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        
        {/* Distribuição por Pagamento */}
        <div className="clean-card" style={{ padding: '16px' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '14px' }}>Vendas por Forma de Pagamento</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
              <span>💚 PIX</span>
              <span style={{ fontWeight: 800 }}>R$ {report?.by_payment_method.PIX.toFixed(2) || '0.00'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
              <span>💳 Cartão de Crédito</span>
              <span style={{ fontWeight: 800 }}>R$ {report?.by_payment_method.CREDIT_CARD.toFixed(2) || '0.00'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
              <span>💳 Cartão de Débito</span>
              <span style={{ fontWeight: 800 }}>R$ {report?.by_payment_method.DEBIT_CARD.toFixed(2) || '0.00'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
              <span>💵 Dinheiro</span>
              <span style={{ fontWeight: 800 }}>R$ {report?.by_payment_method.CASH.toFixed(2) || '0.00'}</span>
            </div>
          </div>
        </div>

        {/* Tabela de Insumos do Estoque */}
        <div className="clean-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '1rem' }}>Nível de Insumos no Estoque</h2>
            {lowStockCount > 0 && (
              <span className="badge badge-occupied" style={{ fontSize: '0.68rem' }}>
                <AlertTriangle size={12} /> {lowStockCount} Baixos
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '220px', overflowY: 'auto' }}>
            {inventory.map(item => {
              const isLow = item.quantity <= item.min_quantity;
              const percent = Math.min(100, (item.quantity / (item.min_quantity * 3)) * 100);

              return (
                <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 10px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ fontWeight: 700 }}>{item.name}</span>
                    <span style={{ color: isLow ? '#991B1B' : 'var(--text-primary)', fontWeight: 800 }}>
                      {item.quantity} {item.unit} (mín: {item.min_quantity})
                    </span>
                  </div>

                  <div style={{ width: '100%', height: '6px', background: '#E2E8F0', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${percent}%`,
                      background: isLow ? '#EF4444' : 'var(--accent-emerald)',
                      borderRadius: '99px',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Seção 3: Histórico Detalhado por Mesa com Botão de Reimprimir Cupom */}
      <div className="clean-card" style={{ padding: '16px' }}>
        <h2 style={{ fontSize: '1.05rem', marginBottom: '12px' }}>Histórico de Comandas Fechadas por Mesa</h2>

        {!report?.table_orders_detail || report.table_orders_detail.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Nenhum pedido foi fechado na data selecionada ainda.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {report?.table_orders_detail.map((detail, idx) => (
              <div key={idx} style={{ padding: '12px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>Mesa {detail.table_number}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '10px' }}>
                      Atendido por: {detail.waiter_name} • Fechado: {detail.closed_at}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--accent-blue)' }}>
                      R$ {detail.total_amount.toFixed(2)}
                    </span>

                    {/* BOTÃO DE REIMPRESSÃO DO CUPOM FISCAL */}
                    <button
                      onClick={() => handleReprintReceipt(detail.order_id)}
                      className="btn btn-outline"
                      style={{ padding: '4px 10px', fontSize: '0.78rem', color: 'var(--accent-emerald)', borderColor: 'var(--accent-emerald)' }}
                    >
                      <Printer size={14} /> Reimprimir Cupom
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {detail.items.map((i, iIdx) => (
                    <span key={iIdx} style={{ background: 'var(--bg-subtle)', padding: '2px 8px', borderRadius: '4px' }}>
                      {i.quantity}x {i.name} (R$ {i.total_price.toFixed(2)})
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
