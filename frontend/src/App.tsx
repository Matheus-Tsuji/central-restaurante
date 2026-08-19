import { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { WaiterScreen } from './components/WaiterScreen';
import { KitchenScreen } from './components/KitchenScreen';
import { CashierScreen } from './components/CashierScreen';
import { ReportsStockScreen } from './components/ReportsStockScreen';
import { offlineDb } from './services/offlineDb';
import { socket, joinRoom } from './services/socket';
import { api } from './services/api';

// Error Boundary para evitar telas totalmente em branco em caso de qualquer exceção
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          background: '#FAFCFE',
          fontFamily: 'sans-serif'
        }}>
          <div style={{
            background: '#FFFFFF',
            padding: '30px',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            maxWidth: '500px',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
          }}>
            <h2 style={{ color: '#0F172A', marginBottom: '10px' }}>Ocorreu um problema ao carregar a tela</h2>
            <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '20px' }}>
              {this.state.error?.message || 'Erro inesperado na renderização do componente.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#0284C7',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Recarregar Aplicação
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function AppContent() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState<number>(0);
  const location = useLocation();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (socket) {
      socket.on('connect', () => setIsOnline(true));
      socket.on('disconnect', () => setIsOnline(false));
    }

    checkOfflineCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // Entrar na sala do WebSocket com base na rota ativa
    const path = location.pathname;
    if (path.includes('/cozinha') || path.includes('/bar')) joinRoom('kitchen');
    if (path.includes('/garcom')) joinRoom('waiter');
    if (path.includes('/caixa')) joinRoom('cashier');
  }, [location.pathname]);

  async function checkOfflineCount() {
    if (!offlineDb) return;
    try {
      const pending = await offlineDb.offlineOrders.where('synced').equals(0).count();
      setOfflineCount(pending);
    } catch {
      setOfflineCount(0);
    }
  }

  async function handleSyncOffline() {
    if (!offlineDb) return;
    try {
      const pendingOrders = await offlineDb.offlineOrders.where('synced').equals(0).toArray();
      if (pendingOrders.length === 0) return;

      for (const pOrder of pendingOrders) {
        try {
          await api.createOrder(pOrder.table_id, pOrder.items, pOrder.offline_sync_id);
          await offlineDb.offlineOrders.update(pOrder.id!, { synced: 1 });
        } catch (err) {
          console.error('Erro ao sincronizar pedido offline:', err);
        }
      }

      checkOfflineCount();
    } catch (err) {
      console.error('Erro na sincronização em lote:', err);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Header
        isOnline={isOnline}
        offlineCount={offlineCount}
        onSyncOffline={handleSyncOffline}
      />

      <main style={{ paddingBottom: '40px' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/garcom" replace />} />
          <Route
            path="/garcom"
            element={<WaiterScreen isOnline={isOnline} onOrderCreated={checkOfflineCount} />}
          />
          <Route path="/cozinha" element={<KitchenScreen type="FOOD" />} />
          <Route path="/bar" element={<KitchenScreen type="BAR" />} />
          <Route path="/caixa" element={<CashierScreen />} />
          <Route path="/relatorios" element={<ReportsStockScreen />} />
          {/* Rota coringa para redirecionamento seguro */}
          <Route path="*" element={<Navigate to="/garcom" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default App;
