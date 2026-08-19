import React, { useState, useEffect } from 'react';
import type { Table } from '../types';
import { api } from '../services/api';
import { DollarSign, CreditCard, QrCode, Receipt, CheckCircle2, AlertCircle, RefreshCw, Printer, X, Plus, Trash2, Layers } from 'lucide-react';

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

  // Modo de pagamento: 'SINGLE' (Único) ou 'SPLIT' (Múltiplo / Fracionado)
  const [isSplitMode, setIsSplitMode] = useState<boolean>(false);

  // Pagamento único
  const [singleMethod, setSingleMethod] = useState<PaymentMethodType>('PIX');
  const [singleAmountPaid, setSingleAmountPaid] = useState<string>('');

  // Pagamentos fracionados (múltiplos)
  const [splitRows, setSplitRows] = useState<SplitPaymentRow[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [receiptText, setReceiptText] = useState<string | null>(null);

  useEffect(() => {
    loadTables();
  }, []);

  async function loadTables() {
    try {
      const data = await api.getTables();
      setTables(data);
    } catch (err) {
      console.error('Erro ao carregar mesas:', err);
    }
  }

  async function handleSelectTable(t: Table) {
    setSelectedTable(t);
    setFeedback(null);
    setIsSplitMode(false);
    try {
      const bData = await api.getTableBill(t.id);
      setBill(bData);
      const total = bData.total_amount || 0;
      setSingleAmountPaid(total.toString());

      // Inicializa splitRows com a primeira forma contendo o total
      setSplitRows([
        { id: '1', method: 'PIX', amount: total }
      ]);
    } catch (err: any) {
      setBill(null);
      setSplitRows([]);
    }
  }

  const numericTotal = bill?.total_amount || 0;

  // Cálculos para pagamento ÚNICO
  const singlePaid = parseFloat(singleAmountPaid) || 0;
  const singleChange = singleMethod === 'CASH' && singlePaid > numericTotal ? singlePaid - numericTotal : 0;

  // Cálculos para pagamento FRACIONADO (MÚLTIPLO)
  const totalAllocated = splitRows.reduce((acc, row) => acc + (row.amount || 0), 0);
  const remainingToAllocate = Number(Math.max(0, numericTotal - totalAllocated).toFixed(2));
  
  // Cálculo de troco total nos pagamentos fracionados que usarem dinheiro
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

  async function handleProcessPayment() {
    if (!selectedTable) return;
    setLoading(true);
    setFeedback(null);

    try {
      let paymentsToSend: { method: PaymentMethodType; amount: number; amount_paid?: number }[] = [];

      if (!isSplitMode) {
        paymentsToSend = [
          {
            method: singleMethod,
            amount: numericTotal,
            amount_paid: singleMethod === 'CASH' ? singlePaid : numericTotal
          }
        ];
      } else {
        // Validação no modo fracionado
        if (Math.abs(totalAllocated - numericTotal) > 0.01 && totalAllocated < numericTotal) {
          throw new Error(`O total das formas de pagamento (R$ ${totalAllocated.toFixed(2)}) é inferior ao valor total da conta (R$ ${numericTotal.toFixed(2)}).`);
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
        message: `Pagamento recebido com sucesso! Cupom salvo na pasta 'comprovantes_mesas/'. Troco: R$ ${result.change_given?.toFixed(2) || calculatedChange.toFixed(2)}.`
      });

      setSelectedTable(null);
      setBill(null);
      loadTables();
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
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Modal de Simulação de Impressão Térmica de Cupom Fiscal .TXT */}
      {receiptText && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            width: '460px',
            maxWidth: '90%',
            padding: '24px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={20} color="var(--accent-blue)" />
                <h3 style={{ fontSize: '1.1rem' }}>Cupom de Consumo Emitido</h3>
              </div>
              <button onClick={() => setReceiptText(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="var(--text-muted)" />
              </button>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>
              📄 Salvo automaticamente em formato .TXT na pasta <code>comprovantes_mesas/</code> do projeto!
            </p>

            <pre style={{
              background: '#1E293B',
              color: '#F8FAFC',
              padding: '16px',
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setReceiptText(null)} className="btn btn-primary" style={{ width: '100%' }}>
                Fechar Cupom
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 480px', gap: '24px' }}>
        
        {/* Painel Esquerdo: Lista de Mesas para Fechamento */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Header & Status */}
          <div className="clean-card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '1.25rem' }}>Caixa Central (POS)</h1>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Selecione uma mesa ocupada para visualizar o extrato e encerrar a conta
              </p>
            </div>

            <button onClick={loadTables} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              <RefreshCw size={14} /> Atualizar Mesas
            </button>
          </div>

          {/* Grid de Mesas */}
          <div className="clean-card" style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '1rem', marginBottom: '16px' }}>Status das Mesas</h2>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: '12px'
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
                      padding: '16px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>Mesa {t.number}</span>
                    <span className={`badge ${t.status === 'FREE' ? 'badge-free' : t.status === 'OCCUPIED' ? 'badge-occupied' : 'badge-pending'}`} style={{ fontSize: '0.65rem' }}>
                      {t.status === 'FREE' ? 'Livre' : t.status === 'OCCUPIED' ? 'Consumindo' : 'Aguardando'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Painel Direito: Extrato & Calculadora de Pagamento Fracionado/Único */}
        <div className="clean-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
            <Receipt size={22} color="var(--accent-blue)" />
            <div>
              <h2 style={{ fontSize: '1.1rem' }}>Extrato de Consumo</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {selectedTable ? `Fechamento de Conta - ${selectedTable.name}` : 'Selecione uma mesa ao lado'}
              </span>
            </div>
          </div>

          {feedback && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
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
            <div style={{ textAlign: 'center', padding: '60px 10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Selecione uma mesa consumindo para exibir a conta detalhada.
            </div>
          ) : (
            <>
              {/* Itens do Extrato */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {bill.items_summary?.map((item: any) => (
                  <div key={item.menu_item_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                    <div>
                      <span style={{ fontWeight: 700 }}>{item.quantity}x {item.name}</span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>R$ {item.unit_price.toFixed(2)} un</div>
                    </div>
                    <span style={{ fontWeight: 800 }}>R$ {item.total_price.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Total da Conta */}
              <div style={{ background: 'var(--accent-blue-light)', padding: '14px', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-blue-hover)' }}>Total da Mesa:</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-blue)' }}>
                  R$ {numericTotal.toFixed(2)}
                </span>
              </div>

              {/* Seletor de Modo de Pagamento: Único vs Fracionado (Dividir) */}
              <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-subtle)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
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
                    fontSize: '0.82rem',
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
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    boxShadow: isSplitMode ? 'var(--shadow-sm)' : 'none'
                  }}
                >
                  <Layers size={14} /> Dividir Pagamento (Múltiplo)
                </button>
              </div>

              {/* MODO 1: PAGAMENTO ÚNICO */}
              {!isSplitMode ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Forma de Pagamento:
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      onClick={() => setSingleMethod('PIX')}
                      style={{
                        padding: '10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid',
                        borderColor: singleMethod === 'PIX' ? 'var(--accent-emerald)' : 'var(--border-light)',
                        background: singleMethod === 'PIX' ? 'var(--accent-emerald-light)' : '#FFFFFF',
                        color: singleMethod === 'PIX' ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <QrCode size={16} /> PIX
                    </button>

                    <button
                      onClick={() => setSingleMethod('CASH')}
                      style={{
                        padding: '10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid',
                        borderColor: singleMethod === 'CASH' ? 'var(--accent-emerald)' : 'var(--border-light)',
                        background: singleMethod === 'CASH' ? 'var(--accent-emerald-light)' : '#FFFFFF',
                        color: singleMethod === 'CASH' ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '0.85rem',
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
                        border: '1px solid',
                        borderColor: singleMethod === 'CREDIT_CARD' ? 'var(--accent-blue)' : 'var(--border-light)',
                        background: singleMethod === 'CREDIT_CARD' ? 'var(--accent-blue-light)' : '#FFFFFF',
                        color: singleMethod === 'CREDIT_CARD' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '0.85rem',
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
                        border: '1px solid',
                        borderColor: singleMethod === 'DEBIT_CARD' ? 'var(--accent-blue)' : 'var(--border-light)',
                        background: singleMethod === 'DEBIT_CARD' ? 'var(--accent-blue-light)' : '#FFFFFF',
                        color: singleMethod === 'DEBIT_CARD' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <CreditCard size={16} /> Cartão Débito
                    </button>
                  </div>

                  {/* Calculadora de Troco para Dinheiro em Pagamento Único */}
                  {singleMethod === 'CASH' && (
                    <div style={{ background: '#FEF3C7', padding: '12px', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#B45309' }}>
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
                          fontSize: '1rem',
                          fontWeight: 700
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, color: '#B45309' }}>
                        <span>Troco a devolver:</span>
                        <span style={{ fontSize: '1.1rem' }}>R$ {singleChange > 0 ? singleChange.toFixed(2) : '0.00'}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* MODO 2: PAGAMENTO MÚLTIPLO / FRACIONADO */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Formas de Pagamento Selecionadas:
                    </label>

                    <button
                      onClick={handleAddSplitRow}
                      className="btn btn-outline"
                      style={{ padding: '4px 10px', fontSize: '0.78rem', color: 'var(--accent-emerald)', borderColor: 'var(--accent-emerald)' }}
                    >
                      <Plus size={14} /> Adicionar Forma
                    </button>
                  </div>

                  {/* Lista de Linhas de Pagamento Fracionado */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '220px', overflowY: 'auto' }}>
                    {splitRows.map((row, idx) => (
                      <div key={row.id} style={{ border: '1px solid var(--border-light)', padding: '10px', borderRadius: 'var(--radius-sm)', background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>#{idx + 1}</span>

                          {/* Dropdown Método */}
                          <select
                            value={row.method}
                            onChange={e => handleUpdateSplitRow(row.id, 'method', e.target.value as PaymentMethodType)}
                            style={{ padding: '6px', borderRadius: '4px', border: '1px solid var(--border-light)', fontSize: '0.82rem', fontWeight: 700, flex: 1 }}
                          >
                            <option value="PIX">💚 PIX</option>
                            <option value="CREDIT_CARD">💳 Cartão Crédito</option>
                            <option value="DEBIT_CARD">💳 Cartão Débito</option>
                            <option value="CASH">💵 Dinheiro</option>
                          </select>

                          {/* Valor da Forma */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={row.amount}
                              onChange={e => handleUpdateSplitRow(row.id, 'amount', parseFloat(e.target.value) || 0)}
                              style={{ width: '90px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-light)', fontSize: '0.85rem', fontWeight: 700 }}
                            />
                          </div>

                          {/* Botão Remover */}
                          {splitRows.length > 1 && (
                            <button
                              onClick={() => handleRemoveSplitRow(row.id)}
                              style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>

                        {/* Campo extra de Troco se o método for Dinheiro */}
                        {row.method === 'CASH' && (
                          <div style={{ background: '#FEF3C7', padding: '6px 10px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                            <span style={{ fontWeight: 700, color: '#B45309' }}>Valor pago em notas (R$):</span>
                            <input
                              type="number"
                              step="0.01"
                              placeholder={row.amount.toString()}
                              value={row.amount_paid !== undefined ? row.amount_paid : ''}
                              onChange={e => handleUpdateSplitRow(row.id, 'amount_paid', parseFloat(e.target.value) || 0)}
                              style={{ width: '80px', padding: '4px', borderRadius: '4px', border: '1px solid #FCD34D', fontSize: '0.82rem', fontWeight: 700 }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Resumo do Pagamento Fracionado */}
                  <div style={{ padding: '10px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                    {totalSplitChange > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#B45309', fontWeight: 700 }}>
                        <span>Troco em Dinheiro:</span>
                        <span>R$ {totalSplitChange.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={handleProcessPayment}
                disabled={loading || (isSplitMode && remainingToAllocate > 0.01)}
                className="btn btn-success"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '1rem',
                  marginTop: '8px',
                  opacity: (isSplitMode && remainingToAllocate > 0.01) ? 0.5 : 1,
                  cursor: (isSplitMode && remainingToAllocate > 0.01) ? 'not-allowed' : 'pointer'
                }}
              >
                <CheckCircle2 size={18} />
                {loading
                  ? 'Processando...'
                  : isSplitMode
                  ? (remainingToAllocate > 0.01 ? `Faltam R$ ${remainingToAllocate.toFixed(2)}` : 'Finalizar Pagamento Fracionado')
                  : `Finalizar Pagamento (${methodLabels[singleMethod]})`}
              </button>
            </>
          )}

        </div>

      </div>
    </div>
  );
};
