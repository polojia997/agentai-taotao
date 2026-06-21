import React, { useCallback } from 'react';
import { useStore, store } from '../store';
import { OpenTab } from '../types';
import ChatPanel from './ChatPanel';
import MonacoEditor from './MonacoEditor';
import PreviewPanel from './PreviewPanel';
import Terminal from './Terminal';

const TAB_ICONS: Record<string, string> = {
  code: '📄',
  image: '🖼',
  video: '🎬',
  model: '🧊',
  diff: '📊',
  chat: '💬',
};

const ContentArea: React.FC = () => {
  const state = useStore();
  const { openTabs, activeTabId } = state;

  const activeTab = openTabs.find(t => t.id === activeTabId) || null;

  const handleCloseTab = useCallback((e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    store.closeTab(tabId);
  }, []);

  const renderTabContent = () => {
    if (!activeTab) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ fontSize: 64 }}>T</div>
          <div className="empty-state-text" style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-primary)' }}>
            欢迎使用 TAOTAO
          </div>
          <div className="empty-state-hint">
            按 Ctrl+N 新建对话 | 拖动文件夹到此处打开
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            <button
              className="topbar-btn"
              style={{ padding: '8px 20px', fontSize: 13 }}
              onClick={() => {
                store.clearChat();
                const tabId = `chat-${Date.now()}`;
                store.openTab({
                  id: tabId,
                  path: `chat://new`,
                  name: '新对话',
                  type: 'chat',
                  isDirty: false,
                });
              }}
            >
              💬 开始新对话
            </button>
            <button
              className="topbar-btn"
              style={{ padding: '8px 20px', fontSize: 13 }}
              onClick={async () => {
                const { ipcRenderer } = window.require('electron');
                const result = await ipcRenderer.invoke('dialog:openFolder');
                if (!result.canceled && result.filePaths.length > 0) {
                  store.setCurrentDir(result.filePaths[0]);
                }
              }}
            >
              📂 打开文件夹
            </button>
          </div>
        </div>
      );
    }

    switch (activeTab.type) {
      case 'chat':
        return <ChatPanel tabId={activeTab.id} />;
      case 'code':
        return <MonacoEditor filePath={activeTab.path} />;
      case 'image':
      case 'video':
      case 'model':
        return <PreviewPanel filePath={activeTab.path} type={activeTab.type} />;
      case 'diff':
        return <MonacoEditor filePath={activeTab.path} diffMode />;
      default:
        return <MonacoEditor filePath={activeTab.path} />;
    }
  };

  return (
    <div className="content-area">
      {/* 标签栏 */}
      <div className="content-tabs">
        {openTabs.map(tab => (
          <button
            key={tab.id}
            className={`content-tab ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => store.setActiveTab(tab.id)}
            title={tab.path}
          >
            <span>{TAB_ICONS[tab.type] || '📄'}</span>
            <span>{tab.name}</span>
            {tab.isDirty && <span style={{ color: 'var(--accent-warning)' }}>●</span>}
            <span
              className="content-tab-close"
              onClick={(e) => handleCloseTab(e, tab.id)}
            >
              ✕
            </span>
          </button>
        ))}
      </div>

      {/* 内容体 */}
      <div className="content-body">
        {renderTabContent()}
      </div>

      {/* 底部终端 (始终可见) */}
      <div style={{ height: 200, flexShrink: 0, borderTop: '1px solid var(--border-color)' }}>
        <Terminal />
      </div>
    </div>
  );
};

export default ContentArea;