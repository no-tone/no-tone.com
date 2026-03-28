type NoToneWindow = Window & {
	noTone?: {
		readTheme?: () => 'light' | 'dark';
		applyTheme?: (theme: 'light' | 'dark') => void;
		getStoredTheme?: () => 'light' | 'dark' | null;
		setStoredTheme?: (theme: 'light' | 'dark') => void;
	};
};

const initHeader = (): void => {
	const toggle = document.querySelector('.topbar__toggle');
	const icon = document.querySelector('.topbar__toggleIcon');
	const back = document.querySelector('.topbar__back');
	if (!(toggle instanceof HTMLButtonElement) || !(icon instanceof HTMLElement)) {
		return;
	}

	const noTone = (window as NoToneWindow).noTone;
	if (
		!noTone?.readTheme ||
		!noTone?.applyTheme ||
		!noTone?.getStoredTheme ||
		!noTone?.setStoredTheme
	) {
		return;
	}

	const apply = (theme: 'light' | 'dark') => {
		noTone.applyTheme?.(theme);
		icon.textContent = theme === 'dark' ? '☾' : '☀︎';
	};

	const syncFromStorage = () => {
		const stored = noTone.getStoredTheme?.();
		const theme = noTone.readTheme?.() ?? 'dark';
		apply(theme);
		if (!stored) {
			noTone.setStoredTheme?.(theme);
		}
	};

	syncFromStorage();
	window.addEventListener('pageshow', syncFromStorage);
	window.addEventListener('storage', (event) => {
		if (event.key === 'theme') {
			syncFromStorage();
		}
	});

	toggle.addEventListener('click', () => {
		const current =
			document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
		const next = current === 'dark' ? 'light' : 'dark';
		apply(next);
		noTone.setStoredTheme?.(next);
	});

	if (back instanceof HTMLButtonElement && !back.hidden) {
		back.addEventListener('click', () => {
			if (back.dataset.canGoBack === 'true' && window.history.length > 1) {
				window.history.back();
				return;
			}
			window.location.href = '/';
		});
	}
};

export default initHeader;
