import React, { useState, useEffect } from 'react';
import { Table, MenuItem } from '../types';
import { api } from '../services/api';
import { offlineDb } from '../services/offlineDb';
import { ShoppingBag, Plus, Minus, Send, CheckCircle2, AlertCircle, Search } from 'lucide-react';

interface WaiterScreenProps {
  isOnline: boolean;
  onOrderCreated: () => void;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes: string;
}

export const WaiterScreen: React.FC<WaiterScreenProps> = ({ isOnline, onOrderCreated }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [tData, mData] = await Promise.all([api.getTables(), api.getMenuItems()]);
      setTables(tData);
      setMenuItems(mData);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  }

  const categories = ['Todos', ...Array.from(new Set(menuItems.map(i => i.category)))];

  const filteredMenuItems = menuItems.filter(item => {
    const matchesCategory = activeCategory === 'Todos' || item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const existingIndex = prev.findIndex(c => c.menuItem.id === item.id);
      if (existingIndex > -1) {
        const copy = [...prev];
        copy[existingIndex]!.quantity += 1;
        return copy;
      }
      return [...prev, { menuItem: item, quantity: 1, notes: '' }];
    });
  }

  function updateQuantity(itemId: string, delta: number) {
    setCart(prev => {
      return prev.map(c => {
        if (c.menuItem.id === itemId) {
          const newQty = c.quantity + delta;
          return newQty > 0 ? { ...c, quantity: newQty } : null;
        }
        return c;
      }).filter(Boolean) as CartItem[];
    });
  }

  function updateNotes(itemId: string, notes: string) {
    setCart(prev => prev.map(c => c.menuItem.id === itemId ? { ...c, notes } : c));
  }

  const cartTotal = cart.reduce((acc, item) => acc + (item.menuItem.price * item.quantity), 0);

  async function handleSendOrder() {
    if (!selectedTable) {
      setFeedback({ type: 'error', message: 'Selecione uma mesa antes de enviar o pedido.' });
      return;
    }
    if (cart.length === 0) {
      setFeedback({ type: 'error', message: 'Adicione pelo menos um item ao carrinho.' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    const formattedItems = cart.map(c => ({
      menu_item_id: c.menuItem.id,
      quantity: c.quantity,
      notes: c.notes || undefined
    }));

    const syncId = `off_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    try {
      if (isOnline) {
        await api.createOrder(selectedTable.id, formattedItems, syncId);
        setFeedback({ type: 'success', message: `Pedido da ${selectedTable.name} enviado com sucesso para a Cozinha!` });
      } else {
        // Salvar no IndexedDB local com Dexie.js
        await offlineDb.offlineOrders.add({
          offline_sync_id: syncId,
          table_id: selectedTable.id,
          table_number: selectedTable.number,
          items: formattedItems,
          notes: orderNotes,
          created_at: new Date().toISOString(),
          synced: 0
        });
        setFeedback({ type: 'success', message: `Modo Offline: Pedido da ${selectedTable.name} salvo no dispositivo. Será sincronizado ao reconectar.` });
      }

      setCart([]);
      setOrderNotes('');
      onOrderCreated();
      loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao processar pedido.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '24px' }}>
        
        {/* Painel Esquerdo: Mapa de Mesas & Cardápio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Seção Mapa de Mesas */}
          <div className="clean-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.1rem' }}>Mapa de Mesas</h2>
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem' }}>
                <span className="badge badge-free">Livre</span>
                <span className="badge badge-occupied">Ocupada</span>
                <span className="badge badge-pending">Pagamento</span>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
              gap: '12px'
            }}>
              {tables.map(t => {
                const isSelected = selectedTable?.id === t.id;
                let bg = '#FFFFFF';
                let border = 'var(--border-light)';
                let badgeClass = 'badge-free';

                if (t.status === 'OCCUPIED') badgeClass = 'badge-occupied';
                if (t.status === 'PAYMENT_PENDING') badgeClass = 'badge-pending';

                if (isSelected) {
                  border = 'var(--accent-blue)';
                  bg = 'var(--accent-blue-light)';
                }

                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTable(t)}
                    style={{
                      background: bg,
                      border: `2px solid ${border}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 4px 12px rgba(2, 132, 199, 0.15)' : 'none'
                    }}
                  >
                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                      Mesa {t.number}
                    </span>
                    <span className={`badge ${badgeClass}`} style={{ fontSize: '0.65rem' }}>
                      {t.status === 'FREE' ? 'Livre' : t.status === 'OCCUPIED' ? 'Ocupada' : 'Aguardando'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seção Seleção de Produtos do Cardápio */}
          <div className="clean-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.1rem' }}>Cardápio de Produtos</h2>

              {/* Input Busca */}
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Buscar produto..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 34px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-light)',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Abas de Categorias */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '16px' }}>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: '1px solid',
                    borderColor: activeCategory === cat ? 'var(--accent-blue)' : 'var(--border-light)',
                    background: activeCategory === cat ? 'var(--accent-blue-light)' : '#FFFFFF',
                    color: activeCategory === cat ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Grid de Pratos */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '14px'
            }}>
              {filteredMenuItems.map(item => (
                <div
                  key={item.id}
                  style={{
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '10px',
                    background: '#FFFFFF',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--accent-emerald)', fontWeight: 700, textTransform: 'uppercase' }}>
                      {item.category}
                    </span>
                    <h3 style={{ fontSize: '0.95rem', margin: '2px 0 4px 0' }}>{item.name}</h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                      {item.description}
                    </p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      R$ {item.price.toFixed(2)}
                    </span>
                    <button
                      onClick={() => addToCart(item)}
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    >
                      <Plus size={14} /> Adicionar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Painel Direito: Resumo do Pedido da Mesa (Carrinho) */}
        <div className="clean-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: 'fit-content', position: 'sticky', top: '90px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '14px', borderBottom: '1px solid var(--border-light)' }}>
            <ShoppingBag size={22} color="var(--accent-blue)" />
            <div>
              <h2 style={{ fontSize: '1.1rem' }}>Comanda do Pedido</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {selectedTable ? `Lançando para ${selectedTable.name}` : 'Nenhuma mesa selecionada'}
              </span>
            </div>
          </div>

          {feedback && (
            <div style={{
              marginTop: '12px',
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

          {/* Lista de Itens no Carrinho */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '16px 0', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Selecione os pratos no cardápio ao lado para adicionar ao pedido.
              </div>
            ) : (
              cart.map(c => (
                <div key={c.menuItem.id} style={{ padding: '10px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{c.menuItem.name}</span>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        R$ {c.menuItem.price.toFixed(2)} cada
                      </div>
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                      R$ {(c.menuItem.price * c.quantity).toFixed(2)}
                    </span>
                  </div>

                  {/* Controles de Quantidade */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Obs: sem molho..."
                      value={c.notes}
                      onChange={e => updateNotes(c.menuItem.id, e.target.value)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-light)',
                        fontSize: '0.75rem',
                        width: '160px'
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                      <button onClick={() => updateQuantity(c.menuItem.id, -1)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <Minus size={14} />
                      </button>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', minWidth: '16px', textAlign: 'center' }}>{c.quantity}</span>
                      <button onClick={() => updateQuantity(c.menuItem.id, 1)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Resumo Financeiro & Envio */}
          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Total do Pedido:</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-blue)' }}>
                R$ {cartTotal.toFixed(2)}
              </span>
            </div>

            <button
              onClick={handleSendOrder}
              disabled={loading || cart.length === 0}
              className="btn btn-success"
              style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
            >
              <Send size={16} />
              {loading ? 'Enviando...' : 'Enviar Pedido para a Cozinha'}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
