import React, { useState, useEffect } from 'react';
import type { Table } from '../types';
import { api } from '../services/api';
import { DollarSign, CreditCard, QrCode, Receipt, CheckCircle2, AlertCircle, RefreshCw, Printer, X, Plus, Minus, Trash2, Layers, Clock, ShieldCheck, Edit3 } from 'lucide-react';

type PaymentMethodType = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX';

interface SplitPaymentRow {
  id: string;
  method: PaymentMethodType;
  amount: number;
  amount_paid?: number;
}

export const CashierScreen: React.FC = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [bill, setBill] = useState<any | null>(null);
  const [closedHistory, setClosedHistory] = useState<any[]>([]);

  // Modo de visualização do extrato: 'ITEMS' (Agrupado) ou 'TIMELINE' (Por Horários)
  const [viewMode, setViewMode] = useState<'ITEMS' | 'TIMELINE'>('ITEMS');

  // Modo de pagamento: 'SINGLE' (Único) ou 'SPLIT' (Múltiplo / Fracionado)
  const [isSplitMode, setIsSplitMode] = useState<boolean>(false);

  // Pagamento único
  const [singleMethod, setSingleMethod] = useState<PaymentMethodType>('PIX');
  const [singleAmountPaid, setSingleAmountPaid] = useState<string>('');

  // Pagamentos fracionados (múltiplos)
  const [splitRows, setSplitRows] = useState<SplitPaymentRow[]>([]);

  // Modal de Confirmação & Verificação de Segurança ao Fechar
  const [showVerifyModal, setShowVerifyModal] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [receiptText, setReceiptText] = useState<string | null>(null);

  useEffect(() => {
    loadTables();
    loadClosedHistory();
  }, []);

  async function loadTables() {
    try {
      const data = await api.getTables();
      setTables(data);
    } catch (err) {
      console.error('Erro ao carregar mesas:', err);
    }
  }

  async function loadClosedHistory() {
    try {
      const rData = await api.getDailyReport();
      if (rData && rData.table_orders_detail) {
        setClosedHistory(rData.table_orders_detail);
      }
    } catch (err) {
      console.warn('Erro ao carregar histórico de fechamentos:', err);
    }
  }

  async function refreshCurrentBill(tableId: string) {
    try {
      const bData = await api.getTableBill(tableId);
      setBill(bData);
      const total = bData?.total_amount || 0;
      setSingleAmountPaid(total.toString());
      setSplitRows([{ id: '1', method: singleMethod, amount: total }]);
    } catch {
      setBill(null);
      setSplitRows([]);
    }
  }

  async function handleSelectTable(t: Table) {
    setSelectedTable(t);
    setFeedback(null);
    setIsSplitMode(false);
    setShowVerifyModal(false);
    await refreshCurrentBill(t.id);
  }

  async function handleDeleteItem(itemId: string) {
    if (!selectedTable) return;
    if (!window.confirm('Deseja realmente remover este item da comanda da mesa?')) return;

    try {
      await api.deleteOrderItem(itemId);
      await refreshCurrentBill(selectedTable.id);
      loadTables();
    } catch (err: any) {
      alert(`Erro ao remover item: ${err.message}`);
    }
  }

  async function handleUpdateQuantity(itemId: string, newQuantity: number) {
    if (!selectedTable) return;
    try {
      await api.updateOrderItemQuantity(itemId, newQuantity);
      await refreshCurrentBill(selectedTable.id);
      loadTables();
    } catch (err: any) {
      alert(`Erro ao alterar quantidade: ${err.message}`);
    }
  }

  async function handleReprintReceipt(orderId: string) {
    try {
      const res = await api.reprintReceipt(orderId);
      if (res.receipt_text) {
        setReceiptText(res.receipt_text);
      }
    } catch (err: any) {
      alert(`Erro ao reemitir cupom: ${err.message}`);
    }
  }

  const numericTotal = bill?.total_amount || 0;

  // Cálculos para pagamento ÚNICO
  const singlePaid = parseFloat(singleAmountPaid) || numericTotal;
  const singleChange = singleMethod === 'CASH' && singlePaid > numericTotal ? singlePaid - numericTotal : 0;

  // Cálculos para pagamento FRACIONADO (MÚLTIPLO)
  const totalAllocated = splitRows.reduce((acc, row) => acc + (row.amount || 0), 0);
  const remainingToAllocate = Number(Math.max(0, numericTotal - totalAllocated).toFixed(2));
  
  let totalSplitChange = 0;
  splitRows.forEach(row => {
    if (row.method === 'CASH' && row.amount_paid && row.amount_paid > row.amount) {
      totalSplitChange += (row.amount_paid - row.amount);
    }
  });

  function handleAddSplitRow() {
    const defaultAmount = remainingToAllocate > 0 ? remainingToAllocate : 0;
    setSplitRows(prev => [
      ...prev,
      { id: Date.now().toString(), method: 'CREDIT_CARD', amount: defaultAmount }
    ]);
  }

  function handleRemoveSplitRow(id: string) {
    if (splitRows.length === 1) return;
    setSplitRows(prev => prev.filter(r => r.id !== id));
  }

  function handleUpdateSplitRow(id: string, field: keyof SplitPaymentRow, value: any) {
    setSplitRows(prev =>
      prev.map(r => {
        if (r.id === id) {
          const updated = { ...r, [field]: value };
          if (field === 'method' && value !== 'CASH') {
            delete updated.amount_paid;
          }
          return updated;
        }
        return r;
      })
    );
  }

  // Processa o pagamento final após aprovação no modal
  async function handleFinalProcessPayment() {
    if (!selectedTable) return;
    setLoading(true);
    setFeedback(null);
    setShowVerifyModal(false);

    try {
      let paymentsToSend: { method: PaymentMethodType; amount: number; amount_paid?: number }[] = [];

      if (!isSplitMode) {
        paymentsToSend = [
          {
            method: singleMethod,
            amount: numericTotal,
            amount_paid: singleMethod === 'CASH' ? (singlePaid || numericTotal) : numericTotal
          }
        ];
      } else {
        if (Math.abs(totalAllocated - numericTotal) > 0.01 && totalAllocated < numericTotal) {
          throw new Error(`O total das formas de pagamento (R$ ${totalAllocated.toFixed(2)}) é inferior ao valor da conta (R$ ${numericTotal.toFixed(2)}).`);
        }

        paymentsToSend = splitRows.map(r => ({
          method: r.method,
          amount: Number(r.amount),
          amount_paid: r.method === 'CASH' ? (r.amount_paid || r.amount) : r.amount
        }));
      }

      const result = await api.processPayment(selectedTable.id, paymentsToSend);

      if (result.receipt_text) {
        setReceiptText(result.receipt_text);
      }

      const calculatedChange = isSplitMode ? totalSplitChange : singleChange;

      setFeedback({
        type: 'success',
        message: `Mesa ${selectedTable.number} encerrada com sucesso! Cupom impresso em 'comprovantes_mesas/'. Troco: R$ ${result.change_given?.toFixed(2) || calculatedChange.toFixed(2)}.`
      });

      setSelectedTable(null);
      setBill(null);
      loadTables();
      loadClosedHistory();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao processar pagamento.' });
    } finally {
      setLoading(false);
    }
  }

  const methodLabels: Record<PaymentMethodType, string> = {
    PIX: '💚 PIX',
    CASH: '💵 Dinheiro',
    CREDIT_CARD: '💳 Cartão Crédito',
    DEBIT_CARD: '💳 Cartão Débito'
  };

  return (
    <div style={{ padding: '16px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 🔍 MODAL DE CONFIRMAÇÃO & VERIFICAÇÃO DE SEGURANÇA (PARA TODAS AS FORMAS DE PAGAMENTO) */}
      {showVerifyModal && selectedTable && bill && (
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
          zIndex: 1100,
          backdropFilter: 'blur(5px)'
        }}>
          <div className="clean-card animate-fade-in modal-container" style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            width: '640px',
            maxWidth: '95vw',
            padding: '20px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            {/* Header do Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={26} color="var(--accent-emerald)" />
                <div>
                  <h2 style={{ fontSize: '1.15rem' }}>Conferência da Mesa {selectedTable.number}</h2>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Verifique os itens e horários lançados antes de concluir o pagamento
                  </span>
                </div>
              </div>
              <button onClick={() => setShowVerifyModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="var(--text-muted)" />
              </button>
            </div>

            {/* Linha do Tempo de Pedidos por Horário */}
            <div>
              <h3 style={{ fontSize: '0.88rem', marginBottom: '8px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} /> Horário dos Pedidos Lançados nesta Mesa:
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-subtle)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                {bill.orders?.map((ord: any, idx: number) => (
                  <div key={ord.id} style={{ background: '#FFFFFF', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, borderBottom: '1px solid var(--border-light)', paddingBottom: '4px', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--accent-blue)' }}>
                        🕒 Pedido #{idx + 1} às {new Date(ord.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>Garçom: {ord.waiter_name || 'Equipe'}</span>
                    </div>

                    {/* Itens deste pedido com opção de correção */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {ord.items?.map((it: any) => (
                        <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                          <div>
                            <span style={{ fontWeight: 700 }}>{it.quantity}x {it.menu_item_name}</span>
                            {it.notes && <span style={{ fontSize: '0.7rem', color: '#B45309', marginLeft: '6px' }}>(Obs: {it.notes})</span>}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 800 }}>R$ {it.total_price.toFixed(2)}</span>
                            {/* Botões para corrigir no modal */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button onClick={() => handleUpdateQuantity(it.id, it.quantity - 1)} style={{ background: 'none', border: '1px solid var(--border-light)', borderRadius: '4px', cursor: 'pointer', padding: '2px 4px' }}>
                                <Minus size={12} />
                              </button>
                              <button onClick={() => handleUpdateQuantity(it.id, it.quantity + 1)} style={{ background: 'none', border: '1px solid var(--border-light)', borderRadius: '4px', cursor: 'pointer', padding: '2px 4px' }}>
                                <Plus size={12} />
                              </button>
                              <button onClick={() => handleDeleteItem(it.id)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px 4px' }}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Resumo Final do Pagamento Selecionado */}
            <div style={{ background: 'var(--accent-emerald-light)', padding: '12px', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: '#065F46', fontWeight: 600 }}>Forma de Pagamento Selecionada:</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#065F46' }}>
                  {!isSplitMode ? methodLabels[singleMethod] : 'Dividido / Múltiplas Formas'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.78rem', color: '#065F46', fontWeight: 600 }}>Total Final:</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#065F46' }}>
                  R$ {numericTotal.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Ações do Modal */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowVerifyModal(false)}
                className="btn btn-outline"
                style={{ flex: 1, padding: '10px', minHeight: '44px' }}
              >
                <Edit3 size={16} /> Voltar e Corrigir
              </button>
              <button
                onClick={handleFinalProcessPayment}
                disabled={loading}
                className="btn btn-success"
                style={{ flex: 2, padding: '10px', fontSize: '0.95rem', minHeight: '44px' }}
              >
                <CheckCircle2 size={18} />
                {loading ? 'Encerrando...' : 'CONFIRMAR E EMITIR CUPOM'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal de Simulação de Impressão Térmica do Cupom .TXT */}
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
            maxWidth: '92vw',
            padding: '20px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={20} color="var(--accent-blue)" />
                <h3 style={{ fontSize: '1.05rem' }}>Cupom de Consumo Emitido</h3>
              </div>
              <button onClick={() => setReceiptText(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="var(--text-muted)" />
              </button>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>
              📄 Salvo em formato .TXT na pasta <code>comprovantes_mesas/</code>
            </p>

            <pre style={{
              background: '#1E293B',
              color: '#F8FAFC',
              padding: '14px',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              maxHeight: '320px',
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

      {/* Grid Principal do Caixa Otimizado para Telas Mobile */}
      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 480px', gap: '20px' }}>
        
        {/* Painel Esquerdo: Lista de Mesas para Fechamento */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Header & Status */}
          <div className="clean-card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h1 style={{ fontSize: '1.2rem' }}>Caixa Central (POS)</h1>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Selecione uma mesa ocupada para conferir o extrato e encerrar a conta
              </p>
            </div>

            <button onClick={loadTables} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
              <RefreshCw size={14} /> Atualizar Mesas
            </button>
          </div>

          {/* Grid de Mesas Responsivo para Toque no Celular */}
          <div className="clean-card" style={{ padding: '16px' }}>
            <h2 style={{ fontSize: '0.95rem', marginBottom: '14px' }}>Status das Mesas</h2>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(95px, 1fr))',
              gap: '10px'
            }}>
              {tables.map(t => {
                const isSelected = selectedTable?.id === t.id;
                let border = 'var(--border-light)';
                let bg = '#FFFFFF';

                if (t.status === 'OCCUPIED' || t.status === 'PAYMENT_PENDING') {
                  border = 'var(--status-pending)';
                  bg = 'var(--status-pending-bg)';
                }

                if (isSelected) {
                  border = 'var(--accent-blue)';
                  bg = 'var(--accent-blue-light)';
                }

                return (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTable(t)}
                    style={{
                      background: bg,
                      border: `2px solid ${border}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      minHeight: '60px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ fontSize: '1rem', fontWeight: 800 }}>Mesa {t.number}</span>
                    <span className={`badge ${t.status === 'FREE' ? 'badge-free' : t.status === 'OCCUPIED' ? 'badge-occupied' : 'badge-pending'}`} style={{ fontSize: '0.6rem', padding: '2px 6px' }}>
                      {t.status === 'FREE' ? 'Livre' : t.status === 'OCCUPIED' ? 'Consumindo' : 'Aguardando'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Painel Direito: Extrato & Calculadora de Pagamento Fracionado/Único */}
        <div className="clean-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt size={20} color="var(--accent-blue)" />
              <div>
                <h2 style={{ fontSize: '1.05rem' }}>Extrato de Consumo</h2>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {selectedTable ? `Fechamento - ${selectedTable.name}` : 'Selecione uma mesa ao lado'}
                </span>
              </div>
            </div>

            {/* Alternar Modo de Visualização do Extrato */}
            {selectedTable && bill && (
              <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-subtle)', padding: '2px', borderRadius: 'var(--radius-sm)' }}>
                <button
                  onClick={() => setViewMode('ITEMS')}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    background: viewMode === 'ITEMS' ? '#FFFFFF' : 'transparent',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Itens
                </button>
                <button
                  onClick={() => setViewMode('TIMELINE')}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    background: viewMode === 'TIMELINE' ? '#FFFFFF' : 'transparent',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Clock size={12} /> Horários
                </button>
              </div>
            )}
          </div>

          {feedback && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: feedback.type === 'success' ? 'var(--accent-emerald-light)' : '#FEE2E2',
              color: feedback.type === 'success' ? '#065F46' : '#991B1B'
            }}>
              {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {feedback.message}
            </div>
          )}

          {!selectedTable || !bill ? (
            <div style={{ textAlign: 'center', padding: '50px 10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Selecione uma mesa consumindo para exibir a conta detalhada.
            </div>
          ) : (
            <>
              {/* EXIBIÇÃO DE ITENS COM POSSIBILIDADE DE CORREÇÃO/EXCLUSÃO */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                
                {viewMode === 'ITEMS' ? (
                  /* VISÃO AGRUPADA DE ITENS */
                  bill.items_summary?.map((item: any) => (
                    <div key={item.menu_item_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
                      <div>
                        <span style={{ fontWeight: 700 }}>{item.quantity}x {item.name}</span>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>R$ {item.unit_price.toFixed(2)} un</div>
                      </div>
                      <span style={{ fontWeight: 800 }}>R$ {item.total_price.toFixed(2)}</span>
                    </div>
                  ))
                ) : (
                  /* VISÃO CRONOLÓGICA DE PEDIDOS POR HORÁRIO */
                  bill.orders?.map((ord: any, idx: number) => (
                    <div key={ord.id} style={{ background: 'var(--bg-subtle)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-blue)', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px' }}>
                        <span>🕒 Pedido #{idx + 1} ({new Date(ord.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})</span>
                        <span style={{ color: 'var(--text-muted)' }}>Garçom: {ord.waiter_name || 'Equipe'}</span>
                      </div>
                      {ord.items?.map((it: any) => (
                        <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                          <span>{it.quantity}x {it.menu_item_name}</span>
                          <span style={{ fontWeight: 700 }}>R$ {it.total_price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>

              {/* Total da Conta */}
              <div style={{ background: 'var(--accent-blue-light)', padding: '12px', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-blue-hover)' }}>Total da Mesa:</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-blue)' }}>
                  R$ {numericTotal.toFixed(2)}
                </span>
              </div>

              {/* Seletor de Modo de Pagamento: Único vs Fracionado (Dividir) */}
              <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-subtle)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
                <button
                  onClick={() => setIsSplitMode(false)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: !isSplitMode ? '#FFFFFF' : 'transparent',
                    color: !isSplitMode ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    boxShadow: !isSplitMode ? 'var(--shadow-sm)' : 'none'
                  }}
                >
                  Pagamento Único (1 Forma)
                </button>
                <button
                  onClick={() => {
                    setIsSplitMode(true);
                    if (splitRows.length === 0) {
                      setSplitRows([{ id: '1', method: 'PIX', amount: numericTotal }]);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: isSplitMode ? '#FFFFFF' : 'transparent',
                    color: isSplitMode ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    boxShadow: isSplitMode ? 'var(--shadow-sm)' : 'none'
                  }}
                >
                  <Layers size={14} /> Dividir Pagamento
                </button>
              </div>

              {/* MODO 1: PAGAMENTO ÚNICO - DISPONÍVEL PARA TODAS AS FORMAS (PIX, DINHEIRO, CARTÃO CRÉDITO, CARTÃO DÉBITO) */}
              {!isSplitMode ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Forma de Pagamento Selecionada:
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      onClick={() => setSingleMethod('PIX')}
                      style={{
                        padding: '10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '2px solid',
                        borderColor: singleMethod === 'PIX' ? 'var(--accent-emerald)' : 'var(--border-light)',
                        background: singleMethod === 'PIX' ? 'var(--accent-emerald-light)' : '#FFFFFF',
                        color: singleMethod === 'PIX' ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <QrCode size={16} /> PIX
                    </button>

                    <button
                      onClick={() => {
                        setSingleMethod('CASH');
                        if (!singleAmountPaid || parseFloat(singleAmountPaid) === 0) {
                          setSingleAmountPaid(numericTotal.toString());
                        }
                      }}
                      style={{
                        padding: '10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '2px solid',
                        borderColor: singleMethod === 'CASH' ? 'var(--accent-emerald)' : 'var(--border-light)',
                        background: singleMethod === 'CASH' ? 'var(--accent-emerald-light)' : '#FFFFFF',
                        color: singleMethod === 'CASH' ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <DollarSign size={16} /> Dinheiro
                    </button>

                    <button
                      onClick={() => setSingleMethod('CREDIT_CARD')}
                      style={{
                        padding: '10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '2px solid',
                        borderColor: singleMethod === 'CREDIT_CARD' ? 'var(--accent-blue)' : 'var(--border-light)',
                        background: singleMethod === 'CREDIT_CARD' ? 'var(--accent-blue-light)' : '#FFFFFF',
                        color: singleMethod === 'CREDIT_CARD' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <CreditCard size={16} /> Cartão Crédito
                    </button>

                    <button
                      onClick={() => setSingleMethod('DEBIT_CARD')}
                      style={{
                        padding: '10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '2px solid',
                        borderColor: singleMethod === 'DEBIT_CARD' ? 'var(--accent-blue)' : 'var(--border-light)',
                        background: singleMethod === 'DEBIT_CARD' ? 'var(--accent-blue-light)' : '#FFFFFF',
                        color: singleMethod === 'DEBIT_CARD' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <CreditCard size={16} /> Cartão Débito
                    </button>
                  </div>

                  {/* Calculadora de Troco para Dinheiro */}
                  {singleMethod === 'CASH' && (
                    <div style={{ background: '#FEF3C7', padding: '10px 12px', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#B45309' }}>
                        Valor Entregue pelo Cliente em Dinheiro (R$):
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={singleAmountPaid}
                        onChange={e => setSingleAmountPaid(e.target.value)}
                        style={{
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid #FCD34D',
                          fontSize: '0.95rem',
                          fontWeight: 700
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, color: '#B45309' }}>
                        <span>Troco a devolver:</span>
                        <span style={{ fontSize: '1rem' }}>R$ {singleChange > 0 ? singleChange.toFixed(2) : '0.00'}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* MODO 2: PAGAMENTO MÚLTIPLO / FRACIONADO */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Formas de Pagamento Selecionadas:
                    </label>

                    <button
                      onClick={handleAddSplitRow}
                      className="btn btn-outline"
                      style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'var(--accent-emerald)', borderColor: 'var(--accent-emerald)', minHeight: '32px' }}
                    >
                      <Plus size={14} /> Add Forma
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                    {splitRows.map((row, idx) => (
                      <div key={row.id} style={{ border: '1px solid var(--border-light)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)' }}>#{idx + 1}</span>

                          <select
                            value={row.method}
                            onChange={e => handleUpdateSplitRow(row.id, 'method', e.target.value as PaymentMethodType)}
                            style={{ padding: '6px', borderRadius: '4px', border: '1px solid var(--border-light)', fontSize: '0.8rem', fontWeight: 700, flex: 1 }}
                          >
                            <option value="PIX">💚 PIX</option>
                            <option value="CREDIT_CARD">💳 Cartão Crédito</option>
                            <option value="DEBIT_CARD">💳 Cartão Débito</option>
                            <option value="CASH">💵 Dinheiro</option>
                          </select>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={row.amount}
                              onChange={e => handleUpdateSplitRow(row.id, 'amount', parseFloat(e.target.value) || 0)}
                              style={{ width: '85px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-light)', fontSize: '0.82rem', fontWeight: 700 }}
                            />
                          </div>

                          {splitRows.length > 1 && (
                            <button
                              onClick={() => handleRemoveSplitRow(row.id)}
                              style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px' }}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>

                        {row.method === 'CASH' && (
                          <div style={{ background: '#FEF3C7', padding: '6px 8px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                            <span style={{ fontWeight: 700, color: '#B45309' }}>Pago em notas (R$):</span>
                            <input
                              type="number"
                              step="0.01"
                              placeholder={row.amount.toString()}
                              value={row.amount_paid !== undefined ? row.amount_paid : ''}
                              onChange={e => handleUpdateSplitRow(row.id, 'amount_paid', parseFloat(e.target.value) || 0)}
                              style={{ width: '75px', padding: '4px', borderRadius: '4px', border: '1px solid #FCD34D', fontSize: '0.8rem', fontWeight: 700 }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: '8px 10px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Total Alocado:</span>
                      <span style={{ fontWeight: 800 }}>R$ {totalAllocated.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Restante a Pagar:</span>
                      <span style={{ fontWeight: 800, color: remainingToAllocate > 0 ? '#DC2626' : 'var(--accent-emerald)' }}>
                        R$ {remainingToAllocate.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* BOTÃO ÚNICO DE VERIFICAÇÃO FUNCIONAL PARA TODAS AS FORMAS DE PAGAMENTO */}
              <button
                onClick={() => setShowVerifyModal(true)}
                disabled={loading || (isSplitMode && remainingToAllocate > 0.01)}
                className="btn btn-success"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '0.95rem',
                  marginTop: '6px',
                  opacity: (isSplitMode && remainingToAllocate > 0.01) ? 0.5 : 1,
                  cursor: (isSplitMode && remainingToAllocate > 0.01) ? 'not-allowed' : 'pointer'
                }}
              >
                <ShieldCheck size={18} />
                {loading
                  ? 'Processando...'
                  : isSplitMode
                  ? (remainingToAllocate > 0.01 ? `Faltam R$ ${remainingToAllocate.toFixed(2)}` : 'Conferir e Fechar Mesa')
                  : `Conferir e Fechar Mesa (${methodLabels[singleMethod]})`}
              </button>
            </>
          )}

        </div>

      </div>

      {/* Seção 3: Histórico de Comandas Fechadas Hoje com Botão de Reimpressão Direta no Caixa */}
      {closedHistory.length > 0 && (
        <div className="clean-card" style={{ padding: '16px', marginTop: '10px' }}>
          <h2 style={{ fontSize: '1.05rem', marginBottom: '12px' }}>Comandas Fechadas Hoje no Caixa</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {closedHistory.map((detail, idx) => (
              <div key={idx} style={{ padding: '12px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>Mesa {detail.table_number}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '10px' }}>
                    Garçom: {detail.waiter_name} • Fechado: {detail.closed_at}
                  </span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Total: R$ {detail.total_amount.toFixed(2)}
                  </div>
                </div>

                <button
                  onClick={() => handleReprintReceipt(detail.order_id)}
                  className="btn btn-outline"
                  style={{ padding: '6px 12px', fontSize: '0.78rem', color: 'var(--accent-emerald)', borderColor: 'var(--accent-emerald)', minHeight: '36px' }}
                >
                  <Printer size={14} /> Reimprimir Cupom
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
