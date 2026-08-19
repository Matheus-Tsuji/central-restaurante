import React, { useState, useEffect } from 'react';
import type { Table, MenuItem } from '../types';
import { api } from '../services/api';
import { offlineDb } from '../services/offlineDb';
import { ShoppingBag, Plus, Minus, Send, CheckCircle2, AlertCircle, Search, RefreshCw, X, ChevronUp } from 'lucide-react';

interface WaiterScreenProps {
  isOnline: boolean;
  onOrderCreated: () => void;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes: string;
}

const INITIAL_TABLES: Table[] = [
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

const INITIAL_MENU: MenuItem[] = [
  { id: 'm1', name: 'X-Burguer Especial', description: 'Pão brioche, artesanal 180g, duplo cheddar', price: 32.90, category: 'Lanches', active: true },
  { id: 'm2', name: 'Smash Bacon Supreme', description: 'Dois smash 90g, queijo prato, bacon crocante', price: 36.50, category: 'Lanches', active: true },
  { id: 'm3', name: 'Batata Rústica c/ Páprica', description: 'Porção 400g servida com maionese da casa', price: 22.00, category: 'Porções', active: true },
  { id: 'm4', name: 'Refrigerante Cola 350ml', description: 'Lata trincando de gelada', price: 7.50, category: 'Bebidas', active: true },
  { id: 'm5', name: 'Suco Natural Laranja 500ml', description: 'Suco da fruta feito na hora', price: 11.00, category: 'Bebidas', active: true },
  { id: 'm6', name: 'Petit Gâteau Chocolate', description: 'Acompanha sorvete de creme e calda', price: 24.90, category: 'Sobremesas', active: true }
];

export const WaiterScreen: React.FC<WaiterScreenProps> = ({ isOnline, onOrderCreated }) => {
  const [tables, setTables] = useState<Table[]>(INITIAL_TABLES);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(INITIAL_MENU);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estado de controle do Drawer do Carrinho em Celulares
  const [showMobileCart, setShowMobileCart] = useState<boolean>(false);

  useEffect(() => {
    loadDataBackground();
  }, []);

  async function loadDataBackground() {
    setRefreshing(true);
    try {
      const [tData, mData] = await Promise.all([api.getTables(), api.getMenuItems()]);
      if (tData && tData.length > 0) setTables(tData);
      if (mData && mData.length > 0) setMenuItems(mData);
    } catch (err) {
      console.warn('Erro ao atualizar dados em segundo plano:', err);
    } finally {
      setRefreshing(false);
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
  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

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
        setFeedback({ type: 'success', message: `Pedido da ${selectedTable.name} enviado com sucesso!` });
      } else {
        if (offlineDb) {
          await offlineDb.offlineOrders.add({
            offline_sync_id: syncId,
            table_id: selectedTable.id,
            table_number: selectedTable.number,
            items: formattedItems,
            notes: orderNotes,
            created_at: new Date().toISOString(),
            synced: 0
          });
        }
        setFeedback({ type: 'success', message: `Modo Offline: Pedido salvo no dispositivo. Será sincronizado ao reconectar.` });
      }

      setCart([]);
      setOrderNotes('');
      setShowMobileCart(false);
      onOrderCreated();
      loadDataBackground();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao processar pedido.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '16px', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Grid Principal Adaptável */}
      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '20px' }}>
        
        {/* Painel Esquerdo: Mapa de Mesas & Cardápio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Seção Mapa de Mesas */}
          <div className="clean-card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.05rem' }}>Mapa de Mesas</h2>
                {refreshing && <RefreshCw size={14} className="spin" color="var(--accent-blue)" />}
              </div>

              <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem' }}>
                <span className="badge badge-free">Livre</span>
                <span className="badge badge-occupied">Ocupada</span>
                <span className="badge badge-pending">Pagamento</span>
              </div>
            </div>

            {/* Grid de Mesas Responsivo para Toque no Celular */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
              gap: '10px'
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
                      padding: '12px 8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      minHeight: '64px',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 4px 12px rgba(2, 132, 199, 0.15)' : 'none'
                    }}
                  >
                    <span style={{ fontSize: '1rem', fontWeight: 800 }}>
                      Mesa {t.number}
                    </span>
                    <span className={`badge ${badgeClass}`} style={{ fontSize: '0.6rem', padding: '2px 6px' }}>
                      {t.status === 'FREE' ? 'Livre' : t.status === 'OCCUPIED' ? 'Ocupada' : 'Pagamento'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seção Seleção de Produtos do Cardápio */}
          <div className="clean-card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '1.05rem' }}>Cardápio de Produtos</h2>

              {/* Input Busca no Celular */}
              <div style={{ position: 'relative', width: '100%', maxWidth: '220px' }}>
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

            {/* Abas de Categorias Roláveis no Celular */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '14px', WebkitOverflowScrolling: 'touch' }}>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    border: '1px solid',
                    borderColor: activeCategory === cat ? 'var(--accent-blue)' : 'var(--border-light)',
                    background: activeCategory === cat ? 'var(--accent-blue-light)' : '#FFFFFF',
                    color: activeCategory === cat ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    minHeight: '40px'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Grid de Pratos Otimizado para Telas de Celular */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '12px'
            }}>
              {filteredMenuItems.map(item => (
                <div
                  key={item.id}
                  style={{
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '8px',
                    background: '#FFFFFF'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--accent-emerald)', fontWeight: 700, textTransform: 'uppercase' }}>
                      {item.category}
                    </span>
                    <h3 style={{ fontSize: '0.9rem', margin: '2px 0' }}>{item.name}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.2' }}>
                      {item.description}
                    </p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      R$ {item.price.toFixed(2)}
                    </span>
                    <button
                      onClick={() => addToCart(item)}
                      className="btn btn-primary"
                      style={{ padding: '6px 10px', fontSize: '0.78rem', minHeight: '36px' }}
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Painel Direito / Carrinho Desktop & Mobile Drawer */}
        <div className={`clean-card ${cartItemCount > 0 && showMobileCart ? 'mobile-cart-fixed' : ''}`} style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShoppingBag size={22} color="var(--accent-blue)" />
              <div>
                <h2 style={{ fontSize: '1.1rem' }}>Comanda do Pedido</h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {selectedTable ? `Lançando para ${selectedTable.name}` : 'Selecione uma mesa'}
                </span>
              </div>
            </div>

            {showMobileCart && (
              <button onClick={() => setShowMobileCart(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={22} color="var(--text-muted)" />
              </button>
            )}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '14px 0', maxHeight: '360px', overflowY: 'auto' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Selecione os pratos no cardápio para adicionar ao pedido da mesa.
              </div>
            ) : (
              cart.map(c => (
                <div key={c.menuItem.id} style={{ padding: '10px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{c.menuItem.name}</span>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        R$ {c.menuItem.price.toFixed(2)} un
                      </div>
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>
                      R$ {(c.menuItem.price * c.quantity).toFixed(2)}
                    </span>
                  </div>

                  {/* Controles de Quantidade Otimizados para Celular */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Obs: sem cebola..."
                      value={c.notes}
                      onChange={e => updateNotes(c.menuItem.id, e.target.value)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-light)',
                        fontSize: '0.75rem',
                        flex: 1
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FFFFFF', padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                      <button onClick={() => updateQuantity(c.menuItem.id, -1)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <Minus size={14} />
                      </button>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', minWidth: '18px', textAlign: 'center' }}>{c.quantity}</span>
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
          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total do Pedido:</span>
              <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-blue)' }}>
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
              {loading ? 'Enviando...' : 'Enviar Pedido para Produção'}
            </button>
          </div>

        </div>

      </div>

      {/* 📱 Barra Flutuante Mobile do Carrinho para o Garçom no Celular */}
      {cartItemCount > 0 && !showMobileCart && (
        <div
          className="mobile-cart-floating-bar"
          onClick={() => setShowMobileCart(true)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingBag size={20} />
            <span>{cartItemCount} {cartItemCount === 1 ? 'item' : 'itens'} na comanda</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>R$ {cartTotal.toFixed(2)}</span>
            <ChevronUp size={18} />
          </div>
        </div>
      )}

    </div>
  );
};
