'use client';

import { AllProjectType } from '@/types';
import Stepper from './Stepper';

export default function PublishTab({
	project,
	getData,
	isActionDisabled,
}: {
	project: AllProjectType;
	getData: () => void;
	isActionDisabled: boolean;
}) {
	return (
		<div className='h-full w-full p-10'>
			<Stepper
				project={project}
				getData={getData}
				isActionDisabled={isActionDisabled}
			/>
		</div>
	);
}
