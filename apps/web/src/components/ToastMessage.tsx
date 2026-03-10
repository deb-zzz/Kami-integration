import React from 'react';
import { toast } from 'react-toastify';

export const ToastMessage = (
	type: 'default' | 'info' | 'success' | 'warning' | 'error',
	message: string
) => {
	toast(message, {
		type: type,
	});
};
