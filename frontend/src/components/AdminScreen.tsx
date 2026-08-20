import React, { useState, useEffect } from 'react';
import type { Table, MenuItem, InventoryItem, RestaurantSettings } from '../types';
import { api } from '../services/api';
import { socket } from '../services/socket';
import { 
  Utensils, 
  Package, 
  Settings, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Grid, 
  CreditCard, 
  Building2, 
  RefreshCw,
  Search,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

export const AdminScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tables' | 'menu' | 'inventory' | 'settings'>('tables');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Estados dos Dados
  const [tables, setTables] = useState<Table[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings>({
    restaurant_name: 'Central Restaurante S.A.',
    cnpj: '12.345.678/0001-90',
    phone: '(11) 99999-8888',
    address: 'Av. Principal, 1000 - Centro - São Paulo/SP',
    service_tax_percent: 10,
    payment_methods_allowed: ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'PIX']
  });

  // Modal / Formulários de Edição
  const [newTableNum, setNewTableNum] = useState<string>('');
  const [newTableName, setNewTableName] = useState<string>('');
  
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [editTableNum, setEditTableNum] = useState<string>('');
  const [editTableName, setEditTableName] = useState<string>('');

  // Formulário do Cardápio
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState('ALL');
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  const [newMenuForm, setNewMenuForm] = useState({ name: '', description: '', price: '', category: 'Pratos Principais' });
  const [editingMenu, setEditingMenu] = useState<MenuItem | null>(null);

  // Formulário de Estoque
  const [invSearch, setInvSearch] = useState('');
  const [showAddInvModal, setShowAddInvModal] = useState(false);
  const [newInvForm, setNewInvForm] = useState({ name: '', unit: 'kg', quantity: '', min_quantity: '5', unit_price: '' });

  useEffect(() => {
    loadAllAdminData();

    if (socket) {
      socket.on('tables:updated', loadAllAdminData);
      socket.on('menu:updated', loadAllAdminData);
      socket.on('inventory:updated', loadAllAdminData);
      socket.on('settings:updated', loadAllAdminData);
    }

    return () => {
      if (socket) {
        socket.off('tables:updated', loadAllAdminData);
        socket.off('menu:updated', loadAllAdminData);
        socket.off('inventory:updated', loadAllAdminData);
        socket.off('settings:updated', loadAllAdminData);
      }
    };
  }, []);

  async function loadAllAdminData() {
    try {
      const [tList, mList, iList, sData] = await Promise.all([
        api.getTables(),
        api.getMenuItems(),
        api.getInventory(),
        api.getSettings()
      ]);
      setTables(tList);
      setMenuItems(mList);
      setInventory(iList);
      setSettings(sData);
    } catch (err: any) {
      showMessage('error', err.message || 'Erro ao carregar dados do painel administrativo.');
    }
  }

  function showMessage(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  // ==========================================
  // HANDLERS: MESAS
  // ==========================================
  async function handleAddTable(e: React.FormEvent) {
    e.preventDefault();
    const num = parseInt(newTableNum, 10);
    if (isNaN(num) || num <= 0) {
      return showMessage('error', 'Informe um número de mesa válido.');
    }
    try {
      await api.addTable(num, newTableName);
      setNewTableNum('');
      setNewTableName('');
      showMessage('success', `Mesa ${num} adicionada com sucesso!`);
      loadAllAdminData();
    } catch (err: any) {
      showMessage('error', err.message || 'Erro ao adicionar mesa.');
    }
  }

  async function handleUpdateTable(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTable) return;
    const num = parseInt(editTableNum, 10);
    if (isNaN(num) || num <= 0) {
      return showMessage('error', 'Número de mesa inválido.');
    }
    try {
      await api.updateTable(editingTable.id, num, editTableName);
      setEditingTable(null);
      showMessage('success', 'Mesa atualizada com sucesso!');
      loadAllAdminData();
    } catch (err: any) {
      showMessage('error', err.message || 'Erro ao atualizar mesa.');
    }
  }

  async function handleDeleteTable(table: Table) {
    if (!window.confirm(`Tem certeza que deseja remover a Mesa ${table.number} (${table.name})?`)) return;
    try {
      await api.deleteTable(table.id);
      showMessage('success', `Mesa ${table.number} removida com sucesso.`);
      loadAllAdminData();
    } catch (err: any) {
      showMessage('error', err.message || 'Erro ao excluir mesa.');
    }
  }

  // ==========================================
  // HANDLERS: CARDÁPIO
  // ==========================================
  async function handleAddMenuItem(e: React.FormEvent) {
    e.preventDefault();
    const price = parseFloat(newMenuForm.price.replace(',', '.'));
    if (!newMenuForm.name || isNaN(price) || price < 0) {
      return showMessage('error', 'Preencha o nome e um preço válido.');
    }
    try {
      await api.addMenuItem({
        name: newMenuForm.name,
        description: newMenuForm.description,
        price,
        category: newMenuForm.category
      });
      setShowAddMenuModal(false);
      setNewMenuForm({ name: '', description: '', price: '', category: 'Pratos Principais' });
      showMessage('success', 'Item adicionado ao cardápio com sucesso!');
      loadAllAdminData();
    } catch (err: any) {
      showMessage('error', err.message || 'Erro ao adicionar item ao cardápio.');
    }
  }

  async function handleUpdateMenuItem(e: React.FormEvent) {
    e.preventDefault();
    if (!editingMenu) return;
    try {
      await api.updateMenuItem(editingMenu.id, {
        name: editingMenu.name,
        description: editingMenu.description,
        price: Number(editingMenu.price),
        category: editingMenu.category,
        active: editingMenu.active
      });
      setEditingMenu(null);
      showMessage('success', 'Item do cardápio atualizado!');
      loadAllAdminData();
    } catch (err: any) {
      showMessage('error', err.message || 'Erro ao atualizar item do cardápio.');
    }
  }

  async function handleDeleteMenuItem(item: MenuItem) {
    if (!window.confirm(`Deseja realmente remover o produto "${item.name}" do cardápio?`)) return;
    try {
      await api.deleteMenuItem(item.id);
      showMessage('success', 'Produto removido com sucesso!');
      loadAllAdminData();
    } catch (err: any) {
      showMessage('error', err.message || 'Erro ao excluir produto.');
    }
  }

  // ==========================================
  // HANDLERS: ESTOQUE
  // ==========================================
  async function handleAddInventory(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseFloat(newInvForm.quantity.replace(',', '.'));
    const min = parseFloat(newInvForm.min_quantity.replace(',', '.'));
    const cost = parseFloat(newInvForm.unit_price.replace(',', '.'));

    if (!newInvForm.name || isNaN(qty)) {
      return showMessage('error', 'Preencha o nome do insumo e a quantidade inicial.');
    }

    try {
      await api.addInventoryItem({
        name: newInvForm.name,
        unit: newInvForm.unit,
        quantity: qty,
        min_quantity: isNaN(min) ? 0 : min,
        unit_price: isNaN(cost) ? 0 : cost
      });
      setShowAddInvModal(false);
      setNewInvForm({ name: '', unit: 'kg', quantity: '', min_quantity: '5', unit_price: '' });
      showMessage('success', 'Insumo cadastrado no estoque!');
      loadAllAdminData();
    } catch (err: any) {
      showMessage('error', err.message || 'Erro ao adicionar insumo.');
    }
  }

  async function handleQuickRestock(id: string, amount: number) {
    try {
      await api.restockInventoryItem(id, amount);
      showMessage('success', `+${amount} adicionado ao estoque!`);
      loadAllAdminData();
    } catch (err: any) {
      showMessage('error', err.message || 'Erro ao repor estoque.');
    }
  }

  async function handleDeleteInventory(item: InventoryItem) {
    if (!window.confirm(`Deseja excluir o insumo "${item.name}" do estoque?`)) return;
    try {
      await api.deleteInventoryItem(item.id);
      showMessage('success', 'Insumo removido com sucesso!');
      loadAllAdminData();
    } catch (err: any) {
      showMessage('error', err.message || 'Erro ao remover insumo.');
    }
  }

  // ==========================================
  // HANDLERS: CONFIGURAÇÕES
  // ==========================================
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.updateSettings(settings);
      showMessage('success', 'Configurações do restaurante salvas com sucesso!');
      loadAllAdminData();
    } catch (err: any) {
      showMessage('error', err.message || 'Erro ao salvar configurações.');
    }
  }

  function togglePaymentMethod(methodKey: string) {
    if (methodKey === 'CASH') return; // Dinheiro é obrigatório por lei
    const allowed = [...settings.payment_methods_allowed];
    const index = allowed.indexOf(methodKey);
    if (index >= 0) {
      allowed.splice(index, 1);
    } else {
      allowed.push(methodKey);
    }
    setSettings({ ...settings, payment_methods_allowed: allowed });
  }

  // Categorias distintas para o filtro
  const categoriesList = Array.from(new Set(menuItems.map(m => m.category)));

  return (
    <div style={{ padding: '20px 16px', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* HEADER DO PAINEL ADMIN */}
      <div style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        borderRadius: '16px',
        padding: '24px',
        color: '#FFFFFF',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
        marginBottom: '24px',
        border: '1px solid #334155',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(236, 72, 153, 0.4)'
          }}>
            <Settings size={28} color="#FFFFFF" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
              Painel de Gestão & Customização Total
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94A3B8' }}>
              Personalize mesas, cardápio, preços, estoque e regras do estabelecimento
            </p>
          </div>
        </div>

        <button 
          onClick={loadAllAdminData}
          className="btn"
          style={{
            background: '#334155',
            color: '#F8FAFC',
            border: '1px solid #475569',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '0.85rem'
          }}
        >
          <RefreshCw size={16} />
          Atualizar Dados
        </button>
      </div>

      {/* MENSAGEM DE ALERTA / SUCESSO */}
      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: message.type === 'success' ? '#DCFCE7' : '#FEE2E2',
          color: message.type === 'success' ? '#166534' : '#991B1B',
          border: `1px solid ${message.type === 'success' ? '#86EFAC' : '#FCA5A5'}`,
          fontWeight: 600,
          fontSize: '0.9rem'
        }}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          {message.text}
        </div>
      )}

      {/* SUB-ABAS DE NAVEGAÇÃO DO ADMIN */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderBottom: '2px solid var(--border-light)',
        paddingBottom: '8px',
        overflowX: 'auto'
      }}>
        <button
          onClick={() => setActiveTab('tables')}
          className="btn"
          style={{
            background: activeTab === 'tables' ? '#0F172A' : 'transparent',
            color: activeTab === 'tables' ? '#F59E0B' : 'var(--text-secondary)',
            fontWeight: activeTab === 'tables' ? 700 : 500,
            padding: '10px 18px',
            borderRadius: '10px',
            fontSize: '0.9rem',
            border: activeTab === 'tables' ? '1px solid #F59E0B' : 'none'
          }}
        >
          <Grid size={18} />
          🪑 Mesas ({tables.length})
        </button>

        <button
          onClick={() => setActiveTab('menu')}
          className="btn"
          style={{
            background: activeTab === 'menu' ? '#0F172A' : 'transparent',
            color: activeTab === 'menu' ? '#F59E0B' : 'var(--text-secondary)',
            fontWeight: activeTab === 'menu' ? 700 : 500,
            padding: '10px 18px',
            borderRadius: '10px',
            fontSize: '0.9rem',
            border: activeTab === 'menu' ? '1px solid #F59E0B' : 'none'
          }}
        >
          <Utensils size={18} />
          🍔 Cardápio ({menuItems.length})
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className="btn"
          style={{
            background: activeTab === 'inventory' ? '#0F172A' : 'transparent',
            color: activeTab === 'inventory' ? '#F59E0B' : 'var(--text-secondary)',
            fontWeight: activeTab === 'inventory' ? 700 : 500,
            padding: '10px 18px',
            borderRadius: '10px',
            fontSize: '0.9rem',
            border: activeTab === 'inventory' ? '1px solid #F59E0B' : 'none'
          }}
        >
          <Package size={18} />
          📦 Estoque ({inventory.length})
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className="btn"
          style={{
            background: activeTab === 'settings' ? '#0F172A' : 'transparent',
            color: activeTab === 'settings' ? '#F59E0B' : 'var(--text-secondary)',
            fontWeight: activeTab === 'settings' ? 700 : 500,
            padding: '10px 18px',
            borderRadius: '10px',
            fontSize: '0.9rem',
            border: activeTab === 'settings' ? '1px solid #F59E0B' : 'none'
          }}
        >
          <Settings size={18} />
          ⚙️ Configurações & Pagamentos
        </button>
      </div>

      {/* ========================================================
          ABA 1: GESTÃO DE MESAS (ADICIONAR / EDITAR / EXCLUIR)
          ======================================================== */}
      {activeTab === 'tables' && (
        <div>
          {/* CARD DE ADICIONAR NOVA MESA */}
          <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} color="var(--accent-emerald)" />
              Adicionar Nova Mesa ao Restaurante
            </h3>
            <form onSubmit={handleAddTable} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1', minWidth: '140px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Número da Mesa *</label>
                <input
                  type="number"
                  placeholder="Ex: 15"
                  value={newTableNum}
                  onChange={(e) => setNewTableNum(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div style={{ flex: '2', minWidth: '220px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Nome Personalizado (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Mesa 15 - Varanda VIP"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  className="input"
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px', height: '42px' }}>
                <Plus size={16} /> Adicionar Mesa
              </button>
            </form>
          </div>

          {/* GRID DE MESAS EXISTENTES */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px'
          }}>
            {tables.map(table => (
              <div 
                key={table.id}
                className="card"
                style={{
                  padding: '16px',
                  borderLeft: `5px solid ${
                    table.status === 'FREE' ? '#10B981' : table.status === 'OCCUPIED' ? '#EF4444' : '#F59E0B'
                  }`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                      Mesa {String(table.number).padStart(2, '0')}
                    </h4>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{table.name}</span>
                  </div>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: table.status === 'FREE' ? '#DCFCE7' : table.status === 'OCCUPIED' ? '#FEE2E2' : '#FEF3C7',
                    color: table.status === 'FREE' ? '#166534' : table.status === 'OCCUPIED' ? '#991B1B' : '#92400E'
                  }}>
                    {table.status === 'FREE' ? 'LIVRE' : table.status === 'OCCUPIED' ? 'OCUPADA' : 'PAGAMENTO'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                  <button
                    onClick={() => {
                      setEditingTable(table);
                      setEditTableNum(String(table.number));
                      setEditTableName(table.name);
                    }}
                    className="btn btn-outline"
                    style={{ flex: 1, padding: '6px 10px', fontSize: '0.78rem' }}
                  >
                    <Edit size={14} /> Editar
                  </button>

                  <button
                    onClick={() => handleDeleteTable(table)}
                    className="btn"
                    style={{ background: '#FEE2E2', color: '#991B1B', border: 'none', padding: '6px 10px', fontSize: '0.78rem' }}
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* MODAL DE EDIÇÃO DE MESA */}
          {editingTable && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
            }}>
              <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Editar Mesa {editingTable.number}</h3>
                  <button onClick={() => setEditingTable(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleUpdateTable}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Número da Mesa</label>
                    <input
                      type="number"
                      value={editTableNum}
                      onChange={(e) => setEditTableNum(e.target.value)}
                      className="input"
                      required
                    />
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Nome de Exibição</label>
                    <input
                      type="text"
                      value={editTableName}
                      onChange={(e) => setEditTableName(e.target.value)}
                      className="input"
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" onClick={() => setEditingTable(null)} className="btn btn-outline" style={{ flex: 1 }}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Save size={16} /> Salvar</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          ABA 2: GESTÃO DO CARDÁPIO (PRODUTOS / PREÇOS / CATEGORIAS)
          ======================================================== */}
      {activeTab === 'menu' && (
        <div>
          {/* BARRA SUPERIOR DE PESQUISA E BOTÃO ADICIONAR */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '280px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder="Buscar produto por nome..."
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  className="input"
                  style={{ paddingLeft: '38px' }}
                />
              </div>

              <select
                value={menuCategoryFilter}
                onChange={(e) => setMenuCategoryFilter(e.target.value)}
                className="input"
                style={{ width: '180px' }}
              >
                <option value="ALL">Todas Categorias</option>
                {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <button onClick={() => setShowAddMenuModal(true)} className="btn btn-primary" style={{ padding: '10px 18px' }}>
              <Plus size={18} /> Novo Produto no Cardápio
            </button>
          </div>

          {/* LISTAGEM DOS ITENS DO CARDÁPIO */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#0F172A', color: '#F8FAFC' }}>
                  <th style={{ padding: '12px 16px' }}>Produto</th>
                  <th style={{ padding: '12px 16px' }}>Categoria</th>
                  <th style={{ padding: '12px 16px' }}>Preço R$</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {menuItems
                  .filter(m => menuCategoryFilter === 'ALL' || m.category === menuCategoryFilter)
                  .filter(m => m.name.toLowerCase().includes(menuSearch.toLowerCase()))
                  .map((item, idx) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-light)', background: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.description || 'Sem descrição'}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '12px', background: '#F1F5F9', color: '#475569', fontSize: '0.75rem', fontWeight: 600 }}>
                          {item.category}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#10B981', fontSize: '0.95rem' }}>
                        R$ {Number(item.price).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700,
                          background: item.active !== false ? '#DCFCE7' : '#FEE2E2',
                          color: item.active !== false ? '#166534' : '#991B1B'
                        }}>
                          {item.active !== false ? 'DISPONÍVEL' : 'INDISPONÍVEL'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => setEditingMenu(item)}
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', marginRight: '6px' }}
                        >
                          <Edit size={14} /> Editar / Mudar Preço
                        </button>
                        <button
                          onClick={() => handleDeleteMenuItem(item)}
                          className="btn"
                          style={{ background: '#FEE2E2', color: '#991B1B', padding: '4px 8px', fontSize: '0.75rem' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* MODAL NOVO PRODUTO */}
          {showAddMenuModal && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
            }}>
              <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Adicionar Novo Produto</h3>
                  <button onClick={() => setShowAddMenuModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                </div>
                <form onSubmit={handleAddMenuItem}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Nome do Prato / Bebida *</label>
                    <input type="text" placeholder="Ex: Picanha na Chapa 500g" value={newMenuForm.name} onChange={(e) => setNewMenuForm({ ...newMenuForm, name: e.target.value })} className="input" required />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Categoria *</label>
                    <input type="text" placeholder="Ex: Pratos Principais, Lanches, Drinks..." value={newMenuForm.category} onChange={(e) => setNewMenuForm({ ...newMenuForm, category: e.target.value })} className="input" required />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Preço de Venda (R$) *</label>
                    <input type="text" placeholder="Ex: 89.90" value={newMenuForm.price} onChange={(e) => setNewMenuForm({ ...newMenuForm, price: e.target.value })} className="input" required />
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Descrição Curta</label>
                    <textarea placeholder="Ex: Acompanha mandioca frita, farofa e vinagrete..." value={newMenuForm.description} onChange={(e) => setNewMenuForm({ ...newMenuForm, description: e.target.value })} className="input" style={{ height: '70px' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" onClick={() => setShowAddMenuModal(false)} className="btn btn-outline" style={{ flex: 1 }}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Save size={16} /> Salvar Produto</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL EDITAR PRODUTO / ALTERAR PREÇO */}
          {editingMenu && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
            }}>
              <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Editar Produto & Preço</h3>
                  <button onClick={() => setEditingMenu(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                </div>
                <form onSubmit={handleUpdateMenuItem}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Nome do Produto</label>
                    <input type="text" value={editingMenu.name} onChange={(e) => setEditingMenu({ ...editingMenu, name: e.target.value })} className="input" required />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Categoria</label>
                    <input type="text" value={editingMenu.category} onChange={(e) => setEditingMenu({ ...editingMenu, category: e.target.value })} className="input" required />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Preço Atual (R$)</label>
                    <input type="number" step="0.01" value={editingMenu.price} onChange={(e) => setEditingMenu({ ...editingMenu, price: parseFloat(e.target.value) })} className="input" required />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Descrição</label>
                    <textarea value={editingMenu.description} onChange={(e) => setEditingMenu({ ...editingMenu, description: e.target.value })} className="input" style={{ height: '70px' }} />
                  </div>
                  <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input type="checkbox" id="activeChk" checked={editingMenu.active !== false} onChange={(e) => setEditingMenu({ ...editingMenu, active: e.target.checked })} style={{ width: '18px', height: '18px' }} />
                    <label htmlFor="activeChk" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Item Disponível para Venda no Cardápio</label>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" onClick={() => setEditingMenu(null)} className="btn btn-outline" style={{ flex: 1 }}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Save size={16} /> Salvar Alterações</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          ABA 3: GESTÃO E REPOSIÇÃO DE ESTOQUE (INVENTORY)
          ======================================================== */}
      {activeTab === 'inventory' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Buscar insumo por nome..."
                value={invSearch}
                onChange={(e) => setInvSearch(e.target.value)}
                className="input"
                style={{ paddingLeft: '38px' }}
              />
            </div>

            <button onClick={() => setShowAddInvModal(true)} className="btn btn-primary" style={{ padding: '10px 18px' }}>
              <Plus size={18} /> Cadastrar Insumo no Estoque
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#0F172A', color: '#F8FAFC' }}>
                  <th style={{ padding: '12px 16px' }}>Insumo</th>
                  <th style={{ padding: '12px 16px' }}>Estoque Atual</th>
                  <th style={{ padding: '12px 16px' }}>Estoque Mínimo</th>
                  <th style={{ padding: '12px 16px' }}>Preço de Custo</th>
                  <th style={{ padding: '12px 16px' }}>Reposição Rápida</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {inventory
                  .filter(i => i.name.toLowerCase().includes(invSearch.toLowerCase()))
                  .map((item, idx) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-light)', background: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {item.name}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: item.quantity <= item.min_quantity ? '#EF4444' : '#10B981' }}>
                        {item.quantity} {item.unit}
                        {item.quantity <= item.min_quantity && (
                          <span style={{ marginLeft: '6px', fontSize: '0.7rem', background: '#FEE2E2', color: '#991B1B', padding: '2px 6px', borderRadius: '8px' }}>
                            BAIXO
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        {item.min_quantity} {item.unit}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        R$ {Number(item.unit_price || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => handleQuickRestock(item.id, 5)} className="btn btn-outline" style={{ padding: '2px 8px', fontSize: '0.72rem' }}>+5</button>
                          <button onClick={() => handleQuickRestock(item.id, 10)} className="btn btn-outline" style={{ padding: '2px 8px', fontSize: '0.72rem' }}>+10</button>
                          <button onClick={() => handleQuickRestock(item.id, 50)} className="btn btn-outline" style={{ padding: '2px 8px', fontSize: '0.72rem' }}>+50</button>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button onClick={() => handleDeleteInventory(item)} className="btn" style={{ background: '#FEE2E2', color: '#991B1B', padding: '4px 8px', fontSize: '0.75rem' }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* MODAL ADICIONAR INSUMO */}
          {showAddInvModal && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
            }}>
              <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Novo Insumo no Estoque</h3>
                  <button onClick={() => setShowAddInvModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                </div>
                <form onSubmit={handleAddInventory}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Nome do Insumo *</label>
                    <input type="text" placeholder="Ex: Queijo Cheddar Fatiado" value={newInvForm.name} onChange={(e) => setNewInvForm({ ...newInvForm, name: e.target.value })} className="input" required />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Unidade de Medida *</label>
                    <select value={newInvForm.unit} onChange={(e) => setNewInvForm({ ...newInvForm, unit: e.target.value })} className="input">
                      <option value="kg">Quilogramas (kg)</option>
                      <option value="g">Gramas (g)</option>
                      <option value="L">Litros (L)</option>
                      <option value="ml">Mililitros (ml)</option>
                      <option value="un">Unidades (un)</option>
                      <option value="pct">Pacote (pct)</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Quantidade Inicial *</label>
                    <input type="text" placeholder="Ex: 20" value={newInvForm.quantity} onChange={(e) => setNewInvForm({ ...newInvForm, quantity: e.target.value })} className="input" required />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Estoque Mínimo (Alerta)</label>
                    <input type="text" placeholder="Ex: 5" value={newInvForm.min_quantity} onChange={(e) => setNewInvForm({ ...newInvForm, min_quantity: e.target.value })} className="input" />
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Preço de Custo Unitário (R$)</label>
                    <input type="text" placeholder="Ex: 14.50" value={newInvForm.unit_price} onChange={(e) => setNewInvForm({ ...newInvForm, unit_price: e.target.value })} className="input" />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" onClick={() => setShowAddInvModal(false)} className="btn btn-outline" style={{ flex: 1 }}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Save size={16} /> Salvar Insumo</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          ABA 4: CONFIGURAÇÕES GERAIS E FORMAS DE PAGAMENTO
          ======================================================== */}
      {activeTab === 'settings' && (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <form onSubmit={handleSaveSettings} className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Building2 size={22} color="#F59E0B" />
              Configurações do Estabelecimento & Cupom Fiscal
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Nome do Restaurante</label>
                <input
                  type="text"
                  value={settings.restaurant_name}
                  onChange={(e) => setSettings({ ...settings, restaurant_name: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>CNPJ Comercial</label>
                <input
                  type="text"
                  value={settings.cnpj}
                  onChange={(e) => setSettings({ ...settings, cnpj: e.target.value })}
                  className="input"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Porcentagem Taxa de Serviço (%)</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={settings.service_tax_percent}
                  onChange={(e) => setSettings({ ...settings, service_tax_percent: Number(e.target.value) })}
                  className="input"
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Endereço Completo</label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="input"
              />
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '24px 0' }} />

            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CreditCard size={20} color="#3B82F6" />
              Formas de Pagamento Válidas no Caixa
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              
              {/* DINHEIRO (OBRIGATÓRIO) */}
              <div style={{
                padding: '14px', borderRadius: '12px', background: '#F1F5F9', border: '1px solid #CBD5E1',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>💵 Dinheiro em Espécie</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Obrigatório por Lei (Aceitação Fixa)</div>
                </div>
                <span style={{ padding: '4px 10px', background: '#DCFCE7', color: '#166534', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                  ATIVO (FIXO)
                </span>
              </div>

              {/* PIX */}
              <div 
                onClick={() => togglePaymentMethod('PIX')}
                style={{
                  padding: '14px', borderRadius: '12px',
                  background: settings.payment_methods_allowed.includes('PIX') ? '#ECFDF5' : '#F8FAFC',
                  border: `1px solid ${settings.payment_methods_allowed.includes('PIX') ? '#10B981' : '#E2E8F0'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>💚 PIX Instantâneo</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748B' }}>QR Code e Chave Pix</div>
                </div>
                {settings.payment_methods_allowed.includes('PIX') ? <ToggleRight size={28} color="#10B981" /> : <ToggleLeft size={28} color="#94A3B8" />}
              </div>

              {/* CARTÃO DE CRÉDITO */}
              <div 
                onClick={() => togglePaymentMethod('CREDIT_CARD')}
                style={{
                  padding: '14px', borderRadius: '12px',
                  background: settings.payment_methods_allowed.includes('CREDIT_CARD') ? '#EFF6FF' : '#F8FAFC',
                  border: `1px solid ${settings.payment_methods_allowed.includes('CREDIT_CARD') ? '#3B82F6' : '#E2E8F0'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>💳 Cartão de Crédito</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Maquininha de Crédito</div>
                </div>
                {settings.payment_methods_allowed.includes('CREDIT_CARD') ? <ToggleRight size={28} color="#3B82F6" /> : <ToggleLeft size={28} color="#94A3B8" />}
              </div>

              {/* CARTÃO DE DÉBITO */}
              <div 
                onClick={() => togglePaymentMethod('DEBIT_CARD')}
                style={{
                  padding: '14px', borderRadius: '12px',
                  background: settings.payment_methods_allowed.includes('DEBIT_CARD') ? '#EFF6FF' : '#F8FAFC',
                  border: `1px solid ${settings.payment_methods_allowed.includes('DEBIT_CARD') ? '#3B82F6' : '#E2E8F0'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>💳 Cartão de Débito</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Maquininha de Débito</div>
                </div>
                {settings.payment_methods_allowed.includes('DEBIT_CARD') ? <ToggleRight size={28} color="#3B82F6" /> : <ToggleLeft size={28} color="#94A3B8" />}
              </div>

            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}>
              <Save size={18} /> Salvar Todas as Configurações
            </button>
          </form>
        </div>
      )}

    </div>
  );
};
