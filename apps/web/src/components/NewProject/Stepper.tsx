'use client';

type Step = {
	id: string;
	label: string;
	content: string;
};

interface StepperProps {
	steps: Step[];
	activeStepIndex: number;
	setActiveStepId: (id: string) => void;
	disabledSteps?: string[];
}

export default function Stepper({
	steps,
	activeStepIndex,
	setActiveStepId,
	disabledSteps = [],
}: StepperProps) {
	return (
		<nav aria-label='Progress'>
			<ol className='space-y-10'>
				{steps.map((step, index) => {
					const isCompleted = index < activeStepIndex;
					const isActive = index === activeStepIndex;
					const isDisabled = disabledSteps.includes(step.id);

					return (
						<li key={step.id} className='relative'>
							{index !== steps.length - 1 ? (
								<div
									className={`absolute left-5 top-8 -ml-px mt-2 h-full w-[0.5px] ${
										isCompleted || isActive
											? 'bg-[#F1F0EB]'
											: 'bg-[#6E6E6E]'
									}`}
									aria-hidden='true'
								/>
							) : null}

							<button
								onClick={() => {
									if (!isDisabled) {
										setActiveStepId(step.id);
									}
								}}
								disabled={isDisabled}
								className={`group relative flex w-full items-start ${
									isDisabled
										? 'cursor-not-allowed opacity-50'
										: 'cursor-pointer'
								}`}
								aria-current={isActive ? 'step' : undefined}
							>
								<span
									className='flex h-10 items-center'
									aria-hidden='true'
								>
									<span
										className={`bg-[#1A1A1A]    group-hover:border-[#F1F0EB] group-hover:text-[#F1F0EB] relative z-10 flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-300 ${
											isActive
												? 'border-2  border-[#F1F0EB] text-[#F1F0EB]'
												: isCompleted
												? 'border-2 border-[#F1F0EB] text-[#F1F0EB]'
												: 'border-2 border-[#6E6E6E]  text-[#6E6E6E]'
										}`}
									>
										<span className='text-[16px] '>
											{index + 1}
										</span>
									</span>
								</span>
								<span className='ml-4 flex min-w-0 flex-col items-center justify-center h-10'>
									<span
										className={`group-hover:text-[#F1F0EB]  text-start  text-[#6E6E6E] transition-colors duration-300 ${
											isActive
												? 'text-[#F1F0EB]'
												: isCompleted
												? 'text-[#F1F0EB]'
												: 'text-[#6E6E6E]'
										}`}
									>
										<p className='text-[22px] font-semibold '>
											{step.label}
										</p>
										<p className='text-[13px] font-light'>
											{step.content}
										</p>
									</span>
								</span>
							</button>
						</li>
					);
				})}
			</ol>
		</nav>
	);
}
