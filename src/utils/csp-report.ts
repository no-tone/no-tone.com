type CspReportEnvelope = {
	'csp-report'?: Record<string, unknown>;
};

type CspReportSummary = {
	path: string;
	size: number;
	malformed: boolean;
	disposition: string | null;
	effectiveDirective: string | null;
	violatedDirective: string | null;
	blockedOrigin: string | null;
	documentPath: string | null;
	sourceFilePath: string | null;
};

const readString = (value: unknown): string | null => {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const sanitizeOrigin = (value: unknown): string | null => {
	const raw = readString(value);
	if (!raw || raw === 'inline' || raw === 'eval') return raw;
	try {
		const parsed = new URL(raw);
		return parsed.origin;
	} catch {
		return raw;
	}
};

const sanitizePath = (value: unknown): string | null => {
	const raw = readString(value);
	if (!raw) return null;
	try {
		const parsed = new URL(raw);
		return parsed.pathname;
	} catch {
		return raw.startsWith('/') ? raw : null;
	}
};

export const summarizeCspReport = (
	body: string,
	reportPath: string,
): CspReportSummary => {
	try {
		const parsed = JSON.parse(body) as CspReportEnvelope;
		const report = parsed?.['csp-report'];
		if (!report || typeof report !== 'object') {
			return {
				path: reportPath,
				size: body.length,
				malformed: true,
				disposition: null,
				effectiveDirective: null,
				violatedDirective: null,
				blockedOrigin: null,
				documentPath: null,
				sourceFilePath: null,
			};
		}

		return {
			path: reportPath,
			size: body.length,
			malformed: false,
			disposition: readString(report.disposition),
			effectiveDirective: readString(report['effective-directive']),
			violatedDirective: readString(report['violated-directive']),
			blockedOrigin: sanitizeOrigin(report['blocked-uri']),
			documentPath: sanitizePath(report['document-uri']),
			sourceFilePath: sanitizePath(report['source-file']),
		};
	} catch {
		return {
			path: reportPath,
			size: body.length,
			malformed: true,
			disposition: null,
			effectiveDirective: null,
			violatedDirective: null,
			blockedOrigin: null,
			documentPath: null,
			sourceFilePath: null,
		};
	}
};
