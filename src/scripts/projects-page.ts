type NoToneWindow = Window & {
	noTone?: {
		isSafeExternalUrl?: (value: string) => boolean;
		openExternal?: (value: string) => void;
	};
	__noToneProjectsPageInitialized?: boolean;
};

type ProjectRepo = {
	name: string;
	url: string;
	homepage: string;
	language: string;
	description: string;
	topics: string[];
	isFork: boolean;
	isArchived: boolean;
	hasPages: boolean;
	stars: number;
	forks: number;
	updatedAt: string;
	__search: string;
	__hasPages: boolean;
	__hasWebsite: boolean;
};

const normalize = (value: unknown): string =>
	String(value || '')
		.toLowerCase()
		.trim();

const lc = (value: unknown): string => String(value || '').toLowerCase();

const span = (className: string, text: string): HTMLSpanElement => {
	const el = document.createElement('span');
	el.className = className;
	el.textContent = text;
	return el;
};

const compareRepos = (a: ProjectRepo, b: ProjectRepo, sort: string): number => {
	if (sort === 'stars') return (b.stars || 0) - (a.stars || 0);
	if (sort === 'forks') return (b.forks || 0) - (a.forks || 0);
	if (sort === 'name-asc') return String(a.name).localeCompare(String(b.name));
	if (sort === 'name-desc') return String(b.name).localeCompare(String(a.name));
	const ad = a.updatedAt ? Date.parse(a.updatedAt) : 0;
	const bd = b.updatedAt ? Date.parse(b.updatedAt) : 0;
	return bd - ad;
};

const createProjectCard = (repo: ProjectRepo): HTMLDivElement => {
	const card = document.createElement('div');
	card.className = 'projectCard';
	card.setAttribute('role', 'link');
	card.tabIndex = 0;
	card.dataset.repoUrl = String(repo.url || '');

	const title = document.createElement('div');
	title.className = 'projectCard__title';
	title.textContent = repo.name;

	const desc = document.createElement('div');
	desc.className = 'projectCard__desc';
	desc.textContent = repo.description || '';

	const homepage = String(repo.homepage || '').trim();
	const published = document.createElement('a');
	published.className = 'projectCard__published';
	published.textContent = 'published website';
	published.setAttribute('aria-label', `published website for ${repo.name}`);
	if (repo.__hasWebsite && homepage) {
		published.href = homepage;
		published.target = '_blank';
		published.rel = 'nofollow noreferrer noopener';
	}

	const meta = document.createElement('div');
	meta.className = 'projectCard__meta';

	const left = document.createElement('div');
	left.className = 'projectCard__metaLeft';
	left.appendChild(span('projectCard__kvLabel', 'lang:'));
	left.appendChild(span('projectCard__kvValue', lc(repo.language || 'Other')));

	const right = document.createElement('div');
	right.className = 'projectCard__metaRight';
	const bits: string[] = [];
	if (repo.stars) bits.push(`★ ${repo.stars}`);
	if (repo.forks || repo.isFork) bits.push(`⑂ ${repo.forks || 0}`);
	if (repo.isArchived) bits.push('archived');
	if (repo.__hasPages) bits.push('pages');
	right.textContent = bits.join(' · ');

	meta.appendChild(left);
	meta.appendChild(right);

	card.appendChild(title);
	if (desc.textContent) card.appendChild(desc);
	if (published.href) card.appendChild(published);
	card.appendChild(meta);

	const topics = Array.isArray(repo.topics) ? repo.topics.slice(0, 8) : [];
	if (topics.length) {
		const topicsEl = document.createElement('div');
		topicsEl.className = 'projectCard__topics';
		topicsEl.appendChild(span('projectCard__kvLabel', 'topics:'));
		topicsEl.appendChild(span('projectCard__kvValue', topics.join(' / ')));
		card.appendChild(topicsEl);
	}

	return card;
};

const initProjectsPage = (): void => {
	const root = document;
	const apiUrl = new URL('/api/projects.json', window.location.origin);

	const listEl = root.querySelector('#list') as HTMLDivElement | null;
	const metaEl = root.querySelector('#meta') as HTMLSpanElement | null;
	const statusEl = root.querySelector('#status') as HTMLParagraphElement | null;
	const qEl = root.querySelector('#q') as HTMLInputElement | null;
	const langEl = root.querySelector('#lang') as HTMLSelectElement | null;
	const pagesEl = root.querySelector('#pages') as HTMLInputElement | null;
	const hasWebsiteEl = root.querySelector('#hasWebsite') as HTMLInputElement | null;
	const isForkEl = root.querySelector('#isFork') as HTMLInputElement | null;
	const sortEl = root.querySelector('#sort') as HTMLSelectElement | null;
	const resetEl = root.querySelector('#reset') as HTMLButtonElement | null;

	if (
		!listEl ||
		!metaEl ||
		!statusEl ||
		!qEl ||
		!langEl ||
		!pagesEl ||
		!hasWebsiteEl ||
		!isForkEl ||
		!sortEl ||
		!resetEl
	) {
		return;
	}

	const noTone = (window as NoToneWindow).noTone;
	if (!noTone?.isSafeExternalUrl || !noTone?.openExternal) return;
	if ((window as NoToneWindow).__noToneProjectsPageInitialized) return;
	(window as NoToneWindow).__noToneProjectsPageInitialized = true;

	const dateFmt = new Intl.DateTimeFormat(undefined, {
		year: 'numeric',
		month: 'short',
		day: '2-digit',
	});

	const state: { repos: ProjectRepo[] } = { repos: [] };
	let renderDebounceId: number | undefined;

	const getFilters = () => ({
		q: normalize(qEl.value),
		lang: String(langEl.value || ''),
		pages: !!pagesEl.checked,
		hasWebsite: !!hasWebsiteEl.checked,
		isFork: !!isForkEl.checked,
		sort: String(sortEl.value || 'updated'),
	});

	const render = () => {
		const { q, lang, pages, hasWebsite, isFork, sort } = getFilters();
		const filtered: ProjectRepo[] = [];

		for (const repo of state.repos) {
			if (isFork && !repo.isFork) continue;
			if (hasWebsite && !repo.__hasWebsite) continue;
			if (lang && repo.language !== lang) continue;
			if (pages && !repo.__hasPages) continue;
			if (q && !repo.__search.includes(q)) continue;
			filtered.push(repo);
		}

		if (filtered.length > 1) {
			filtered.sort((a, b) => compareRepos(a, b, sort));
		}

		metaEl.textContent = `${filtered.length}/${state.repos.length}`;
		listEl.replaceChildren();

		if (!filtered.length) {
			const empty = document.createElement('div');
			empty.className = 'projects__empty';
			empty.textContent = 'no matches';
			listEl.appendChild(empty);
			return;
		}

		const frag = document.createDocumentFragment();
		for (const repo of filtered) {
			frag.appendChild(createProjectCard(repo));
		}
		listEl.appendChild(frag);
	};

	const populateLanguages = (repos: ProjectRepo[]) => {
		const values = new Set<string>();
		for (const repo of repos) {
			values.add(repo.language || 'Other');
		}
		const langs = Array.from(values).sort((a, b) => a.localeCompare(b));
		for (const lang of langs) {
			const opt = document.createElement('option');
			opt.value = lang;
			opt.textContent = lc(lang);
			langEl.appendChild(opt);
		}
	};

	const bind = () => {
		const queueRender = () => {
			window.clearTimeout(renderDebounceId);
			renderDebounceId = window.setTimeout(render, 90);
		};

		const onChange = () => render();
		qEl.addEventListener('input', queueRender);
		langEl.addEventListener('change', onChange);
		pagesEl.addEventListener('change', onChange);
		hasWebsiteEl.addEventListener('change', onChange);
		isForkEl.addEventListener('change', onChange);
		sortEl.addEventListener('change', onChange);

		const getCardFromEvent = (event: Event): HTMLElement | null => {
			const target = event.target;
			if (!(target instanceof Element)) return null;
			if (target.closest('a')) return null;
			const card = target.closest('.projectCard');
			return card instanceof HTMLElement ? card : null;
		};

		listEl.addEventListener('click', (event) => {
			const card = getCardFromEvent(event);
			if (!card) return;
			noTone.openExternal?.(card.dataset.repoUrl || '');
		});

		listEl.addEventListener('keydown', (event) => {
			if (!(event instanceof KeyboardEvent)) return;
			if (event.key !== 'Enter' && event.key !== ' ') return;
			const card = getCardFromEvent(event);
			if (!card) return;
			event.preventDefault();
			noTone.openExternal?.(card.dataset.repoUrl || '');
		});

		resetEl.addEventListener('click', () => {
			qEl.value = '';
			langEl.value = '';
			pagesEl.checked = false;
			hasWebsiteEl.checked = false;
			isForkEl.checked = false;
			sortEl.value = 'updated';
			render();
		});
	};

	const load = async () => {
		listEl.textContent = 'loading…';
		metaEl.textContent = '';
		statusEl.textContent = '';

		try {
			const res = await fetch(apiUrl);
			const statusBits: string[] = [];
			const lastUpdated = res.headers.get('x-no-tone-last-updated');
			const parsedUpdated = lastUpdated ? Date.parse(lastUpdated) : Number.NaN;
			const rlRemaining = res.headers.get('x-ratelimit-remaining');
			const rlLimit = res.headers.get('x-ratelimit-limit');

			if (Number.isFinite(parsedUpdated)) {
				statusBits.push(`last updated: ${dateFmt.format(parsedUpdated)}`);
			}
			if (rlRemaining && rlLimit) {
				statusBits.push(`rate limit: ${rlRemaining}/${rlLimit}`);
			}
			statusEl.textContent = statusBits.join(' · ');

			const data = (await res.json()) as unknown;
			if (!res.ok) {
				const message =
					data && typeof data === 'object' && 'error' in data
						? String((data as { error?: unknown }).error || 'failed to load')
						: 'failed to load';
				throw new Error(message);
			}

			const raw = Array.isArray(data) ? data : [];
			state.repos = raw.map((repo) => {
				const topics = Array.isArray(repo.topics) ? repo.topics : [];
				const homepage = String(repo.homepage || '').trim();
				return {
					...(repo as Omit<ProjectRepo, '__search' | '__hasPages' | '__hasWebsite'>),
					__search: normalize(
						[repo.name, repo.description, repo.language, ...topics].join(' '),
					),
					__hasPages:
						repo.hasPages === true || topics.includes('github-pages'),
					__hasWebsite: noTone.isSafeExternalUrl?.(homepage) === true,
				};
			});
			populateLanguages(state.repos);
			bind();
			render();
		} catch (error) {
			const message =
				error instanceof Error && error.message
					? error.message.toLowerCase()
					: 'failed to load';
			listEl.textContent = message;
		}
	};

	void load();
};

export default initProjectsPage;
