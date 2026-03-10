import { Divider } from '@nextui-org/react';

export default function Offers() {
	const columns = [
		{ key: 'price', label: 'PRICE' },
		{ key: 'quantity', label: 'QUANTITY' },
		{ key: 'expiration', label: 'EXPIRATION' },
		{ key: 'from', label: 'FROM' },
	];

	const rows = [
		{ key: 1, price: '88 USD', quantity: 1, expiration: 'in 3 days', from: 'ReyMysterio' },
		{ key: 2, price: '75 USD', quantity: 1, expiration: 'in 2 days', from: '0x7809...2345' },
		{ key: 3, price: '90 USD', quantity: 1, expiration: 'in 2 hours', from: 'RunningMan' },
		{ key: 4, price: '100 USD', quantity: 1, expiration: 'in 30 mins', from: 'Ultimo' },
	];

	return (
		<div className='font-normal text-sm resize-x '>
			<h1 className='mb-4 font-semibold'>Offers</h1>
			<table className='text-left text-white w-11/12'>
				<thead className='text-xs border-y-1 m-4'>
					<tr className=''>
						{columns.map((column, _) => (
							<td className='py-2 min-w-[80px]' key={_}>
								{column.label}
							</td>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((item: any, _) => (
						<tr className=' ' key={_}>
							{columns.map((column, i) => (
								<td key={i}>{item[column.key]}</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
