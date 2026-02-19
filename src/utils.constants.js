export const STATUS = {
    PENDING: 'pending',
    EXTRACTING: 'extracting',
    DISTILLING: 'distilling',
    COMPLETED: 'completed',
    READ: 'read',
    ERROR: 'error',
    STOPPED: 'stopped'
};

export const SOURCE_META = {
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
