import type { ReactNode } from "react";

/**
 * API-only service: this root layout is required by Next.js App Router.
 * No HTML pages are served; all routes are under app/api/.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
