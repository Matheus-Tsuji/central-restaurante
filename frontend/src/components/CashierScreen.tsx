import React, { useState, useEffect } from 'react';
import type { Table } from '../types';
import { api } from '../services/api';
import { DollarSign, CreditCard, QrCode, Receipt, CheckCircle2, AlertCircle, RefreshCw, Printer, X } from 'lucide-react';

export const CashierScreen: React.FC = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [bill, setBill] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX'>('PIX');
  const [amountPaid, setAmountPaid] = useState<string>('');
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
    try {
      const bData = await api.getTableBill(t.id);
      setBill(bData);
      if (bData.total_amount) {
        setAmountPaid(bData.total_amount.toString());
      }
    } catch (err: any) {
      setBill(null);
    }
  }

  const numericTotal = bill?.total_amount || 0;
  const numericPaid = parseFloat(amountPaid) || 0;
  const changeGiven = paymentMethod === 'CASH' && numericPaid > numericTotal ? numericPaid - numericTotal : 0;

  async function handleProcessPayment() {
    if (!selectedTable) return;
    setLoading(true);
    setFeedback(null);

    try {
      const result = await api.processPayment(selectedTable.id, [
        {
          method: paymentMethod,
          amount: numericTotal,
          amount_paid: paymentMethod === 'CASH' ? numericPaid : numericTotal
        }
      ]);

      if (result.receipt_text) {
        setReceiptText(result.receipt_text);
      }

      setFeedback({
        type: 'success',
        message: `Pagamento recebido com sucesso! Cupom salvo na pasta 'comprovantes_mesas/'. Troco: R$ ${result.change_given?.toFixed(2) || changeGiven.toFixed(2)}.`
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 440px', gap: '24px' }}>
        
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

        {/* Painel Direito: Extrato & Calculadora de Pagamento */}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
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

              {/* Seletor Método de Pagamento */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Forma de Pagamento:
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    onClick={() => setPaymentMethod('PIX')}
                    style={{
                      padding: '10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid',
                      borderColor: paymentMethod === 'PIX' ? 'var(--accent-emerald)' : 'var(--border-light)',
                      background: paymentMethod === 'PIX' ? 'var(--accent-emerald-light)' : '#FFFFFF',
                      color: paymentMethod === 'PIX' ? 'var(--accent-emerald)' : 'var(--text-secondary)',
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
                    onClick={() => setPaymentMethod('CASH')}
                    style={{
                      padding: '10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid',
                      borderColor: paymentMethod === 'CASH' ? 'var(--accent-emerald)' : 'var(--border-light)',
                      background: paymentMethod === 'CASH' ? 'var(--accent-emerald-light)' : '#FFFFFF',
                      color: paymentMethod === 'CASH' ? 'var(--accent-emerald)' : 'var(--text-secondary)',
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
                    onClick={() => setPaymentMethod('CREDIT_CARD')}
                    style={{
                      padding: '10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid',
                      borderColor: paymentMethod === 'CREDIT_CARD' ? 'var(--accent-blue)' : 'var(--border-light)',
                      background: paymentMethod === 'CREDIT_CARD' ? 'var(--accent-blue-light)' : '#FFFFFF',
                      color: paymentMethod === 'CREDIT_CARD' ? 'var(--accent-blue)' : 'var(--text-secondary)',
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
                    onClick={() => setPaymentMethod('DEBIT_CARD')}
                    style={{
                      padding: '10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid',
                      borderColor: paymentMethod === 'DEBIT_CARD' ? 'var(--accent-blue)' : 'var(--border-light)',
                      background: paymentMethod === 'DEBIT_CARD' ? 'var(--accent-blue-light)' : '#FFFFFF',
                      color: paymentMethod === 'DEBIT_CARD' ? 'var(--accent-blue)' : 'var(--text-secondary)',
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
              </div>

              {/* Calculadora de Troco para Dinheiro */}
              {paymentMethod === 'CASH' && (
                <div style={{ background: '#FEF3C7', padding: '12px', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#B45309' }}>
                    Valor Entregue pelo Cliente (R$):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={amountPaid}
                    onChange={e => setAmountPaid(e.target.value)}
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
                    <span style={{ fontSize: '1.1rem' }}>R$ {changeGiven > 0 ? changeGiven.toFixed(2) : '0.00'}</span>
                  </div>
                </div>
              )}

              <button
                onClick={handleProcessPayment}
                disabled={loading}
                className="btn btn-success"
                style={{ width: '100%', padding: '12px', fontSize: '1rem', marginTop: '8px' }}
              >
                <CheckCircle2 size={18} />
                {loading ? 'Processando...' : 'Finalizar Pagamento e Emitir Cupom'}
              </button>
            </>
          )}

        </div>

      </div>
    </div>
  );
};
