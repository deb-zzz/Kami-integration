import React from 'react';

enum ActivityType {
	Transfer = 'Transfer',
	Sale = 'Sale',
	Mint = 'Mint',
}

function Activity() {
	const columns = [
		{ key: 'type', label: 'TYPE' },
		{ key: 'price', label: 'PRICE' },
		{ key: 'from', label: 'FROM' },
		{ key: 'to', label: 'TO' },
		{ key: 'date', label: 'DATE' },
	];

	const rows = [
		{ type: 'Transfer', price: '', from: 'SharkHunter', to: 'SeafoodPlatter', date: '6 mths ago' },
		{ type: 'Transfer', price: '', from: 'FishingBuddy', to: 'SharkHunter', date: '6 mths ago' },
		{ type: 'Sale', price: '20 USD', from: 'JaneFisher', to: 'FishingBuddy', date: '8 mths ago' },
		{ type: 'Mint', price: '10 USD', from: '', to: 'JaneFisher', date: '1 year ago' },
	];
	function getIcon(type: ActivityType): React.ReactNode {
		let img = '/activity/';
		// switch (type) {
		// 	case ActivityType.Transfer:
		// 		img =
		// 		break;
		// }
		return <img className='mr-2' alt='icon' src={img + type.toLowerCase() + '.svg'} width={20} height={20} />;
	}

	return (
		<div className='font-normal text-sm my-5 resize-x'>
			<h1 className='mb-3 font-semibold'>Item Activity</h1>
			<div className='border-1 rounded-md resize '>
				<div className='text-left text-white w-full '>
					<div className='flex'>
						{columns.map((column, i) => (
							<div key={i} className='w-full resize-x '>
								<p className='m-3 text-[10px] font-semibold' key={i}>
									{column.label}
								</p>
								<hr />
								<div className='py-2'>
									{rows.map((item: any, _) => (
										<div key={_}>
											<span className='mx-3 my-2 line-clamp-1 flex'>
												{column.key === 'type' && getIcon(item[column.key])}
												{item[column.key].length > 0 ? item[column.key] : '-'}
											</span>
											{_ !== rows.length - 1 && (
												<hr
													className={
														'border-[#292927] ' +
														(i === 0 ? 'ml-3' : i === columns.length - 1 ? 'mr-3' : '')
													}
												/>
											)}
										</div>
									))}
								</div>
							</div>
						))}
					</div>

					{/* {rows.map((item: any, _) => (
						<div className=' ' key={_}>
							{columns.map((column, i) => (
								<span className='' key={i}>
									{item[column.key]}
								</span>
							))}
						</div>
					))} */}
				</div>
			</div>
		</div>
	);
}

export default Activity;
