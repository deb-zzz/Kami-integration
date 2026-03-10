'use client';
import { Tab, Tabs } from '@nextui-org/react';
import PublicProfile from './publicProfile';
import Account from './account';
import Notifications from './notifications';
import PrivacyDisplay from './privacyDisplay';
import Rewards from './rewards';

export default function Settings() {
	return (
		<main className='flex flex-col h-full   p-10 '>
			<Tabs
				variant='underlined'
				aria-label='Tabs variants'
				isVertical
				classNames={{
					tabList:
						'gap-4 w-full relative rounded-none p-0 border-b border-divider w-[250px] ',
					cursor: 'w-full bg-[#F1F0EB] h-[1px]',
					tab: 'max-w-full px-0 h-12 text-left border-b-[0.5px] border-b-[#323131] ',
					tabContent:
						'group-data-[selected=true]:text-[#F1F0EB] text-[#F1F0EB80] w-full text-[13px]',
					panel: 'ml-10 mt-6 w-full',
				}}
			>
				<Tab key='profile' title='Public Profile'>
					<PublicProfile />
				</Tab>
				<Tab key='notifications' title='Notifications'>
					<Notifications />
				</Tab>

				<Tab
					key='tnc'
					title='Terms & Conditions'
					target='_blank'
					href='https://kamiunlimited.com/wp-content/uploads/2024/04/KAMI-Website-Terms-And-Conditions-2-0.pdf'
				></Tab>
				<Tab
					key='pp'
					title='Privacy Policy'
					target='_blank'
					href='https://kamiunlimited.com/wp-content/uploads/2024/04/KAMI-Website-Privacy-Policy-2-0.pdf'
				></Tab>
			</Tabs>
		</main>
	);
}

{
	/* <Tab key='account' title='Account Setting & Security'>
<Account />
</Tab>
<Tab key='payments' title='Payments & Wallets'>
<p>Payments & Wallets</p>
</Tab>


<Tab key='rewards' title='Rewards & Referrals'>
<Rewards />
</Tab>
<Tab key='privacy' title='Privacy & Display'>
<PrivacyDisplay />
</Tab> */
}
