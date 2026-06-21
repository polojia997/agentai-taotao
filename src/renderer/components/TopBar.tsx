import React, { useCallback, useState, useEffect } from 'react';
import { useStore, store } from '../store';
import { t, getLocale, setLocale, onLocaleChange, Locale } from '../i18n';
import DonateModal from './DonateModal';
import AboutModal from './AboutModal';

const TopBar: React.FC = () => {
  const state = useStore();
  const [showDonate, setShowDonate] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [locale, setLocaleState] = useState<Locale>(getLocale());

  useEffect(() => {
    return onLocaleChange(loc => setLocaleState(loc));
  }, []);

  const handleNewChat = useCallback(() => {
    store.clearChat();
    const tabId = `chat-${Date.now()}`;
    store.openTab({
      id: tabId,
      path: `chat://new`,
      name: t('topbar.newChat'),
      type: 'chat',
      isDirty: false,
    });
    store.addToast({ type: 'info', message: t('topbar.newChat') });
  }, []);

  const handleOpenFolder = useCallback(async () => {
    const { ipcRenderer } = window.require('electron');
    const result = await ipcRenderer.invoke('dialog:openFolder');
    if (!result.canceled && result.filePaths.length > 0) {
      store.setCurrentDir(result.filePaths[0]);
      store.addToast({ type: 'success', message: `已打开文件夹: ${result.filePaths[0]}` });
    }
  }, []);

  const handleOpenSettings = useCallback(() => {
    store.setSidebarTab('models');
  }, []);

  const handleToggleLanguage = useCallback(() => {
    setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN');
  }, [locale]);

  // 当前激活 tab 的名称（用于标题显示）
  const activeTab = state.openTabs.find(t => t.id === state.activeTabId);
  const titleText = activeTab ? activeTab.name : t('app.name');

  return (
    <div className="topbar">
      {/* 左侧：窗口控制占位（mac 风格预留） */}
      <div className="topbar-left">
        <div className="topbar-logo-icon">T</div>
        <span className="topbar-app-name">TAOTAO</span>
        <span className="topbar-sep">/</span>
        <span className="topbar-title">{titleText}</span>
      </div>

      <div className="topbar-spacer" />

      {/* 中部：模型选择 + Agent 模式紧凑显示 */}
      <div className="topbar-center">
        {state.activeModelId && (
          <div className="topbar-model-chip" title="当前激活模型">
            <span className="topbar-model-dot" />
            <span className="topbar-model-name">
              {state.models.find(m => m.id === state.activeModelId)?.name || '未选择'}
            </span>
          </div>
        )}
        <div className="topbar-mode-chip" title={`Agent 模式: ${state.agentMode}`}>
          <span>{state.agentMode === 'auto' ? '🔄' : state.agentMode === 'plan' ? '📋' : state.agentMode === 'agent' ? '🤖' : '💡'}</span>
          <span>{state.agentMode === 'auto' ? '自动' : state.agentMode === 'plan' ? '规划' : state.agentMode === 'agent' ? '智能体' : '问答'}</span>
        </div>
      </div>

      <div className="topbar-spacer" />

      {/* 右侧：操作按钮 */}
      <div className="topbar-right">
        <button className="topbar-icon-btn" onClick={handleNewChat} title={t('topbar.newChat')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
        <button className="topbar-icon-btn" onClick={handleOpenFolder} title="打开文件夹">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
        <button
          className={`topbar-icon-btn ${state.sidebarTab === 'models' ? 'active' : ''}`}
          onClick={handleOpenSettings}
          title={t('topbar.settings')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        <button className="topbar-icon-btn" onClick={handleToggleLanguage} title={t('topbar.language')}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{locale === 'zh-CN' ? '中' : 'EN'}</span>
        </button>
        <button className="topbar-icon-btn" onClick={() => setShowDonate(true)} title={t('topbar.donate')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
        <button className="topbar-icon-btn" onClick={() => setShowAbout(true)} title={t('topbar.about')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </button>
      </div>

      {showDonate && <DonateModal onClose={() => setShowDonate(false)} />}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  );
};

export default TopBar;
