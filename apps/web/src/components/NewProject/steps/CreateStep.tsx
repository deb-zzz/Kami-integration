'use client';
import { editProfile, getProfile } from '@/apihandler/Profile';
import {
	createProject,
	establishUploadLink,
	getProject,
	getProjectCollaborators,
	updateProject,
	UploadReturn,
} from '@/apihandler/Project';
import { useGlobalState } from '@/lib/GlobalContext';
import { AllProjectType, CollaboratorType, Profile } from '@/types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { CheckboxIcon, Spinner } from '@nextui-org/react';
import _, { set } from 'lodash';
import { useParams } from 'next/navigation';
import React, { useRef, useState } from 'react';
import { useCallback, useEffect } from 'react';
import useKamiWallet from '@/lib/KamiWalletHook';
import {
	AssetRecordType,
	createShapeId,
	DefaultStylePanel,
	DefaultStylePanelContent,
	DefaultToolbar,
	DefaultToolbarContent,
	DefaultTopPanel,
	Editor,
	getHashForString,
	getSnapshot,
	loadSnapshot,
	react,
	TLAssetStore,
	TLBookmarkAsset,
	Tldraw,
	TldrawUiMenuToolItem,
	TLEventMapHandler,
	TLGeoShape,
	TLUiStylePanelProps,
	useEditor,
	useRelevantStyles,
} from 'tldraw';
import 'tldraw/tldraw.css';
import { useSync } from '@tldraw/sync';

let gProjectId: number;
let gProfileName: string;

const multiplayerAssets: TLAssetStore = {
	async upload(_asset, file) {
		const { url, path } = await establishUploadLink(
			file.name,
			getMimeType(file.name),
			gProfileName,
			'whiteboard/asset',
			gProjectId
		);
		const response = await fetch(url, {
			method: 'PUT',
			headers: {
				'Content-Type': getMimeType(file.name),
			},
			body: file,
			cache: 'no-store',
		});

		if (!response.ok) {
			throw new Error(`Failed to upload asset: ${response.statusText}`);
		}

		return { src: path };
	},
	resolve(asset) {
		console.log(JSON.stringify(asset));
		return asset.props.src;
	},
};

type CreateStepProps = {
	isActionDisabled: boolean;
};

export default function CreateStep(props: CreateStepProps) {
	const params = useParams<{ projectId: string; writeAccess: string }>();
	const project = useRef<AllProjectType>();
	const profileName = useRef<string>();
	const [collaborators, setCollaborators] = useState<CollaboratorType[]>([]);
	const store = useSync({
		// We need to know the websocket's URI...
		uri: `${process.env.NEXT_PUBLIC_SYNC_URL}/connect/${
			params.projectId
		}?readonly=${!true}`,
		// ...and how to handle static assets like images & videos
		assets: multiplayerAssets,
		// ...and how to handle bookmark unfurling
		userInfo: {
			id: profileName.current ?? 'user',
			name: profileName.current ?? 'user',
			color: '#998822',
		},
	});

	const InsideComponent = (props: TLUiStylePanelProps) => {
		let timeout: number;
		const timeourTimer = 2000;

		const styles = useRelevantStyles();
		const editor = useEditor();

		// const snapshot = useRef<any>();
		// const [snapshot, setSnapshot] = useState<any>();
		const wallet = useKamiWallet();
		const [saving, setSaving] = useState(false);
		const [loading, setLoading] = useState(true);

		useEffect(() => {
			const w = wallet?.getAccount();
			if (w?.address) {
				if (!gProfileName) {
					getProfile(w.address).then((data) => {
						if (!data.success) return;
						profileName.current = data.profile.userName;
						gProfileName = data.profile.userName;
						// console.log('Param', params.writeAccess);
						// setGs({ profile: data.profile });
					});
				}
				// if(params)
				if (!gProjectId) {
					getProject(w.address, params.projectId as unknown as number)
						.then((response) => {
							project.current = response.project;
							gProjectId = project.current?.id;
							if (project.current?.whiteboardUrl) {
								fetch(project.current?.whiteboardUrl, {
									cache: 'no-store',
								}).then((res) => {
									res.json().then((data) => {
										loadSnapshotToEditor(data);
									});
								});
							}
						})
						.finally(() => {
							setLoading(false);
						});
				}
				// getProjectCollaborators(project.current?.id ?? 0).then((response) => {
				// 	console.log('Collaborators', response.collaborators);
				// 	setCollaborators(response.collaborators);
				// });
				// else
				// 	createProject(w.address, { name: 'Untitled', description: 'Description' })
				// 	.then((response) => {
				// 		project.current = response.project;
				// 		if(project.current?.whiteboardUrl){
				// 			fetch(project.current?.whiteboardUrl,{cache: 'no-store'})
				// 			.then((res) => {
				// 				res.json()
				// 				.then((data) => {
				// 					loadSnapshotToEditor(data);
				// 				});
				// 			})
				// 			.finally(() => {
				// 				setLoading(false);
				// 			});
				// 		}
				// 	});
			}
		}, [wallet?.getAccount()]);

		// const setAppToState = useCallback((editor: Editor) => {
		// 	setEditor(editor);
		// }, [editor])

		useEffect(() => {
			if (!editor) return;

			const handleChangeEvent: TLEventMapHandler<'change'> = (change) => {
				// console.log('Change Event', change);
				window.clearTimeout(timeout);
				setSaving(true);
				timeout = window.setTimeout(() => {
					save();
				}, timeourTimer);
			};

			// [2]
			const cleanupFunction = editor.store.listen(handleChangeEvent, {
				source: 'user',
				scope: 'document',
			});

			return () => {
				cleanupFunction();
			};
		}, [editor]);

		const save = async () => {
			if (!editor) return;
			// console.log('Saving',project.current?.id, project.current?.walletAddress, profileName.current);
			const { url, path } = await establishUploadLink(
				'drawing.json',
				'application/json',
				profileName.current || 'default',
				'whiteboard',
				project.current?.id || 0
			);
			// console.log('Established Upload Link', url, path);
			const snapshot = getSnapshotFromEditor();
			// console.log('Snapshot', snapshot);
			const res = await fetch(url, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: snapshot,
				cache: 'no-store',
			});
			// console.log('Save Response', res);

			if (res.status === 200) {
				setSaving(false);
				// console.log('Saved', project.current?.id, project.current?.walletAddress, path);
				updateProject(
					project.current?.walletAddress ?? '',
					project.current?.id ?? 0,
					{
						id: project.current?.id ?? 0,
						name: project.current?.name ?? '',
						description: project.current?.description ?? '',
						whiteboardUrl: path ?? '',
						user: project.current?.user as Profile,
					}
				);
			} else {
				// console.log('Error');
			}
		};

		const getSnapshotFromEditor = useCallback(() => {
			if (!editor) return;
			const { document, session } = getSnapshot(editor.store);
			return JSON.stringify({ document, session });
		}, [editor]);

		const loadSnapshotToEditor = (snapshot: any) => {
			if (!editor) {
				console.log('Editor is null');
				return;
			}
			loadSnapshot(editor.store, snapshot);
		};
		return (
			<DefaultStylePanel {...props}>
				<DefaultStylePanelContent styles={styles} />
				<div
					className={`flex flex-1 h-10 p-2 justify-center content-center gap-2 object-center ${
						saving
							? 'bg-yellow-100 '
							: loading
							? 'bg-yellow-100 '
							: 'bg-green-100 '
					}`}
				>
					{(loading || saving) && (
						<Spinner size='sm' color='default' />
					)}
					<span className='italic'>
						{saving
							? 'Saving...'
							: loading
							? 'Loading...'
							: 'Saved'}
					</span>
				</div>
			</DefaultStylePanel>
		);
	};
	const TopPanel = () => {
		return (
			<DefaultToolbar>
				<DefaultToolbarContent></DefaultToolbarContent>
			</DefaultToolbar>
		);
	};

	return (
		// <div className={`${isFullScreen?'fullscreen':''}`}>
		<div className={'h-[600px] w-full tldraw__editor '}>
			<Tldraw
				className={'p-0 bg-[#F1F0EB]'}
				components={{
					StylePanel: InsideComponent,
					TopPanel: TopPanel,
					Toolbar: null,
				}}
				// hideUi
				store={store}
				onMount={(editor) => {
					// console.log('onMount I AM HERE MF', editor);

					editor.updateInstanceState({ isReadonly: props.isActionDisabled });
					// @ts-expect-error
					window.editor = editor;
					return react('clean up selection', () => {
						const selectedShapeIds = editor.getSelectedShapeIds();
						const filteredSelectedShapeIds =
							selectedShapeIds.filter(
								(id) => !editor.isShapeHidden(id)
							);
						if (
							selectedShapeIds.length !==
							filteredSelectedShapeIds.length
						) {
							editor.setSelectedShapes(filteredSelectedShapeIds);
						}
					});
					// when the editor is ready, we need to register out bookmark unfurling service
					// editor.registerExternalAssetHandler('url', unfurlBookmarkUrl)
				}}
			>
				<AddTextOnLoad />
			</Tldraw>
		</div>
		// </div>
	);
}

function AddTextOnLoad() {
	const editor = useEditor();
	const hasAddedText = useRef(false);

	useEffect(() => {
		// Add a text shape when the component mounts, but only once
		console.log('Editor in AddTextOnLoad', editor);
		if (!editor || hasAddedText.current) return;

		// Check if there are already any shapes in the editor
		const shapes = editor.getCurrentPageShapes();
		if (shapes.length > 0) {
			hasAddedText.current = true;
			return;
		}

		editor.createShape({
			type: 'text',
			x: 100,
			y: 100,
			props: {
				text: `Start here. \n Write / draw / sketch / upload your ideas.`,
			},
		});
		hasAddedText.current = true;
	}, [editor]); // Ensure effect runs when editor is available

	return null; // Return null as this component does not render any UI
}

// How does our server handle bookmark unfurling?
async function unfurlBookmarkUrl({
	url,
}: {
	url: string;
}): Promise<TLBookmarkAsset> {
	const asset: TLBookmarkAsset = {
		id: AssetRecordType.createId(getHashForString(url)),
		typeName: 'asset',
		type: 'bookmark',
		meta: {},
		props: {
			src: url,
			description: '',
			image: '',
			favicon: '',
			title: '',
		},
	};

	try {
		const response = await fetch(
			`${
				process.env.NEXT_PUBLIC_SYNC_URL
			}/unfurl?url=${encodeURIComponent(url)}`
		);
		const data = await response.json();
		console.log('data', data);
		asset.props.description = data?.description ?? '';
		asset.props.image = data?.image ?? '';
		asset.props.favicon = data?.favicon ?? '';
		asset.props.title = data?.title ?? '';
	} catch (e) {
		console.error(e);
	}

	return asset;
}

function getMimeType(filename: string) {
	const ext = filename.split('.').pop();
	switch (ext) {
		case 'png':
			return 'image/png';
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg';
		case 'gif':
			return 'image/gif';
		case 'svg':
			return 'image/svg+xml';
		case 'mp4':
			return 'video/mp4';
		case 'webm':
			return 'video/webm';
		case 'mp3':
			return 'audio/mp3';
		case 'wav':
			return 'audio/wav';
		case 'ogg':
			return 'audio/ogg';
		default:
			return 'application/octet-stream';
	}
}
