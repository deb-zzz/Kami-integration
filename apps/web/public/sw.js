self.addEventListener('install', () => {
	console.info('service worker installed.');
});

const sendDeliveryReportAction = () => {
	console.log('Web push delivered.');
};

self.addEventListener('push', function (event) {
	// console.log('Push Received');
	// console.log(event);
	if (!event.data) {
		console.log('No data in push event');
		return;
	}

	try {
		const notificationPayload = event.data.json();
		// console.log('Push payload:', notificationPayload);

		const { id, createdAt, topic, payload, message } = notificationPayload;
		const notificationTitle = 'KAMI';
		const notificationOptions = {
			body: message || 'Someone liked your photo',
			icon: '/Kami.png',
			data: {
				url: '/',
				payload: notificationPayload,
			},
			vibrate: [200, 100, 200],
			requireInteraction: true,
		};

		event.waitUntil(
			self.registration
				.showNotification(notificationTitle, notificationOptions)
				.then(() => {
					// console.log('Notification shown successfully');
					sendDeliveryReportAction();

					// Send message to all clients (tabs/windows)
					self.clients
						.matchAll()
						.then((clients) => {
							console.log('Found clients:', clients.length);
							if (clients.length === 0) {
								console.log("No clients found - this might be why the message isn't reaching the NavBar");
							}
							clients.forEach((client) => {
								// console.log('Sending message to client:', client.id, client.url);
								client.postMessage({
									type: 'PUSH_NOTIFICATION_RECEIVED',
									payload: notificationPayload,
								});
							});
						})
						.catch((err) => {
							console.error('Error sending message to clients:', err);
						});
				})
				.catch((err) => {
					console.error('Error showing notification:', err);
				})
		);
	} catch (err) {
		console.error('Error processing push event:', err);
	}
});

self.addEventListener('message', function (event) {
	// console.log('Service worker received message:', event.data);

	if (event.data.type === 'TEST_MESSAGE') {
		// console.log('Test message received:', event.data.payload);
		// Send a response back to test communication
		event.ports[0]?.postMessage({
			type: 'TEST_RESPONSE',
			payload: 'Hello from Service Worker!',
		});

		// Also send a message to all clients to test broadcasting
		self.clients.matchAll().then((clients) => {
			console.log('Broadcasting test response to', clients.length, 'clients');
			clients.forEach((client) => {
				client.postMessage({
					type: 'TEST_RESPONSE',
					payload: 'Hello from Service Worker!',
				});
			});
		});
	}
});

self.addEventListener('notificationclick', function (event) {
	console.log('Notification clicked');

	// Send message to main app about notification click
	self.clients.matchAll().then((clients) => {
		clients.forEach((client) => {
			client.postMessage({
				type: 'NOTIFICATION_CLICKED',
				payload: event.notification.data,
			});
		});
	});

	// Close the notification
	event.notification.close();

	// Focus or open the app
	event.waitUntil(
		self.clients.matchAll().then((clients) => {
			if (clients.length > 0) {
				return clients[0].focus();
			} else {
				return self.clients.openWindow('/');
			}
		})
	);
});
