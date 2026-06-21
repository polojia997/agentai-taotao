import React, { useCallback, useState } from 'react';
import { useStore, store } from '../store';
import { ModelConfig as ModelConfigType } from '../types';

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
  ollama: 'Ollama (本地)',
  agnes: 'Agnes AI',
  zhipu: '智谱GLM',
  siliconflow: '硅基流动',
  groq: 'Groq',
  qianfan: '百度千帆',
  dashscope: '阿里百炼',
  github: 'GitHub Models',
  custom: '自定义',
};

const ModelConfig: React.FC = () => {
  const state = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // 新模型表单
  const [newModel, setNewModel] = useState<Partial<ModelConfigType>>({
    name: '',
    provider: 'custom',
    apiUrl: '',
    apiKey: '',
    modelName: '',
    maxTokens: 4096,
    temperature: 0.7,
  });

  const handleActivate = useCallback((id: string) => {
    store.setActiveModel(id === state.activeModelId ? null : id);
    if (id !== state.activeModelId) {
      store.addToast({ type: 'success', message: `已激活模型: ${state.models.find(m => m.id === id)?.name}` });
    }
  }, [state.activeModelId]);

  const handleDelete = useCallback((id: string) => {
    store.deleteModel(id);
    store.addToast({ type: 'info', message: '已删除模型配置' });
  }, []);

  const handleAddModel = useCallback(() => {
    if (!newModel.name || !newModel.apiUrl || !newModel.modelName) {
      store.addToast({ type: 'error', message: '请填写模型名称、API地址和模型名' });
      return;
    }

    const model: ModelConfigType = {
      id: `model-${Date.now()}`,
      name: newModel.name || '',
      provider: newModel.provider || 'custom',
      apiUrl: newModel.apiUrl || '',
      apiKey: newModel.apiKey || '',
      modelName: newModel.modelName || '',
      maxTokens: newModel.maxTokens || 4096,
      temperature: newModel.temperature || 0.7,
      isActive: false,
      strength: newModel.strength || 'medium',
    };

    store.addModel(model);
    setShowAddForm(false);
    setNewModel({
      name: '',
      provider: 'custom',
      apiUrl: '',
      apiKey: '',
      modelName: '',
      maxTokens: 4096,
      temperature: 0.7,
    });
    store.addToast({ type: 'success', message: '已添加模型配置' });
  }, [newModel]);

  const handleQuickSetup = useCallback((provider: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'agnes') => {
    const existingAgnes = state.models.find(m => m.provider === 'agnes' && m.apiKey);
    const presets: Record<string, Partial<ModelConfigType>> = {
      openai: {
        name: 'OpenAI',
        provider: 'openai',
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        modelName: 'gpt-4o',
        maxTokens: 4096,
        temperature: 0.7,
        strength: 'high',
      },
      anthropic: {
        name: 'Anthropic Claude',
        provider: 'anthropic',
        apiUrl: 'https://api.anthropic.com/v1/messages',
        modelName: 'claude-3-5-sonnet-20241022',
        maxTokens: 4096,
        temperature: 0.7,
        strength: 'high',
      },
      gemini: {
        name: 'Google Gemini',
        provider: 'gemini',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
        modelName: 'gemini-2.0-flash-exp',
        maxTokens: 8192,
        temperature: 0.7,
        strength: 'medium',
      },
      ollama: {
        name: 'Ollama 本地',
        provider: 'ollama',
        apiUrl: 'http://localhost:11434/api/chat',
        modelName: 'qwen2.5:7b',
        maxTokens: 4096,
        temperature: 0.7,
        strength: 'low',
      },
      agnes: {
        name: 'Agnes AI',
        provider: 'agnes',
        apiUrl: 'https://apihub.agnes-ai.com/v1/chat/completions',
        modelName: 'agnes-2.0-flash',
        maxTokens: 65536,
        temperature: 0.7,
        strength: 'medium',
      },
    };

    setNewModel({ ...presets[provider], apiKey: provider === 'agnes' ? (existingAgnes?.apiKey || '') : '' });
    setShowAddForm(true);
  }, []);

  // 快捷添加 Agnes 全部模型
  const handleAddAgnesModel = useCallback((modelType: 'text' | 'image21' | 'image20' | 'video') => {
    // 自动复用已有的 Agnes API Key
    const existingAgnes = state.models.find(m => m.provider === 'agnes' && m.apiKey);
    const presets: Record<string, Partial<ModelConfigType>> = {
      text: {
        name: 'Agnes 2.0 Flash (文本)',
        provider: 'agnes',
        apiUrl: 'https://apihub.agnes-ai.com/v1/chat/completions',
        modelName: 'agnes-2.0-flash',
        maxTokens: 65536,
        temperature: 0.7,
        strength: 'medium',
      },
      image21: {
        name: 'Agnes Image 2.1 Flash (文生图)',
        provider: 'agnes',
        apiUrl: 'https://apihub.agnes-ai.com/v1/images/generations',
        modelName: 'agnes-image-2.1-flash',
        maxTokens: 4096,
        temperature: 0.7,
        strength: 'high',
      },
      image20: {
        name: 'Agnes Image 2.0 Flash (图生图)',
        provider: 'agnes',
        apiUrl: 'https://apihub.agnes-ai.com/v1/images/generations',
        modelName: 'agnes-image-2.0-flash',
        maxTokens: 4096,
        temperature: 0.7,
        strength: 'high',
      },
      video: {
        name: 'Agnes Video V2.0 (视频生成)',
        provider: 'agnes',
        apiUrl: 'https://apihub.agnes-ai.com/v1/videos',
        modelName: 'agnes-video-v2.0',
        maxTokens: 4096,
        temperature: 0.7,
        strength: 'high',
      },
    };
    setNewModel({ ...presets[modelType], apiKey: existingAgnes?.apiKey || '' });
    setShowAddForm(true);
  }, []);

  // 快捷添加免费模型
  const handleAddFreeModel = useCallback((provider: string) => {
    const presets: Record<string, Partial<ModelConfigType>> = {
      zhipu: {
        name: '智谱 GLM-4-Flash (免费)',
        provider: 'zhipu',
        apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        modelName: 'glm-4-flash',
        maxTokens: 8192,
        temperature: 0.7,
        strength: 'medium',
      },
      siliconflow: {
        name: '硅基流动 Qwen2.5-7B (免费)',
        provider: 'siliconflow',
        apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
        modelName: 'Qwen/Qwen2.5-7B-Instruct',
        maxTokens: 4096,
        temperature: 0.7,
        strength: 'medium',
      },
      groq: {
        name: 'Groq Llama 3.3 70B (免费)',
        provider: 'groq',
        apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
        modelName: 'llama-3.3-70b-versatile',
        maxTokens: 4096,
        temperature: 0.7,
        strength: 'high',
      },
      qianfan: {
        name: '百度 ERNIE-Speed (免费)',
        provider: 'qianfan',
        apiUrl: 'https://qianfan.baidubce.com/v2/chat/completions',
        modelName: 'ernie-speed-8k',
        maxTokens: 4096,
        temperature: 0.7,
        strength: 'medium',
      },
      dashscope: {
        name: '阿里 Qwen Turbo (免费)',
        provider: 'dashscope',
        apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        modelName: 'qwen-turbo',
        maxTokens: 4096,
        temperature: 0.7,
        strength: 'medium',
      },
      github: {
        name: 'GitHub Models GPT-4o Mini (免费)',
        provider: 'github',
        apiUrl: 'https://models.inference.ai.azure.com/chat/completions',
        modelName: 'gpt-4o-mini',
        maxTokens: 4096,
        temperature: 0.7,
        strength: 'high',
      },
    };
    setNewModel({ ...presets[provider], apiKey: '' });
    setShowAddForm(true);
  }, []);

  const renderProviderBadge = (provider: string) => {
    const colors: Record<string, string> = {
      openai: '#10a37f',
      anthropic: '#d97706',
      gemini: '#4285f4',
      ollama: '#6366f1',
      agnes: '#a855f7',
      zhipu: '#3b82f6',
      siliconflow: '#10b981',
      groq: '#f97316',
      qianfan: '#8b5cf6',
      dashscope: '#06b6d4',
      github: '#6366f1',
      custom: '#6e6e8a',
    };
    return (
      <span
        className="model-card-type"
        style={{ background: colors[provider] || colors.custom, color: 'white' }}
      >
        {PROVIDER_LABELS[provider] || provider}
      </span>
    );
  };

  return (
    <div className="model-config">
      <div className="model-config-title">🤖 模型配置</div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
        配置你的 AI 模型，支持 OpenAI、Anthropic、Google Gemini、Ollama 及任何兼容 API
      </p>

      {/* 快捷添加 */}
      {!showAddForm && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>快捷添加:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <button className="model-card-btn" onClick={() => handleQuickSetup('openai')}>
              + OpenAI
            </button>
            <button className="model-card-btn" onClick={() => handleQuickSetup('anthropic')}>
              + Claude
            </button>
            <button className="model-card-btn" onClick={() => handleQuickSetup('gemini')}>
              + Gemini
            </button>
            <button className="model-card-btn" onClick={() => handleQuickSetup('ollama')}>
              + Ollama
            </button>
            <button className="model-card-btn" onClick={() => handleQuickSetup('agnes')}>
              + Agnes
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--accent-success)', marginTop: 8, marginBottom: 4 }}>
            免费模型 (注册即用):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <button className="model-card-btn" style={{ borderColor: '#3b82f6' }} onClick={() => handleAddFreeModel('zhipu')}>
              + 智谱GLM
            </button>
            <button className="model-card-btn" style={{ borderColor: '#10b981' }} onClick={() => handleAddFreeModel('siliconflow')}>
              + 硅基流动
            </button>
            <button className="model-card-btn" style={{ borderColor: '#f97316' }} onClick={() => handleAddFreeModel('groq')}>
              + Groq
            </button>
            <button className="model-card-btn" style={{ borderColor: '#8b5cf6' }} onClick={() => handleAddFreeModel('qianfan')}>
              + 百度千帆
            </button>
            <button className="model-card-btn" style={{ borderColor: '#06b6d4' }} onClick={() => handleAddFreeModel('dashscope')}>
              + 阿里百炼
            </button>
            <button className="model-card-btn" style={{ borderColor: '#6366f1' }} onClick={() => handleAddFreeModel('github')}>
              + GitHub
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            注册地址: bigmodel.cn | siliconflow.cn | console.groq.com | console.bce.baidu.com | dashscope.aliyun.com | github.com/settings/tokens
          </div>
          {/* Groq API Key 用于语音识别 */}
          <div style={{ marginTop: 10, padding: 8, background: 'var(--bg-hover)', borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              🎤 语音识别 Groq API Key (免费注册: console.groq.com)
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                className="model-card-input"
                type="password"
                value={state.groqApiKey}
                onChange={(e) => store.setGroqApiKey(e.target.value)}
                placeholder="输入 Groq API Key 启用语音识别..."
                style={{ flex: 1 }}
              />
              <button
                className="model-card-btn"
                onClick={() => {
                  store.setGroqApiKey('');
                  store.addToast({ type: 'info', message: '已清除 Groq API Key' });
                }}
                style={{ whiteSpace: 'nowrap' }}
              >
                清除
              </button>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--accent-success)', marginTop: 8, marginBottom: 4 }}>
            Agnes AI 全部模型 (免费):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <button className="model-card-btn" style={{ borderColor: '#a855f7' }} onClick={() => handleAddAgnesModel('text')}>
              + Agnes 文本
            </button>
            <button className="model-card-btn" style={{ borderColor: '#06b6d4' }} onClick={() => handleAddAgnesModel('image21')}>
              + Agnes 文生图
            </button>
            <button className="model-card-btn" style={{ borderColor: '#f59e0b' }} onClick={() => handleAddAgnesModel('image20')}>
              + Agnes 图生图
            </button>
            <button className="model-card-btn" style={{ borderColor: '#ef4444' }} onClick={() => handleAddAgnesModel('video')}>
              + Agnes 视频
            </button>
          </div>
        </div>
      )}

      {/* 模型列表 */}
      {state.models.map(model => (
        <div
          key={model.id}
          className={`model-card ${model.id === state.activeModelId ? 'active-model' : ''}`}
        >
          <div className="model-card-header">
            <div className="model-card-name">{model.name}</div>
            {renderProviderBadge(model.provider)}
          </div>

          {editingId === model.id ? (
            <div>
              <div className="model-card-field">
                <div className="model-card-label">模型名称</div>
                <input
                  className="model-card-input"
                  value={model.name}
                  onChange={(e) => store.updateModel(model.id, { name: e.target.value })}
                />
              </div>
              <div className="model-card-field">
                <div className="model-card-label">API 地址</div>
                <input
                  className="model-card-input"
                  value={model.apiUrl}
                  onChange={(e) => store.updateModel(model.id, { apiUrl: e.target.value })}
                />
              </div>
              <div className="model-card-field">
                <div className="model-card-label">API Key</div>
                <input
                  className="model-card-input"
                  type="password"
                  value={model.apiKey}
                  onChange={(e) => store.updateModel(model.id, { apiKey: e.target.value })}
                  placeholder="输入 API Key..."
                />
              </div>
              <div className="model-card-field">
                <div className="model-card-label">模型标识</div>
                <input
                  className="model-card-input"
                  value={model.modelName}
                  onChange={(e) => store.updateModel(model.id, { modelName: e.target.value })}
                />
              </div>
              <div className="model-card-field">
                <div className="model-card-label">最大 Token</div>
                <input
                  className="model-card-input"
                  type="number"
                  value={model.maxTokens}
                  onChange={(e) => store.updateModel(model.id, { maxTokens: parseInt(e.target.value) || 4096 })}
                />
              </div>
              <div className="model-card-field">
                <div className="model-card-label">温度 ({model.temperature})</div>
                <input
                  className="model-card-input"
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={model.temperature}
                  onChange={(e) => store.updateModel(model.id, { temperature: parseFloat(e.target.value) })}
                  style={{ padding: 0 }}
                />
              </div>
              <div className="model-card-field">
                <div className="model-card-label">模型强度</div>
                <select
                  className="model-card-select"
                  value={model.strength || 'medium'}
                  onChange={(e) => store.updateModel(model.id, { strength: e.target.value as 'low' | 'medium' | 'high' })}
                >
                  <option value="low">🐣 低 - 快速便宜</option>
                  <option value="medium">⭐ 中 - 均衡表现</option>
                  <option value="high">⚡ 高 - 最强能力</option>
                </select>
              </div>
              <div className="model-card-actions">
                <button className="model-card-btn primary" onClick={() => setEditingId(null)}>
                  完成
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                {model.apiUrl} | {model.modelName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>强度:</span>
                <select
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    fontSize: 11,
                    padding: '2px 6px',
                    cursor: 'pointer',
                  }}
                  value={model.strength || 'medium'}
                  onChange={(e) => store.updateModel(model.id, { strength: e.target.value as 'low' | 'medium' | 'high' })}
                >
                  <option value="low">🐣 低</option>
                  <option value="medium">⭐ 中</option>
                  <option value="high">⚡ 高</option>
                </select>
              </div>
              <div className="model-card-actions">
                <button
                  className={`model-card-btn ${model.id === state.activeModelId ? 'danger' : 'primary'}`}
                  onClick={() => handleActivate(model.id)}
                >
                  {model.id === state.activeModelId ? '取消激活' : '激活'}
                </button>
                <button className="model-card-btn" onClick={() => setEditingId(model.id)}>
                  编辑
                </button>
                <button className="model-card-btn danger" onClick={() => handleDelete(model.id)}>
                  删除
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* 添加新模型 */}
      {showAddForm ? (
        <div className="model-card" style={{ borderColor: 'var(--accent-primary)' }}>
          <div className="model-card-header">
            <div className="model-card-name">新模型配置</div>
            {renderProviderBadge(newModel.provider || 'custom')}
          </div>
          <div>
            <div className="model-card-field">
              <div className="model-card-label">显示名称</div>
              <input
                className="model-card-input"
                value={newModel.name || ''}
                onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                placeholder="例如: 我的 GPT-4"
              />
            </div>
            <div className="model-card-field">
              <div className="model-card-label">提供商</div>
              <select
                className="model-card-select"
                value={newModel.provider}
                onChange={(e) => setNewModel({ ...newModel, provider: e.target.value as any })}
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Google Gemini</option>
                <option value="ollama">Ollama</option>
                <option value="agnes">Agnes AI</option>
                <option value="custom">自定义</option>
              </select>
            </div>
            <div className="model-card-field">
              <div className="model-card-label">API 地址</div>
              <input
                className="model-card-input"
                value={newModel.apiUrl || ''}
                onChange={(e) => setNewModel({ ...newModel, apiUrl: e.target.value })}
                placeholder="https://api.openai.com/v1/chat/completions"
              />
            </div>
            <div className="model-card-field">
              <div className="model-card-label">API Key</div>
              <input
                className="model-card-input"
                type="password"
                value={newModel.apiKey || ''}
                onChange={(e) => setNewModel({ ...newModel, apiKey: e.target.value })}
                placeholder="sk-..."
              />
            </div>
            <div className="model-card-field">
              <div className="model-card-label">模型名</div>
              <input
                className="model-card-input"
                value={newModel.modelName || ''}
                onChange={(e) => setNewModel({ ...newModel, modelName: e.target.value })}
                placeholder="gpt-4o"
              />
            </div>
            <div className="model-card-field">
              <div className="model-card-label">最大 Token</div>
              <input
                className="model-card-input"
                type="number"
                value={newModel.maxTokens}
                onChange={(e) => setNewModel({ ...newModel, maxTokens: parseInt(e.target.value) || 4096 })}
              />
            </div>
            <div className="model-card-field">
              <div className="model-card-label">模型强度</div>
              <select
                className="model-card-select"
                value={newModel.strength || 'medium'}
                onChange={(e) => setNewModel({ ...newModel, strength: e.target.value as 'low' | 'medium' | 'high' })}
              >
                <option value="low">🐣 低 - 快速便宜</option>
                <option value="medium">⭐ 中 - 均衡表现</option>
                <option value="high">⚡ 高 - 最强能力</option>
              </select>
            </div>
            <div className="model-card-actions">
              <button className="model-card-btn primary" onClick={handleAddModel}>
                添加模型
              </button>
              <button className="model-card-btn" onClick={() => setShowAddForm(false)}>
                取消
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button className="add-model-btn" onClick={() => setShowAddForm(true)}>
          + 添加自定义模型
        </button>
      )}
    </div>
  );
};

export default ModelConfig;