import React from 'react';
import Icon from './Icon';

const SOURCE_META = {
    youtube: { icon: 'youtube', label: 'YouTube' },
    substack: { icon: 'mail', label: 'Substack' },
    medium: { icon: 'book-open', label: 'Medium' },
    github: { icon: 'github', label: 'GitHub' },
    arxiv: { icon: 'file-text', label: 'arXiv' },
    wikipedia: { icon: 'globe', label: 'Wikipedia' },
    reddit: { icon: 'message-circle', label: 'Reddit' },
    x: { icon: 'at-sign', label: 'X' },
    nytimes: { icon: 'newspaper', label: 'NYTimes' },
    bbc: { icon: 'radio', label: 'BBC' },
    guardian: { icon: 'newspaper', label: 'Guardian' },
    stackoverflow: { icon: 'code', label: 'Stack Overflow' },
    hackernews: { icon: 'terminal', label: 'Hacker News' },
    linkedin: { icon: 'linkedin', label: 'LinkedIn' },
    notion: { icon: 'layout', label: 'Notion' },
    pdf: { icon: 'file-text', label: 'PDF' },
    document: { icon: 'file', label: 'Document' },
    image: { icon: 'image', label: 'Image' },
    text: { icon: 'file-text', label: 'Text' },
    file: { icon: 'paperclip', label: 'File' },
    web: { icon: 'link', label: 'Web' },
};

export default function SourceBadge({ item }) {
    const sourceTag = (item.tags || []).find(t => t.startsWith('source:'));
    const key = sourceTag ? sourceTag.slice(7) : (item.kind === 'youtube' ? 'youtube' : item.kind === 'file' ? 'file' : 'web');
    const meta = SOURCE_META[key] || SOURCE_META.web;
    return (
        <div className="flex items-center gap-1.5 justify-center text-xs text-slate-600 dark:text-slate-300">
            <Icon name={meta.icon} size={14} className="opacity-60" />
            <span className="truncate">{meta.label}</span>
        </div>
    );
}
