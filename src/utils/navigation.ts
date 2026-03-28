export const isSameOriginReferrer = (
	referrer: string | null | undefined,
	currentOrigin: string,
): boolean => {
	if (!referrer) return false;
	try {
		return new URL(referrer).origin === currentOrigin;
	} catch {
		return false;
	}
};
