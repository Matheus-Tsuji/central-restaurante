import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Utensils, ChefHat, Receipt, BarChart3, Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface HeaderProps {
  isOnline: boolean;
  offlineCount: number;
  onSyncOffline: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isOnline,
  offlineCount,
  onSyncOffline
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname;

  return (
    <header style={{
      background: '#FFFFFF',
      borderBottom: '1px solid var(--border-light)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Brand / Logo */}
        <div 
          onClick={() => navigate('/garcom')}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
        >
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--accent-emerald) 0%, var(--accent-blue) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '1.2rem',
            boxShadow: '0 4px 12px rgba(5, 150, 105, 0.2)'
          }}>
            CR
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              Central Restaurante
            </h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Sistema Operacional Multi-telas
            </span>
          </div>
        </div>

        {/* NAVEGAÇÃO POR ROTAS DEDICADAS */}
        <nav style={{
          display: 'flex',
          background: 'var(--bg-subtle)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          gap: '4px'
        }}>
          <button
            onClick={() => navigate('/garcom')}
            className="btn"
            style={{
              background: currentPath.includes('/garcom') || currentPath === '/' ? '#FFFFFF' : 'transparent',
              color: currentPath.includes('/garcom') || currentPath === '/' ? 'var(--accent-blue)' : 'var(--text-secondary)',
              boxShadow: currentPath.includes('/garcom') || currentPath === '/' ? 'var(--shadow-sm)' : 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 16px',
              fontSize: '0.85rem'
            }}
          >
            <Utensils size={18} />
            Garçom (Mesas)
          </button>

          <button
            onClick={() => navigate('/cozinha')}
            className="btn"
            style={{
              background: currentPath.includes('/cozinha') ? '#FFFFFF' : 'transparent',
              color: currentPath.includes('/cozinha') ? 'var(--accent-emerald)' : 'var(--text-secondary)',
              boxShadow: currentPath.includes('/cozinha') ? 'var(--shadow-sm)' : 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 16px',
              fontSize: '0.85rem'
            }}
          >
            <ChefHat size={18} />
            Cozinha (KDS)
          </button>

          <button
            onClick={() => navigate('/caixa')}
            className="btn"
            style={{
              background: currentPath.includes('/caixa') ? '#FFFFFF' : 'transparent',
              color: currentPath.includes('/caixa') ? 'var(--accent-blue)' : 'var(--text-secondary)',
              boxShadow: currentPath.includes('/caixa') ? 'var(--shadow-sm)' : 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 16px',
              fontSize: '0.85rem'
            }}
          >
            <Receipt size={18} />
            Caixa / POS
          </button>

          <button
            onClick={() => navigate('/relatorios')}
            className="btn"
            style={{
              background: currentPath.includes('/relatorios') ? '#FFFFFF' : 'transparent',
              color: currentPath.includes('/relatorios') ? 'var(--accent-emerald)' : 'var(--text-secondary)',
              boxShadow: currentPath.includes('/relatorios') ? 'var(--shadow-sm)' : 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 16px',
              fontSize: '0.85rem'
            }}
          >
            <BarChart3 size={18} />
            Relatórios & Estoque
          </button>
        </nav>

        {/* Status Conexão / Sync Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {offlineCount > 0 && (
            <button
              onClick={onSyncOffline}
              className="btn btn-outline"
              style={{
                padding: '6px 12px',
                fontSize: '0.78rem',
                borderColor: '#F59E0B',
                color: '#B45309',
                background: '#FEF3C7'
              }}
              title="Clique para sincronizar pedidos pendentes do IndexedDB"
            >
              <RefreshCw size={14} />
              Sync Offline ({offlineCount})
            </button>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: 'var(--radius-full)',
            background: isOnline ? 'var(--accent-emerald-light)' : '#FEE2E2',
            color: isOnline ? 'var(--accent-emerald)' : '#991B1B',
            fontSize: '0.8rem',
            fontWeight: 600
          }}>
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            {isOnline ? 'Online' : 'Modo Offline'}
          </div>
        </div>
      </div>
    </header>
  );
};
