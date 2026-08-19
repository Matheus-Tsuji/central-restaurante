import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Utensils, ChefHat, GlassWater, Receipt, BarChart3, Wifi, WifiOff, RefreshCw } from 'lucide-react';

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
      boxShadow: 'var(--shadow-sm)',
      width: '100%'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Brand / Logo */}
        <div 
          onClick={() => navigate('/garcom')}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        >
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--accent-emerald) 0%, var(--accent-blue) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '1.1rem',
            boxShadow: '0 4px 12px rgba(5, 150, 105, 0.2)'
          }}>
            CR
          </div>
          <div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              Central Restaurante
            </h1>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Sistema Operacional Multi-telas
            </span>
          </div>
        </div>

        {/* Status Conexão / Sync Badge no Topo em Telas Perto da Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {offlineCount > 0 && (
            <button
              onClick={onSyncOffline}
              className="btn btn-outline"
              style={{
                padding: '4px 10px',
                fontSize: '0.75rem',
                borderColor: '#F59E0B',
                color: '#B45309',
                background: '#FEF3C7',
                minHeight: '34px'
              }}
              title="Clique para sincronizar pedidos pendentes do IndexedDB"
            >
              <RefreshCw size={13} />
              Sync ({offlineCount})
            </button>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            background: isOnline ? 'var(--accent-emerald-light)' : '#FEE2E2',
            color: isOnline ? 'var(--accent-emerald)' : '#991B1B',
            fontSize: '0.75rem',
            fontWeight: 700
          }}>
            {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
            {isOnline ? 'Online' : 'Offline'}
          </div>
        </div>

        {/* NAVEGAÇÃO ROLÁVEL NO CELULAR (FULL MOBILE TOUCH BAR) */}
        <nav className="nav-tabs-mobile" style={{
          display: 'flex',
          background: 'var(--bg-subtle)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          gap: '4px',
          width: '100%',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}>
          <button
            onClick={() => navigate('/garcom')}
            className="btn"
            style={{
              background: currentPath.includes('/garcom') || currentPath === '/' ? '#FFFFFF' : 'transparent',
              color: currentPath.includes('/garcom') || currentPath === '/' ? 'var(--accent-blue)' : 'var(--text-secondary)',
              boxShadow: currentPath.includes('/garcom') || currentPath === '/' ? 'var(--shadow-sm)' : 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              fontSize: '0.82rem',
              whiteSpace: 'nowrap',
              minHeight: '38px',
              flex: 1
            }}
          >
            <Utensils size={16} />
            Garçom
          </button>

          <button
            onClick={() => navigate('/cozinha')}
            className="btn"
            style={{
              background: currentPath.includes('/cozinha') ? '#FFFFFF' : 'transparent',
              color: currentPath.includes('/cozinha') ? 'var(--accent-emerald)' : 'var(--text-secondary)',
              boxShadow: currentPath.includes('/cozinha') ? 'var(--shadow-sm)' : 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              fontSize: '0.82rem',
              whiteSpace: 'nowrap',
              minHeight: '38px',
              flex: 1
            }}
          >
            <ChefHat size={16} />
            Cozinha
          </button>

          <button
            onClick={() => navigate('/bar')}
            className="btn"
            style={{
              background: currentPath.includes('/bar') ? '#FFFFFF' : 'transparent',
              color: currentPath.includes('/bar') ? '#0284C7' : 'var(--text-secondary)',
              boxShadow: currentPath.includes('/bar') ? 'var(--shadow-sm)' : 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              fontSize: '0.82rem',
              whiteSpace: 'nowrap',
              minHeight: '38px',
              flex: 1
            }}
          >
            <GlassWater size={16} />
            Bar
          </button>

          <button
            onClick={() => navigate('/caixa')}
            className="btn"
            style={{
              background: currentPath.includes('/caixa') ? '#FFFFFF' : 'transparent',
              color: currentPath.includes('/caixa') ? 'var(--accent-blue)' : 'var(--text-secondary)',
              boxShadow: currentPath.includes('/caixa') ? 'var(--shadow-sm)' : 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              fontSize: '0.82rem',
              whiteSpace: 'nowrap',
              minHeight: '38px',
              flex: 1
            }}
          >
            <Receipt size={16} />
            Caixa
          </button>

          <button
            onClick={() => navigate('/relatorios')}
            className="btn"
            style={{
              background: currentPath.includes('/relatorios') ? '#FFFFFF' : 'transparent',
              color: currentPath.includes('/relatorios') ? 'var(--accent-emerald)' : 'var(--text-secondary)',
              boxShadow: currentPath.includes('/relatorios') ? 'var(--shadow-sm)' : 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              fontSize: '0.82rem',
              whiteSpace: 'nowrap',
              minHeight: '38px',
              flex: 1
            }}
          >
            <BarChart3 size={16} />
            Relatórios
          </button>
        </nav>
      </div>
    </header>
  );
};
