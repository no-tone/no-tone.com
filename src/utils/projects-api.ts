export interface GithubRepo {
	name?: string;
	html_url?: string;
	homepage?: string | null;
	language?: string | null;
	description?: string | null;
	topics?: string[];
	fork?: boolean;
	forks_count?: number;
	archived?: boolean;
	has_pages?: boolean;
	stargazers_count?: number;
	updated_at?: string;
	[other: string]: unknown;
}

export interface SimplifiedRepo {
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
}

export const simplifyRepos = (repos: unknown): SimplifiedRepo[] => {
	if (!Array.isArray(repos)) return [];
	return repos
		.filter((repo): repo is GithubRepo => !!repo && typeof repo === 'object')
		.filter((repo) => repo.name && repo.html_url)
		.map((repo) => ({
			name: String(repo.name),
			url: String(repo.html_url),
			homepage: repo.homepage ? String(repo.homepage) : '',
			language: repo.language ? String(repo.language) : 'Other',
			description: repo.description ? String(repo.description) : '',
			topics: Array.isArray(repo.topics) ? repo.topics : [],
			isFork: !!repo.fork,
			isArchived: !!repo.archived,
			hasPages: !!repo.has_pages,
			stars:
				typeof repo.stargazers_count === 'number' ? repo.stargazers_count : 0,
			forks: typeof repo.forks_count === 'number' ? repo.forks_count : 0,
			updatedAt: repo.updated_at ? String(repo.updated_at) : '',
		}));
};
