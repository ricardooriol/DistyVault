import reactPlugin from "eslint-plugin-react";

export default [
    {
        ignores: ["dist/**/*", "node_modules/**/*", "archive/**/*"]
    },
    {
        files: ["**/*.js", "**/*.jsx"],
        plugins: {
            react: reactPlugin
        },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            parserOptions: {
                ecmaFeatures: {
                    jsx: true
                }
            },
            globals: {
                window: "readonly",
                document: "readonly",
                navigator: "readonly",
                console: "readonly",
                fetch: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly",
                URL: "readonly",
                Blob: "readonly",
                File: "readonly",
                AbortController: "readonly",
                localStorage: "readonly",
                React: "readonly",
                ReactDOM: "readonly",
                DV: "readonly",
                DOMParser: "readonly",
                TextEncoder: "readonly",
                TextDecoder: "readonly",
                crypto: "readonly",
                self: "readonly",
                caches: "readonly",
                Response: "readonly",
                indexedDB: "readonly",
                btoa: "readonly",
                atob: "readonly",
                requestIdleCallback: "readonly",
                requestAnimationFrame: "readonly",
                MutationObserver: "readonly",
                Image: "readonly",
                process: "readonly",
                module: "readonly",
                require: "readonly",
                __dirname: "readonly"
            }
        },
        rules: {
            "no-unused-vars": ["warn", { "varsIgnorePattern": "^React$|^Icon$" }],
            "no-undef": "error",
            "no-empty": "warn",
            "react/jsx-uses-vars": "error",
            "react/jsx-uses-react": "error"
        }
    },
    {
        files: ["**/*.config.js"],
        languageOptions: {
            sourceType: "commonjs"
        }
    }
];
