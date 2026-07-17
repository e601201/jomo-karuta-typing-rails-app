import js from '@eslint/js';
import ts from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default ts.config(
	{
		ignores: [
			'node_modules/',
			'public/',
			'vendor/',
			'tmp/',
			'log/',
			'db/',
			'coverage/',
			'bin/',
			'.agents/',
			'.claude/'
		]
	},
	js.configs.recommended,
	...ts.configs.recommended,
	reactHooks.configs.flat.recommended,
	prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			'no-undef': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_'
				}
			]
		}
	}
);
