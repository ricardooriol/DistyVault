import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/utils';;

export default function SettingsDrawer({ open, onClose, settings, setSettings }) {
    const DEFAULTS = { ai: { mode: '', model: '', apiKey: '' }, concurrency: 1 };
    const [local, setLocal] = useState(settings || DEFAULTS);
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        const cloned = settings ? { ...settings, ai: { ...(settings.ai || {}) } } : { ...DEFAULTS };
        setLocal(cloned);
    }, [settings]);

    function save() {
        setSettings(local);
        if (window.DV?.toast) window.DV.toast('Settings saved', { type: 'success' });
        onClose();
    }

    function reset() {
        setLocal({ ...DEFAULTS });
        setTesting(false);
    }

    async function testKey() {
        try {
            setTesting(true);
            if (window.DV?.ai?.test) {
                await window.DV.ai.test(local.ai);
                window.DV.toast('API key works', { type: 'success' });
            } else {
                throw new Error('AI service not available');
            }
        } catch (e) {
            if (window.DV?.toast) window.DV.toast(e?.message || 'API key test failed', { type: 'error' });
        } finally {
            setTesting(false);
        }
    }

    return (
        <div className={cn('fixed inset-0 z-50', open ? '' : 'pointer-events-none')}>
            <div className={cn('absolute inset-0 bg-black/30 transition-opacity', open ? 'opacity-100' : 'opacity-0')} onClick={onClose}></div>
            <div className={cn('absolute right-0 top-0 h-full w-full max-w-md p-4 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/10 transition-transform', open ? 'translate-x-0' : 'translate-x-full')}>
                <div className="flex items-center justify-between mb-4">
                    <div className="text-lg font-semibold">Settings</div>
                    <button onClick={onClose} title="Close" aria-label="Close" className="w-9 h-9 rounded-lg border border-slate-400 dark:border-white/30 flex items-center justify-center text-slate-900 dark:text-white bg-white dark:bg-slate-800">
                        <Icon name="x" />
                    </button>
                </div>
                <div className="space-y-4">
                    <div>
                        <div className="text-sm font-medium mb-1">AI Provider</div>
                        <select
                            value={local.ai.mode || ''}
                            onChange={e => setLocal({ ...local, ai: { ...local.ai, mode: e.target.value, model: '' } })}
                            className="w-full h-10 rounded-lg border border-slate-400 dark:border-white/30 bg-white dark:bg-slate-900/60 text-sm text-slate-900 dark:text-slate-100 px-2">
                            <option value="">Select a provider</option>
                            <option value="anthropic">Anthropic Claude</option>
                            <option value="deepseek">Deepseek</option>
                            <option value="gemini">Google Gemini</option>
                            <option value="grok">Grok</option>
                            <option value="openai">OpenAI</option>
                        </select>
                    </div>
                    {local.ai.mode && (
                        <>
                            <div>
                                <div className="text-sm font-medium mb-1">Model</div>
                                <select
                                    value={local.ai.model || ''}
                                    onChange={e => setLocal({ ...local, ai: { ...local.ai, model: e.target.value } })}
                                    className="w-full h-10 rounded-lg border border-slate-400 dark:border-white/30 bg-white dark:bg-slate-900/60 text-sm text-slate-900 dark:text-slate-100 px-2">
                                    <option value="">Select a model</option>
                                    {local.ai.mode === 'anthropic' && [
                                        { v: 'claude-opus-4.6-latest', l: 'Claude Opus 4.6' },
                                        { v: 'claude-sonnet-4.5-latest', l: 'Claude Sonnet 4.5' },
                                        { v: 'claude-haiku-4.5-latest', l: 'Claude Haiku 4.5' },
                                    ].map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                                    {local.ai.mode === 'deepseek' && [
                                        { v: 'deepseek-chat', l: 'DeepSeek Chat' },
                                        { v: 'deepseek-reasoner', l: 'DeepSeek Reasoner' },
                                    ].map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                                    {local.ai.mode === 'gemini' && [
                                        { v: 'gemini-3-flash-preview', l: 'Gemini 3 Flash' },
                                        { v: 'gemini-3-pro-preview', l: 'Gemini 3 Pro' },
                                    ].map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                                    {local.ai.mode === 'grok' && [
                                        { v: 'grok-4', l: 'Grok 4' },
                                        { v: 'grok-4.1-fast', l: 'Grok 4.1 Fast' },
                                    ].map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                                    {local.ai.mode === 'openai' && [
                                        { v: 'gpt-5-mini', l: 'GPT-5 Mini' },
                                        { v: 'gpt-5', l: 'GPT-5' },
                                        { v: 'o4-mini', l: 'O4 Mini' },
                                    ].map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                                </select>
                            </div>
                            <div>
                                <div className="text-sm font-medium mb-1">API Key</div>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 relative">
                                        <input
                                            type="password"
                                            value={local.ai.apiKey || ''}
                                            onChange={e => { setLocal({ ...local, ai: { ...local.ai, apiKey: e.target.value } }); }}
                                            placeholder="Paste a valid API Key"
                                            className={cn('w-full h-10 rounded-lg bg-white dark:bg-slate-900/60 px-2 text-sm text-slate-900 dark:text-slate-100 border border-slate-400 dark:border-white/30')} />
                                    </div>
                                    <button
                                        onClick={testKey}
                                        disabled={!local.ai.mode || !local.ai.apiKey || testing}
                                        className="px-3 h-10 rounded-lg border border-slate-400 dark:border-white/30 disabled:opacity-50 text-slate-900 dark:text-white bg-white dark:bg-slate-800 inline-flex items-center gap-2">
                                        <Icon name="beaker" />
                                        <span>{testing ? 'Testing…' : 'Test'}</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                    <div>
                        <div className="text-sm font-semibold mb-1 text-slate-900 dark:text-slate-100">Simultaneous processing</div>
                        <input type="range" min="1" max="10" value={local.concurrency} onChange={e => setLocal({ ...local, concurrency: Number(e.target.value) })} />
                        <div className="mt-1 inline-flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                            <Icon name="sliders" />
                            <span>{local.concurrency}</span>
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex gap-2">
                    <button onClick={save} className="px-3 h-10 rounded-lg bg-brand-700 text-white inline-flex items-center gap-2">
                        <Icon name="save" />
                        <span>Save</span>
                    </button>
                    <button onClick={reset} className="px-3 h-10 rounded-lg border border-slate-400 dark:border-white/30 text-slate-900 dark:text-white bg-white dark:bg-slate-800 inline-flex items-center gap-2">
                        <Icon name="rotate-ccw" />
                        <span>Reset</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
