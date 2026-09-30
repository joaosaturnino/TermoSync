import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

const jsxUsagePlugin = {
  rules: {
    'jsx-uses-vars': {
      create(context) {
        const mark = (name, node) => {
          if (!name || !/^[A-Z]/.test(name)) return;
          const sourceCode = context.sourceCode || context.getSourceCode();
          if (typeof sourceCode.markVariableAsUsed === 'function') {
            sourceCode.markVariableAsUsed(name, node);
          } else if (typeof context.markVariableAsUsed === 'function') {
            context.markVariableAsUsed(name);
          }
        };

        const getName = (node) => {
          if (!node) return '';
          if (node.type === 'JSXIdentifier') return node.name;
          if (node.type === 'JSXMemberExpression') return getName(node.object);
          return '';
        };

        return {
          JSXOpeningElement(node) {
            mark(getName(node.name), node);
          }
        };
      }
    },
    'jsx-no-undef': {
      create(context) {
        const sourceCode = context.sourceCode || context.getSourceCode();

        const getName = (node) => {
          if (!node) return '';
          if (node.type === 'JSXIdentifier') return node.name;
          if (node.type === 'JSXMemberExpression') return getName(node.object);
          return '';
        };

        const isDefined = (name, node) => {
          let scope = sourceCode.getScope(node);
          while (scope) {
            if (scope.set?.has(name)) return true;
            scope = scope.upper;
          }
          return false;
        };

        return {
          JSXOpeningElement(node) {
            const name = getName(node.name);
            if (name && /^[A-Z]/.test(name) && !isDefined(name, node)) {
              context.report({ node: node.name, message: `'${name}' is not defined.` });
            }
          }
        };
      }
    }
  }
};

export default [
  {
    ignores: ['dist/**', 'node_modules/**']
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      local: jsxUsagePlugin
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'local/jsx-uses-vars': 'warn',
      'local/jsx-no-undef': 'error',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_|^e$|^err$|^error$',
        varsIgnorePattern: '^_|^React$'
      }],
      'no-undef': 'error'
    }
  }
];
