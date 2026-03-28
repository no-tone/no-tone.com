type NoToneHelpers = {
	getStoredTheme: () => 'light' | 'dark' | null;
	setStoredTheme: (theme: 'light' | 'dark') => void;
	readTheme: () => 'light' | 'dark';
	applyTheme: (theme: 'light' | 'dark') => void;
	isSafeExternalUrl: (value: unknown) => boolean;
	openExternal: (url: string) => void;
};

type NoToneWindow = Window & {
	noTone?: Partial<NoToneHelpers>;
};

const initSharedHead = (): void => {
	const root = ((window as NoToneWindow).noTone ??= {});
	const THEME_KEY = 'theme';

	root.getStoredTheme = () => {
		try {
			const value = localStorage.getItem(THEME_KEY);
			return value === 'light' || value === 'dark' ? value : null;
		} catch {
			return null;
		}
	};

	root.setStoredTheme = (theme: 'light' | 'dark') => {
		try {
			localStorage.setItem(THEME_KEY, theme);
		} catch {
			// no-op
		}
	};

	root.readTheme = () =>
		root.getStoredTheme?.() ??
		(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

	root.applyTheme = (theme: 'light' | 'dark') => {
		document.documentElement.dataset.theme = theme;
	};

	root.isSafeExternalUrl = (value: unknown) => {
		try {
			const raw = String(value || '').trim();
			if (!raw) return false;
			const url = new URL(raw);
			return url.protocol === 'http:' || url.protocol === 'https:';
		} catch {
			return false;
		}
	};

	root.openExternal = (url: string) => {
		if (!root.isSafeExternalUrl?.(url)) return;
		window.open(String(url), '_blank', 'noopener,noreferrer');
	};
};

export default initSharedHead;
