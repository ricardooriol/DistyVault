/**
 * DistyVault — Unit tests for core utilities
 *
 * Run with: node --test tests/utils.test.js
 * Requires Node.js 18+ (built-in test runner).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Emulate DV namespace before loading utils
global.window = global;
global.DV = {};
global.fetch = async () => { throw new Error('fetch not available in tests'); };

// Load utils module (IIFE attaches to window.DV.utils)
require('../src/core/utils.js');
const { escapeHtml, wrapHtml, normalizeText } = DV.utils;

describe('escapeHtml', () => {
    it('escapes ampersands', () => {
        assert.equal(escapeHtml('foo & bar'), 'foo &amp; bar');
    });

    it('escapes angle brackets', () => {
        assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('handles empty string', () => {
        assert.equal(escapeHtml(''), '');
    });

    it('handles undefined', () => {
        assert.equal(escapeHtml(), '');
    });

    it('passes through safe text', () => {
        assert.equal(escapeHtml('Hello World'), 'Hello World');
    });
});

describe('normalizeText', () => {
    it('collapses multiple newlines to single', () => {
        // The \\s+\\n rule reduces consecutive newlines before \\n{3,} applies
        assert.equal(normalizeText('a\n\n\n\nb'), 'a\nb');
    });

    it('replaces non-breaking spaces', () => {
        assert.equal(normalizeText('hello\u00a0world'), 'hello world');
    });

    it('strips zero-width chars', () => {
        assert.equal(normalizeText('hello\u200bworld'), 'hello world');
    });

    it('trims whitespace', () => {
        assert.equal(normalizeText('  hello  '), 'hello');
    });

    it('handles empty string', () => {
        assert.equal(normalizeText(''), '');
    });

    it('handles undefined', () => {
        assert.equal(normalizeText(), '');
    });
});

describe('wrapHtml', () => {
    it('wraps content in HTML document', () => {
        const result = wrapHtml('<p>Hello</p>', 'Test');
        assert.ok(result.includes('<!doctype html>'));
        assert.ok(result.includes('<p>Hello</p>'));
        assert.ok(result.includes('<title>Test</title>'));
    });

    it('escapes title in output', () => {
        const result = wrapHtml('content', '<script>XSS</script>');
        assert.ok(!result.includes('<title><script>'));
        assert.ok(result.includes('&lt;script&gt;'));
    });

    it('uses default title when not provided', () => {
        const result = wrapHtml('content');
        assert.ok(result.includes('<title>Distilled</title>'));
    });
});
