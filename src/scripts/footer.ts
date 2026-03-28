const initFooter = (): void => {
	const button = document.querySelector('[data-copy-contact]');
	if (!(button instanceof HTMLButtonElement)) return;

	const defaultLabel = 'contact';
	let resetTimer = 0;

	const setLabel = (value: string) => {
		button.textContent = value;
	};

	button.addEventListener('click', async () => {
		const value = button.dataset.copyValue || '';
		if (!value) return;

		try {
			await navigator.clipboard.writeText(value);
			setLabel('copied');
		} catch {
			setLabel('failed');
		}

		window.clearTimeout(resetTimer);
		resetTimer = window.setTimeout(() => {
			setLabel(defaultLabel);
		}, 1200);
	});
};

export default initFooter;
