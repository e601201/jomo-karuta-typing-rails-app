import { createInertiaApp, router } from '@inertiajs/react';
import { settingsStore } from '@/stores/settings-store';
import type { SharedProps } from '@/types';

// アカウント優先の設定同期（ADR-0004）。
// navigate イベントは初回ロードとページ遷移（ログイン直後の Inertia リダイレクト含む）で
// 発火するので、そのたびに shared props の settings とログイン有無をストアへ渡す。
// 適用済みスナップショットの再適用や初回引き継ぎの多重発火はストア側で防ぐ。
router.on('navigate', (event) => {
	const { auth, settings } = event.detail.page.props as unknown as SharedProps;
	void settingsStore.initializeFromServer(settings ?? null, auth.user !== null);
});

void createInertiaApp({
	pages: '../pages',

	strictMode: true,

	defaults: {
		form: {
			forceIndicesArrayFormatInFormData: false,
			withAllErrors: true
		},
		visitOptions: () => {
			return { queryStringArrayFormat: 'brackets' };
		}
	}
}).catch((error) => {
	// This ensures this entrypoint is only loaded on Inertia pages
	// by checking for the presence of the root element (#app by default).
	// Feel free to remove this `catch` if you don't need it.
	if (document.getElementById('app')) {
		throw error;
	} else {
		console.error(
			'Missing root element.\n\n' +
				'If you see this error, it probably means you loaded Inertia.js on non-Inertia pages.\n' +
				'Consider moving <%= vite_typescript_tag "inertia.tsx" %> to the Inertia-specific layout instead.'
		);
	}
});
