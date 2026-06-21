import React, { useState, useMemo, useCallback } from 'react';
import { useStore, store } from '../store';
import { Skill, SkillCategory } from '../types';
import { SKILLS_LIBRARY, SKILL_CATEGORIES, searchSkills } from '../skills';

const SkillsPanel: React.FC = () => {
  const state = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredSkills = useMemo(() => {
    let skills = SKILLS_LIBRARY;
    if (searchQuery) {
      skills = searchSkills(searchQuery);
    } else if (activeCategory !== 'all') {
      skills = skills.filter(s => s.category === activeCategory);
    }
    return skills;
  }, [searchQuery, activeCategory]);

  const installedCount = state.installedSkills.length;
  const totalCount = SKILLS_LIBRARY.length;

  const toggleSkill = useCallback((skillId: string) => {
    if (store.isSkillInstalled(skillId)) {
      store.uninstallSkill(skillId);
      store.addToast({ type: 'info', message: '已卸载 Skill' });
    } else {
      store.installSkill(skillId);
      store.addToast({ type: 'success', message: '已安装 Skill' });
    }
  }, []);

  return (
    <div className="skills-panel">
      {/* 统计头部 */}
      <div className="skills-header">
        <div className="skills-stats">
          <span className="skills-stat-icon">🧩</span>
          <span className="skills-stat-text">
            已安装 <strong>{installedCount}</strong> / {totalCount} 个 Skills
          </span>
        </div>
        <div className="skills-search">
          <input
            className="skills-search-input"
            type="text"
            placeholder="搜索 Skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 分类标签 */}
      {!searchQuery && (
        <div className="skills-categories">
          <button
            className={`skills-cat-btn ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            全部
          </button>
          {SKILL_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`skills-cat-btn ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Skills 列表 */}
      <div className="skills-list">
        {filteredSkills.length === 0 ? (
          <div className="skills-empty">
            <span style={{ fontSize: 32, opacity: 0.3 }}>🔍</span>
            <p>未找到匹配的 Skills</p>
          </div>
        ) : (
          filteredSkills.map(skill => {
            const isInstalled = store.isSkillInstalled(skill.id);
            const cat = SKILL_CATEGORIES.find(c => c.id === skill.category);
            return (
              <div
                key={skill.id}
                className={`skill-card ${isInstalled ? 'installed' : ''}`}
                onClick={() => toggleSkill(skill.id)}
              >
                <div className="skill-card-icon">{skill.icon}</div>
                <div className="skill-card-body">
                  <div className="skill-card-header">
                    <span className="skill-card-name">{skill.name}</span>
                    <span className="skill-card-version">v{skill.version}</span>
                  </div>
                  <div className="skill-card-desc">{skill.description}</div>
                  <div className="skill-card-meta">
                    <span className="skill-card-cat">
                      {cat?.icon} {cat?.name}
                    </span>
                    <span className="skill-card-author">by {skill.author}</span>
                  </div>
                  <div className="skill-card-tags">
                    {skill.tags.map(tag => (
                      <span key={tag} className="skill-tag">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="skill-card-action">
                  <button
                    className={`skill-btn ${isInstalled ? 'skill-btn-uninstall' : 'skill-btn-install'}`}
                    onClick={(e) => { e.stopPropagation(); toggleSkill(skill.id); }}
                  >
                    {isInstalled ? '已安装 ✓' : '安装'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 底部操作 */}
      {installedCount > 0 && (
        <div className="skills-footer">
          <button
            className="skill-btn skill-btn-clear"
            onClick={() => {
              state.installedSkills.forEach(id => store.uninstallSkill(id));
              store.addToast({ type: 'info', message: '已清空所有 Skills' });
            }}
          >
            清空全部
          </button>
          <span className="skills-footer-hint">
            💡 已安装的 Skills 会在对话中自动激活
          </span>
        </div>
      )}
    </div>
  );
};

export default SkillsPanel;