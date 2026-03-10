'use client';

import Cropper, { Area } from 'react-easy-crop';
import { useEffect, useState, useCallback, type FC } from 'react';
import { getCroppedImg } from '@/lib/cropImage';

interface ImageEditorProps {
	file: File;
	onImageCropped: (blob: Blob | null) => void;
}

const ImageEditor: FC<ImageEditorProps> = ({ file, onImageCropped }) => {
	const [imageUrl, setImageUrl] = useState<string | null>(null);
	const [crop, setCrop] = useState({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(
		null
	);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);

	useEffect(() => {
		const url = URL.createObjectURL(file);
		setImageUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [file]);

	const onCropComplete = useCallback(
		(croppedArea: Area, croppedAreaPixels: Area) => {
			setCroppedAreaPixels(croppedAreaPixels);
		},
		[]
	);

	useEffect(() => {
		const generateCroppedImage = async () => {
			if (!imageUrl || !croppedAreaPixels) return;

			try {
				const croppedImage = await getCroppedImg(
					imageUrl,
					croppedAreaPixels
				);
				if (croppedImage) {
					const blob = await fetch(croppedImage).then((res) =>
						res.blob()
					);
					onImageCropped(blob);
					// Clean up previous preview URL
					if (previewUrl) {
						URL.revokeObjectURL(previewUrl);
					}
					setPreviewUrl(croppedImage);
				}
			} catch (error) {
				console.error('Error generating cropped image:', error);
			}
		};

		generateCroppedImage();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [imageUrl, croppedAreaPixels]);

	// Cleanup preview URL on unmount
	useEffect(() => {
		return () => {
			if (previewUrl) {
				URL.revokeObjectURL(previewUrl);
			}
		};
	}, [previewUrl]);

	return (
		<div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>
			<div className='lg:col-span-2'>
				<div>
					<div>
						<p>Crop Image</p>
						<p>Drag and resize the box to crop.</p>
					</div>
					<div>
						<div className='relative w-full overflow-hidden bg-muted rounded-lg aspect-video'>
							{imageUrl && (
								<Cropper
									image={imageUrl}
									crop={crop}
									zoom={zoom}
									aspect={undefined}
									onCropChange={setCrop}
									onZoomChange={setZoom}
									onCropComplete={onCropComplete}
									style={{
										containerStyle: {
											position: 'relative',
											width: '100%',
											height: '100%',
										},
									}}
								/>
							)}
						</div>
						<div className='mt-4'>
							<label className='block text-sm font-medium mb-2'>
								Zoom: {Math.round(zoom * 100)}%
							</label>
							<input
								type='range'
								min={1}
								max={3}
								step={0.1}
								value={zoom}
								onChange={(e) =>
									setZoom(Number(e.target.value))
								}
								className='w-full'
							/>
						</div>
					</div>
				</div>
			</div>

			<div className='lg:col-span-1'>
				<div>
					<div>
						<p>Preview</p>
					</div>
					<div className='flex items-center justify-center'>
						{previewUrl ? (
							<img
								src={previewUrl}
								alt='Cropped preview'
								className='max-w-full max-h-64 rounded-md shadow-lg object-contain'
							/>
						) : (
							<div className='w-full h-64 flex items-center justify-center bg-muted rounded-md'>
								<p className='text-muted-foreground'>
									Preview will appear here
								</p>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default ImageEditor;
