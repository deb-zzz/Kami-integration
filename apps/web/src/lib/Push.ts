import { subscribeToNotifications } from '@/apihandler/Notification';

const SERVICE_WORKER_FILE_PATH = './sw.js';

type PermissionState = 'denied' | 'granted' | 'default';

export function notificationUnsupported(): boolean {
	let unsupported = false;
	if (
		!('serviceWorker' in navigator) ||
		!('PushManager' in window) ||
		!('showNotification' in ServiceWorkerRegistration.prototype)
	) {
		unsupported = true;
	}
	return unsupported;
}

export function checkPermissionState(): PermissionState {
	const state: NotificationPermission = Notification.permission;
	// console.log('Notification permission state: ', state);
	switch (state) {
		case 'denied':
			return 'denied';
		case 'granted':
			return 'granted';
		case 'default':
			return 'default';
	}
}

async function subscribe(
	walletAddress: string,
	onSubscribe: (subs: PushSubscription | null) => void
): Promise<void> {
	navigator.serviceWorker.ready
		.then((registration: ServiceWorkerRegistration) => {
			return registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
			});
		})
		.then((subscription: PushSubscription) => {
			// console.info(
			// 	'Created subscription Object: ',
			// 	subscription.toJSON()
			// );
			submitSubscription(walletAddress, subscription).then((_) => {
				onSubscribe(subscription);
			});
		})
		.catch((e) => {
			console.error('Failed to subscribe cause of: ', e);
		});
}

async function submitSubscription(
	walletAddress: string,
	subscription: any
): Promise<void> {
	subscribeToNotifications(walletAddress, JSON.stringify(subscription));

	// const endpointUrl = 'https://api-gateway.kami.ocu-napse.com/notifications-service/web-push/subscription?walletAddress=0x16c607Dbe5e4959B159510C63925051e31d2E0A6';
	// const res = await fetch(endpointUrl, {
	//   method: 'POST',
	//   headers: {
	//     'Content-Type': 'application/json',
	//     "Authorization": `Bearer eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..7rl064gd8TLl-4ouT6v18g.1rPuUNOF5r29_5MxCWl_ItIlHlzdkDR9xj-w2mM_q9-uPwglew2ocCitOMRavuske__SVNLFR6bZxKwIrfvdN60kT6cZUThOEfWCmrcitOM.n9R5AP-5PZ3aEeUxw4OQtA`,
	//     "Signature": createSignature({ subscription }),
	//   },
	//   body: JSON.stringify({ subscription }), // add wallet address
	// });
	// const result = await res.json();
	// console.log(result);
}

export async function registerAndSubscribe(
	walletAddress: string,
	onSubscribe: (subs: PushSubscription | null) => void
): Promise<void> {
	try {
		await navigator.serviceWorker.register(SERVICE_WORKER_FILE_PATH);
		await subscribe(walletAddress, onSubscribe);
		console.info('Service Worker registered and subscribed');
	} catch (e) {
		console.error('Failed to register service-worker: ', e);
	}
}

// export async function sendWebPush(message: string | null): Promise<void> {
//   const endPointUrl = 'https://api-gateway.kami.ocu-napse.com/notifications-service/web-push/send?walletAddress=0x16c607Dbe5e4959B159510C63925051e31d2E0A6';
//   const pushBody = {
//     title: 'Test Push',
//     body: message ?? 'This is a test push message',
//     // image: '/kamiLogo.svg',
//     image: 'Kami.png',
//     url: 'https://google.com',
//   };
//   const res = await fetch(endPointUrl, {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       "Authorization": `Bearer eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..7rl064gd8TLl-4ouT6v18g.1rPuUNOF5r29_5MxCWl_ItIlHlzdkDR9xj-w2mM_q9-uPwglew2ocCitOMRavuske__SVNLFR6bZxKwIrfvdN60kT6cZUThOEfWCmrcitOM.n9R5AP-5PZ3aEeUxw4OQtA`,
//       "Signature": createSignature(pushBody),
//     },
//     body: JSON.stringify(pushBody),
//   });
//   const result = await res.json();
//   console.log(result);
// }
