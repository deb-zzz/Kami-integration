/**
 * API-only service: required so Next does not use the default 404 (which
 * imports next/document and breaks the build). Not served to API clients.
 */
export default function NotFound() {
	return <div>404</div>;
}
