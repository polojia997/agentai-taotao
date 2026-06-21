import React, { useCallback } from 'react';
import { useStore, store } from './store';
import { AppState, OpenTab, ContextMenuOption } from './types';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import ContentArea from './components/ContentArea';
import StatusBar from './components/StatusBar';

const App: React.FC = () => {
  const state = useStore();
  const { toasts } = state;

  // 关闭 Toast
  const dismissToast = useCallback((id: string) => {
    store.removeToast(id);
  }, []);

  return (
    <div className="app-container">
      {/* 顶部标题栏 */}
      <TopBar />

      {/* 主区域 */}
      <div className="main-area">
        {/* 侧边栏 */}
        <Sidebar />

        {/* 内容区 */}
        <ContentArea />
      </div>

      {/* 状态栏 */}
      <StatusBar />

      {/* Toast 通知 */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`toast ${toast.type}`}
            onClick={() => dismissToast(toast.id)}
          >
            <span>
              {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✗' : 'ℹ'}
            </span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;