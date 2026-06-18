import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  js.configs.recommended,
  {
    ignores: ["dist", "node_modules", "previews", "output"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        URL: "readonly",
        Blob: "readonly",
        File: "readonly",
        FileList: "readonly",
        FileReader: "readonly",
        CanvasImageSource: "readonly",
        HTMLCanvasElement: "readonly",
        HTMLInputElement: "readonly",
        Image: "readonly",
        TextEncoder: "readonly",
        Crypto: "readonly",
        crypto: "readonly",
        createImageBitmap: "readonly",
        atob: "readonly",
        indexedDB: "readonly",
        IDBDatabase: "readonly",
        IDBObjectStore: "readonly",
        IDBTransactionMode: "readonly",
        IDBTransaction: "readonly",
        IDBRequest: "readonly",
        localStorage: "readonly",
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true }
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }]
    },
  },
];
