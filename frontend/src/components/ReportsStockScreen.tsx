import React, { useState, useEffect } from 'react';
import type { DailyReport, InventoryItem } from '../types';
import { api } from '../services/api';
import { socket } from '../services/socket';
import { formatDateBR, formatDateTimeBR } from '../utils/dateUtils';
import { TrendingUp, DollarSign, Package, AlertTriangle, Calendar, Award, RefreshCw, Printer, X, ShieldAlert, CheckCircle2, Lock, Flame, Utensils, Wine, Trophy, CreditCard, FileText, Download } from 'lucide-react';

export const ReportsStockScreen: React.FC = () => {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [receiptText, setReceiptText] = useState<string | null>(null);

  // Modais de Fechamento de Expediente
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState<boolean>(false);
  const [expedientResult, setExpedientResult] = useState<any | null>(null);
  const [closingExpedient, setClosingExpedient] = useState<boolean>(false);
  const [reportTxtModal, setReportTxtModal] = useState<string | null>(null);

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

  // Executa o Fechamento Definitivo do Expediente
  async function handleFinalCloseExpedient() {
    setClosingExpedient(true);
    try {
      const res = await api.closeDailyExpedient();
      setExpedientResult(res);
      setShowCloseConfirmModal(false);
      loadData();
    } catch (err: any) {
      alert(`Erro ao encerrar expediente: ${err.message}`);
    } finally {
      setClosingExpedient(false);
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Carregando dados financeiros e estoque...</div>;
  }

  const lowStockCount = inventory.filter(i => i.quantity <= i.min_quantity).length;

  return (
    <div style={{ padding: '16px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 🔴 MODAL 1: DUPLA CONFIRMAÇÃO PARA FECHAR EXPEDIENTE DO DIA */}
      {showCloseConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1300,
          backdropFilter: 'blur(5px)'
        }}>
          <div className="clean-card animate-fade-in modal-container" style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            width: '520px',
            maxWidth: '94%',
            padding: '24px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldAlert size={26} color="#DC2626" />
                <h2 style={{ fontSize: '1.2rem', color: '#991B1B' }}>Encerrar Expediente Diário</h2>
              </div>
              <button onClick={() => setShowCloseConfirmModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={22} color="var(--text-muted)" />
              </button>
            </div>

            <div style={{ background: '#FEE2E2', padding: '14px', borderRadius: 'var(--radius-sm)', color: '#991B1B', fontSize: '0.88rem', lineHeight: '1.5' }}>
              <strong>Tem certeza de que deseja encerrar o expediente de hoje ({formatDateBR(report?.date)})?</strong>
              <ul style={{ marginTop: '8px', paddingLeft: '20px', fontSize: '0.82rem' }}>
                <li>Irá calcular a rotatividade exata de alimentos e bebidas.</li>
                <li>Irá abater fisicamente no estoque o consumo em gramas e unidades dos pratos vendidos.</li>
                <li>Irá gerar o documento oficial em <code>.TXT</code> na pasta <code>relatorios_expediente/</code>.</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                onClick={() => setShowCloseConfirmModal(false)}
                className="btn btn-outline"
                style={{ flex: 1, padding: '12px', minHeight: '44px' }}
              >
                Voltar
              </button>
              <button
                onClick={handleFinalCloseExpedient}
                disabled={closingExpedient}
                className="btn"
                style={{
                  flex: 2,
                  padding: '12px',
                  background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  minHeight: '44px'
                }}
              >
                <Lock size={18} />
                {closingExpedient ? 'Encerrando...' : 'SIM, ENCERRAR EXPEDIENTE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📊 MODAL 2: ANALYTICAL EXPEDIENT CLOSING RESULT (RELATÓRIO DE ROTATIVIDADE & ESTOQUE) */}
      {expedientResult && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1350,
          backdropFilter: 'blur(5px)'
        }}>
          <div className="clean-card animate-fade-in modal-container" style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            width: '750px',
            maxWidth: '95%',
            padding: '24px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            {/* Header do Relatório Final */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={28} color="var(--accent-emerald)" />
                <div>
                  <h2 style={{ fontSize: '1.2rem', color: '#065F46' }}>Relatório Consolidado de Encerramento</h2>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Expediente encerrado com sucesso em {formatDateTimeBR(expedientResult.closed_at)}
                  </span>
                </div>
              </div>
              <button onClick={() => setExpedientResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={22} color="var(--text-muted)" />
              </button>
            </div>

            {/* Banner Informativo do Arquivo .TXT Gerado */}
            {expedientResult.report_text && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '12px', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ fontSize: '0.82rem', color: '#166534', fontWeight: 600 }}>
                  📄 Documento de relatório salvo em <code>relatorios_expediente/</code>
                </div>
                <button
                  onClick={() => setReportTxtModal(expedientResult.report_text)}
                  className="btn btn-outline"
                  style={{ padding: '6px 12px', fontSize: '0.78rem', color: '#166534', borderColor: '#166534' }}
                >
                  <FileText size={15} /> Visualizar Documento .TXT
                </button>
              </div>
            )}

            {/* Destaques das Métricas de Venda (Rankings) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
              
              {/* Prato Top */}
              <div style={{ background: 'var(--accent-emerald-light)', padding: '12px', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#065F46' }}>
                  <Utensils size={15} /> Prato Mais Vendido
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#065F46' }}>
                  {expedientResult.analytics.top_food.name}
                </div>
                <span style={{ fontSize: '0.72rem', color: '#047857' }}>
                  {expedientResult.analytics.top_food.total_qty} un (R$ {expedientResult.analytics.top_food.total_revenue.toFixed(2)})
                </span>
              </div>

              {/* Bebida Top */}
              <div style={{ background: 'var(--accent-blue-light)', padding: '12px', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#0369A1' }}>
                  <Wine size={15} /> Bebida Mais Vendida
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0369A1' }}>
                  {expedientResult.analytics.top_drink.name}
                </div>
                <span style={{ fontSize: '0.72rem', color: '#0284C7' }}>
                  {expedientResult.analytics.top_drink.total_qty} un (R$ {expedientResult.analytics.top_drink.total_revenue.toFixed(2)})
                </span>
              </div>

              {/* Mesa Top */}
              <div style={{ background: '#FEF3C7', padding: '12px', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#B45309' }}>
                  <Trophy size={15} /> Mesa Top Faturamento
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#B45309' }}>
                  {expedientResult.analytics.top_table.table_number ? `Mesa ${expedientResult.analytics.top_table.table_number}` : 'N/A'}
                </div>
                <span style={{ fontSize: '0.72rem', color: '#92400E' }}>
                  R$ {expedientResult.analytics.top_table.total_revenue.toFixed(2)}
                </span>
              </div>

              {/* Método Top */}
              <div style={{ background: '#F3E8FF', padding: '12px', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#6B21A8' }}>
                  <CreditCard size={15} /> Método Top Rendimento
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#6B21A8' }}>
                  {expedientResult.analytics.top_payment.payment_method}
                </div>
                <span style={{ fontSize: '0.72rem', color: '#7E22CE' }}>
                  R$ {expedientResult.analytics.top_payment.total_revenue.toFixed(2)}
                </span>
              </div>

            </div>

            {/* Tabela de Abatimento e Baixa Real no Estoque */}
            <div>
              <h3 style={{ fontSize: '0.92rem', marginBottom: '8px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Flame size={16} color="#DC2626" /> Rotatividade de Alimentos (Baixa no Estoque Real):
              </h3>

              {expedientResult.inventory_consumed.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Nenhum insumo consumido hoje.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto', background: 'var(--bg-subtle)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                  {expedientResult.inventory_consumed.map((inv: any) => (
                    <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-light)', fontSize: '0.82rem' }}>
                      <span style={{ fontWeight: 700 }}>{inv.name}</span>
                      <span style={{ fontWeight: 800, color: '#DC2626' }}>
                        - {inv.total_consumed} {inv.unit} retirados
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => setExpedientResult(null)} className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
              Concluir e Fechar Relatório
            </button>
          </div>
        </div>
      )}

      {/* 📄 MODAL 3: VISUALIZADOR DE DOCUMENTO .TXT DO RELATÓRIO DO EXPEDIENTE */}
      {reportTxtModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1400,
          backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            width: '680px',
            maxWidth: '94%',
            padding: '20px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={22} color="var(--accent-blue)" />
                <h3 style={{ fontSize: '1.1rem' }}>Documento Oficial do Expediente (.TXT)</h3>
              </div>
              <button onClick={() => setReportTxtModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="var(--text-muted)" />
              </button>
            </div>

            <pre style={{
              background: '#0F172A',
              color: '#38BDF8',
              padding: '16px',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'monospace',
              fontSize: '0.78rem',
              maxHeight: '400px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.45'
            }}>
              {reportTxtModal}
            </pre>

            <button onClick={() => setReportTxtModal(null)} className="btn btn-primary" style={{ width: '100%' }}>
              Fechar Visualizador TXT
            </button>
          </div>
        </div>
      )}

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
            {/* 🔴 BOTÃO VERMELHO DE ENCERRAMENTO DE EXPEDIENTE */}
            <button
              onClick={() => setShowCloseConfirmModal(true)}
              className="btn"
              style={{
                background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
                color: '#FFFFFF',
                fontWeight: 800,
                padding: '8px 14px',
                fontSize: '0.85rem',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)'
              }}
            >
              <Lock size={16} /> ENCERRAR EXPEDIENTE DO DIA
            </button>

            <button onClick={loadData} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              <RefreshCw size={14} className={refreshing ? 'spin' : ''} /> Atualizar Relatório
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              <Calendar size={15} /> Data: {formatDateBR(report?.date)}
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
                      Atendido por: {detail.waiter_name} • Fechado: {formatDateTimeBR(detail.closed_at)}
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
