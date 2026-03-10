"use client";

/**
 * API-only service: required so Next does not use the default _error (which
 * imports next/document and breaks the build). Must define own <html>/<body>.
 * Not served to API clients.
 */
export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<html lang="en">
			<body>
				<p>{error.message ?? "Error"}</p>
				<button type="button" onClick={() => reset()}>
					Retry
				</button>
			</body>
		</html>
	);
}
