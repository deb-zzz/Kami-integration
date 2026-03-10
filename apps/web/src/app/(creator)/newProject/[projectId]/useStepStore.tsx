'use client';
import { useState, useEffect } from 'react';

export const steps = [
	{ id: 'create', label: 'Create', content: 'Capture your ideas' },
	{
		id: 'collaborate',
		label: 'Collaborate',
		content: 'Work as a team or stay solo',
	},
	{ id: 'monetise', label: 'Monetise', content: 'Iron out money matters' },
	{ id: 'package', label: 'Package', content: 'Bundle your Digital Object' },
	{ id: 'publish', label: 'Publish', content: `Time to rock n' roll` },
];

const LOCAL_STORAGE_KEY = 'project-active-step';

export const useStepStore = () => {
	const [activeStepId, setActiveStepId] = useState(steps[0].id);
	const [hydrated, setHydrated] = useState(false);

	useEffect(() => {
		try {
			const storedStep = localStorage.getItem(LOCAL_STORAGE_KEY);
			if (storedStep && steps.some((s) => s.id === storedStep)) {
				setActiveStepId(storedStep);
			}
		} catch (error) {
			console.error('Failed to read from localStorage:', error);
		}
		setHydrated(true);
	}, []);

	useEffect(() => {
		if (hydrated) {
			try {
				localStorage.setItem(LOCAL_STORAGE_KEY, activeStepId);
			} catch (error) {
				console.error('Failed to write to localStorage:', error);
			}
		}
	}, [activeStepId, hydrated]);

	const activeStepIndex = steps.findIndex((s) => s.id === activeStepId);

	return { steps, activeStepId, setActiveStepId, activeStepIndex, hydrated };
};
