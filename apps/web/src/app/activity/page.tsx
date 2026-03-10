"use client";
import { getActivities } from "@/apihandler/Activity";
import { useGlobalState } from "@/lib/GlobalContext";
import { ActivityType, NotificationMessage } from "@/types";
import { Divider } from "@nextui-org/react";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";

export default function Activity() {
	const router = useRouter();
	const [gs] = useGlobalState();
	const [activity, setActivity] = useState<Record<string, ActivityType[]>>();
	useEffect(() => {
		if (gs?.walletAddress) {
			getActivity(gs.walletAddress);
		}
	}, [gs, gs?.walletAddress]);

	const getActivity = async (address: string) => {
		//Don't forget to change the address
		try {
			const res = await getActivities(address);
			if (res.success) {
				const act = res.activity
					.sort(
						(a, b) =>
							new Date(b.activityTime).getTime() - new Date(a.activityTime).getTime()
					)
					.reduce((acc, curr) => {
						const activityDate = new Date(curr.activityTime);
						const today = new Date();
						const isToday = activityDate.toDateString() === today.toDateString();
						const dateKey = isToday ? "Today" : activityDate.toLocaleDateString();

						if (!acc[dateKey]) {
							acc[dateKey] = [];
						}

						// Categorize based on entity type
						const entityType = curr.notification.entityType;
						if (
							entityType === "Post" ||
							entityType === "Product" ||
							entityType === "Collection" ||
							entityType === "User"
						) {
							curr.category = "Social";
						} else if (entityType === "Collaborate" || entityType === null) {
							const socialKeywords = ["profile", "post", "collection", "product"];
							const topic = curr.notification.message?.topic || "";
							const isSocial = socialKeywords.some((keyword) =>
								topic.toLowerCase().includes(keyword)
							);

							if (isSocial) {
								curr.category = "Social";
							} else if (topic.toLowerCase().includes("order")) {
								curr.category = "Marketplace";
							} else {
								curr.category = "Collaboration";
							}
						}

						acc[dateKey].push(curr);
						return acc;
					}, {} as Record<string, ActivityType[]>);
				setActivity(act);
			}
		} catch (error) {
			console.error("Error fetching activities:", error);
		}
	};

	return (
		<main className="h-full px-10 pb-10 ">
			<div className="w-3/4">
				<div className="flex flex-row items-center gap-4  mb-6">
					<BackButton />
					<p className="text-[19px] font-normal">Activity</p>
				</div>

				{activity && Object.entries(activity).length > 0 ? (
					Object.entries(activity).map(([date, activities]) => (
						<div key={date} className="mb-10">
							<p className="text-[16px] font-light">{date}</p>
							<Divider className="my-2 bg-[#F1F0EB]" />
							<div className="flex flex-col gap-4 my-5">
								{["Collaboration", "Marketplace", "Social"].map((category) => {
									const filteredActivities = activities.filter((a) => a.category === category);
									if (filteredActivities.length > 0) {
										return (
											<div key={category}>
												<div
													className={`${
														{
															Social: "bg-[#D6AD88]",
															Marketplace: "bg-[#93B2A0]",
														}[category] || "bg-[#C8C57F]"
													} w-[90px] rounded-[4px] p-[2px] mb-4 mt-3`}
												>
													<p className="text-[12px] text-[#1A1A1A] text-center font-medium">{category}</p>
												</div>
												<div className="flex flex-col gap-4 my-2">
													{filteredActivities.map((a, index) => {
														const act = a.notification.message as unknown as NotificationMessage;

														// Fallback: Check if message exists in the notification object directly
														const displayMessage =
															act?.message ||
															(typeof a.notification.message === "string" ? a.notification.message : "");

														if (displayMessage) {
															return (
																<div key={index} className="flex flex-col gap-[2px]">
																	{a.notification.entityType !== null ? (
																		<p className="font-light">{displayMessage}</p>
																	) : (
																		<p
																			className="font-light"
																			dangerouslySetInnerHTML={{
																				__html: act?.payload?.from?.userName
																					? displayMessage.replace(
																							act.payload.from.userName,
																							`<span class='font-semibold'>${act.payload.from.userName}</span>`
																					  )
																					: displayMessage,
																			}}
																		></p>
																	)}

																	<p className="text-[11px] text-[#6E6E6E]">
																		{formatDistanceToNow(new Date(a.activityTime), {
																			addSuffix: true,
																		})}
																	</p>
																</div>
															);
														}
														return null;
													})}
												</div>
											</div>
										);
									}
								})}
							</div>
						</div>
					))
				) : (
					<div className="mt-10">
						<p>Oops! You have no activity updates for now.</p>
					</div>
				)}
			</div>
		</main>
	);
}
