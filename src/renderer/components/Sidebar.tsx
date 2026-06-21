import React, { useCallback } from 'react';
import { useStore, store } from '../store';
import { AppState } from '../types';
import FileExplorer from './FileExplorer';
import SearchPanel from './SearchPanel';
import ModelConfig from './ModelConfig';
import SkillsPanel from './SkillsPanel';

// Codex 风格 SVG 线性图标
const Icon = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const SIDEBAR_TABS: { key: AppState['sidebarTab']; label: string; icon: React.ReactNode }[] = [
  {
    key: 'files',
    label: '文件',
    icon: <Icon d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
  },
  {
    key: 'search',
    label: '搜索',
    icon: <Icon d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35" />,
  },
  {
    key: 'plan',
    label: '计划',
    icon: <Icon d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />,
  },
  {
    key: 'agents',
    label: '代理',
    icon: <Icon d="M12 2a3 3 0 0 0-3 3v.5A3 3 0 0 0 6 8.5V9a3 3 0 0 0-3 3v.5A3 3 0 0 0 0 15.5V18a3 3 0 0 0 3 3h18a3 3 0 0 0 3-3v-2.5a3 3 0 0 0-3-3V12a3 3 0 0 0-3-3V8.5A3 3 0 0 0 15 5.5V5a3 3 0 0 0-3-3z" />,
  },
  {
    key: 'models',
    label: '模型',
    icon: <Icon d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />,
  },
  {
    key: 'audit',
    label: '审计',
    icon: <Icon d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  },
  {
    key: 'skills',
    label: '技能',
    icon: <Icon d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
  },
  {
    key: 'git',
    label: 'Git',
    icon: <Icon d="M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9" />,
  },
];

const Sidebar: React.FC = () => {
  const state = useStore();

  const switchTab = useCallback((tab: AppState['sidebarTab']) => {
    store.setSidebarTab(tab);
  }, []);

  const currentTab = SIDEBAR_TABS.find(t => t.key === state.sidebarTab) || SIDEBAR_TABS[0];

  const renderContent = () => {
    switch (state.sidebarTab) {
      case 'files':
        return <FileExplorer />;
      case 'search':
        return <SearchPanel />;
      case 'plan':
        return (
          <div className="sidebar-content">
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-text">计划模式</div>
              <div className="empty-state-hint">在聊天框输入 <code>/plan &lt;任务&gt;</code> 启用</div>
            </div>
          </div>
        );
      case 'agents':
        return (
          <div className="sidebar-content">
            <div className="empty-state">
              <div className="empty-state-icon">🤖</div>
              <div className="empty-state-text">多代理</div>
              <div className="empty-state-hint">可在聊天中并行委派子任务</div>
            </div>
          </div>
        );
      case 'models':
        return <ModelConfig />;
      case 'audit':
        return (
          <div className="sidebar-content">
            <div className="empty-state">
              <div className="empty-state-icon">🛡️</div>
              <div className="empty-state-text">审计日志</div>
              <div className="empty-state-hint">在聊天框输入 <code>/audit</code> 查看</div>
            </div>
          </div>
        );
      case 'skills':
        return <SkillsPanel />;
      case 'git':
        return (
          <div className="sidebar-content">
            <div className="empty-state">
              <div className="empty-state-icon">⎇</div>
              <div className="empty-state-text">Git 版本控制</div>
              <div className="empty-state-hint">请在文件夹中初始化 Git 仓库</div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* 极窄活动栏：仅 SVG 图标（Codex 风格） */}
      <div className="activity-bar">
        {SIDEBAR_TABS.map(tab => (
          <div
            key={tab.key}
            className={`activity-item ${state.sidebarTab === tab.key ? 'active' : ''}`}
            onClick={() => switchTab(tab.key)}
            title={tab.label}
          >
            {tab.icon}
          </div>
        ))}
      </div>

      {/* 侧边面板 */}
      <div className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-header-title">{currentTab.label}</span>
          <span className="sidebar-header-brand">TAOTAO</span>
        </div>
        <div className="sidebar-content">
          {renderContent()}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
