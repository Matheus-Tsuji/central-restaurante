import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Utensils, ChefHat, GlassWater, Receipt, BarChart3, Settings, Wifi, WifiOff, RefreshCw } from 'lucide-react';

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
      background: '#0F172A',
      borderBottom: '1px solid #334155',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
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
        {/* Brand / Logo Oficial CR */}
        <div 
          onClick={() => navigate('/garcom')}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
        >
          <img 
            src="/icon.png" 
            alt="Logo CR" 
            onError={(e) => {
              // Fallback para favicon.ico se icon.png falhar
              (e.target as HTMLImageElement).src = '/favicon.ico';
            }}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              objectFit: 'cover',
              border: '2px solid #F59E0B',
              boxShadow: '0 0 12px rgba(245, 158, 11, 0.4)',
              background: '#020617'
            }} 
          />
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#F8FAFC', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              Central Restaurante <span style={{ color: '#F59E0B', fontSize: '0.8rem', fontWeight: 700 }}>PRO</span>
            </h1>
            <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 500 }}>
              Sistema de Gestão & Operação Multi-telas
            </span>
          </div>
        </div>

        {/* Status Conexão / Sync Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {offlineCount > 0 && (
            <button
              onClick={onSyncOffline}
              className="btn"
              style={{
                padding: '4px 12px',
                fontSize: '0.75rem',
                borderColor: '#F59E0B',
                color: '#FEF3C7',
                background: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid #F59E0B',
                minHeight: '34px',
                borderRadius: '20px'
              }}
              title="Clique para sincronizar pedidos pendentes salvos offline"
            >
              <RefreshCw size={13} className="spin" />
              Sync ({offlineCount})
            </button>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: '20px',
            background: isOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: isOnline ? '1px solid #10B981' : '1px solid #EF4444',
            color: isOnline ? '#34D399' : '#FCA5A5',
            fontSize: '0.75rem',
            fontWeight: 700
          }}>
            {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
            {isOnline ? 'Online' : 'Offline'}
          </div>
        </div>

        {/* NAVEGAÇÃO COMPLETA DE ABAS (RESPONSIVA) */}
        <nav className="nav-tabs-mobile" style={{
          display: 'flex',
          background: '#1E293B',
          padding: '4px',
          borderRadius: '10px',
          gap: '4px',
          width: '100%',
          border: '1px solid #334155',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}>
          <button
            onClick={() => navigate('/garcom')}
            className="btn"
            style={{
              background: currentPath.includes('/garcom') || currentPath === '/' ? '#F59E0B' : 'transparent',
              color: currentPath.includes('/garcom') || currentPath === '/' ? '#0F172A' : '#94A3B8',
              fontWeight: currentPath.includes('/garcom') || currentPath === '/' ? 800 : 500,
              borderRadius: '8px',
              padding: '8px 14px',
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
              background: currentPath.includes('/cozinha') ? '#10B981' : 'transparent',
              color: currentPath.includes('/cozinha') ? '#0F172A' : '#94A3B8',
              fontWeight: currentPath.includes('/cozinha') ? 800 : 500,
              borderRadius: '8px',
              padding: '8px 14px',
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
              background: currentPath.includes('/bar') ? '#0284C7' : 'transparent',
              color: currentPath.includes('/bar') ? '#FFFFFF' : '#94A3B8',
              fontWeight: currentPath.includes('/bar') ? 800 : 500,
              borderRadius: '8px',
              padding: '8px 14px',
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
              background: currentPath.includes('/caixa') ? '#3B82F6' : 'transparent',
              color: currentPath.includes('/caixa') ? '#FFFFFF' : '#94A3B8',
              fontWeight: currentPath.includes('/caixa') ? 800 : 500,
              borderRadius: '8px',
              padding: '8px 14px',
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
              background: currentPath.includes('/relatorios') ? '#8B5CF6' : 'transparent',
              color: currentPath.includes('/relatorios') ? '#FFFFFF' : '#94A3B8',
              fontWeight: currentPath.includes('/relatorios') ? 800 : 500,
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '0.82rem',
              whiteSpace: 'nowrap',
              minHeight: '38px',
              flex: 1
            }}
          >
            <BarChart3 size={16} />
            Relatórios
          </button>

          <button
            onClick={() => navigate('/admin')}
            className="btn"
            style={{
              background: currentPath.includes('/admin') ? '#EC4899' : 'transparent',
              color: currentPath.includes('/admin') ? '#FFFFFF' : '#94A3B8',
              fontWeight: currentPath.includes('/admin') ? 800 : 500,
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '0.82rem',
              whiteSpace: 'nowrap',
              minHeight: '38px',
              flex: 1
            }}
          >
            <Settings size={16} />
            Gestão & Admin
          </button>
        </nav>
      </div>
    </header>
  );
};
