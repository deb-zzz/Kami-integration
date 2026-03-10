"use client";
import { GetCheckoutByIdResponse } from "@/types/cart-types";
import React from "react";
import { numberFormat } from "@/lib/Util";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CheckoutLoadingModalProps extends CheckoutModalProps {
  loadingState?: string;
}

// Loading Modal - Left most modal in the image
export const CheckoutLoadingModal: React.FC<CheckoutLoadingModalProps> = ({
  isOpen,
  onClose,
  loadingState = "Processing...",
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 text-center">
        <div className="mb-6">
          <div className="w-24 h-24 mx-auto mb-4 relative">
            <div className="w-24 h-24 border-4 border-gray-200 rounded-full"></div>
            <div className="w-24 h-24 border-4 border-green-500 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
          </div>
          <h2 className="text-2xl font-semibold text-[#A79755] mb-2">
            Transaction processing
          </h2>
          <p className="text-gray-600 font-medium mb-2">{loadingState}</p>
          <p className="text-gray-600 text-sm">Please wait for a moment...</p>
          <p className="text-red-600 text-sm mt-2">{`Don't close the tab when this appear`}</p>
        </div>
      </div>
    </div>
  );
};

// Success Modal - Middle modal in the image
interface CheckoutSuccessModalProps extends CheckoutModalProps {
  checkoutResponse: GetCheckoutByIdResponse | null;
}

export const CheckoutSuccessModal: React.FC<CheckoutSuccessModalProps> = ({
  isOpen,
  onClose,
  checkoutResponse,
}) => {
    if (!isOpen || !checkoutResponse) return null;
    const orders = checkoutResponse.orders ?? [];
    const currency = orders[0]?.currency || 'USDC';
    let itemTotalIndex = 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-semibold text-[#A79755] mb-4">
            Transaction successful!
          </h2>
        </div>

        <div className="space-y-3 mb-6 text-black">
          {orders.map((order, index) => (
            <div key={order.id} className="space-y-2">
              {order.orderItems.map((item, itemIndex) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center pl-4">
                  <div>
                    <div className="font-medium">
                      {`${itemTotalIndex++}. ${item.product.name}`}
                    </div>
                    <div className="text-sm text-gray-600">
                      {item.quantity} × {numberFormat(item.unitPrice, 2)} {currency}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{numberFormat(item.subtotal, 2)} {currency}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="pt-4 mb-6 text-black">
          <div className="bg-[#F1F0EB] rounded-md p-3 space-y-2">
            {(checkoutResponse.checkoutCharges ?? []).map((charge) => (
              <div key={charge.id} className="flex justify-between text-sm">
                <span>{charge.chargeTypeName}</span>
                <span>{numberFormat(charge.appliedAmount, 2)} {currency}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-semibold text-lg mt-2 py-3 border-y border-black ">
            <span>Total</span>
            <span>{numberFormat(checkoutResponse.totalAmount, 2)} {currency}</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-[#A79755] text-white py-3 rounded-lg font-semibold hover:opacity-90">
          Close
        </button>
      </div>
    </div>
  );
};

// Failure Modal - Right most modal in the image
interface CheckoutFailureModalProps extends CheckoutModalProps {
  errorMessage?: string | GetCheckoutByIdResponse;
}

export const CheckoutFailureModal: React.FC<CheckoutFailureModalProps> = ({
  isOpen,
  onClose,
  errorMessage = "Something went wrong, please try again later",
}) => {
  if (!isOpen) return null;

  // Check if errorMessage is a checkout response object
  const isCheckoutResponse = typeof errorMessage === 'object' && errorMessage !== null && 'orders' in errorMessage;
  
  if (isCheckoutResponse) {
    const checkoutData = errorMessage as GetCheckoutByIdResponse;
    const orders = checkoutData.orders ?? [];
    const currency = orders[0]?.currency || 'USDC';
    
    // Analyze order items to determine status
    const allOrderItems = orders.flatMap(order => order.orderItems ?? []);
    const failedItems = allOrderItems.filter(item => 
      item.status.toLowerCase() === 'failed' || item.status.toLowerCase() === 'cancelled'
    );
    const successItems = allOrderItems.filter(item => 
      item.status.toLowerCase() === 'completed'
    );
    
    const isPartial = failedItems.length > 0 && successItems.length > 0;
    const headerText = isPartial ? "Transaction Partially Completed" : "Transaction Failed";
    const headerColor = isPartial ? "text-orange-600" : "text-red-600";
    const iconBgColor = isPartial ? "bg-orange-500" : "bg-red-500";

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="text-center mb-6">
            <div className={`w-24 h-24 mx-auto mb-4 ${iconBgColor} rounded-full flex items-center justify-center`}>
              {isPartial ? (
                <svg
                  className="w-12 h-12 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-12 h-12 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </div>
            <h2 className={`text-2xl font-semibold ${headerColor} mb-2`}>
              {headerText}
            </h2>
            {isPartial && (
              <p className="text-gray-600 mb-4">
                Some items were processed successfully, but others failed.
              </p>
            )}
          </div>

          <div className="space-y-4 mb-6 text-black">
            {/* Successful Items */}
            {successItems.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-2 flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Successful Items ({successItems.length})
                </h3>
                <div className="space-y-2">
                  {successItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-start text-sm">
                      <div className="flex-1">
                        <div className="font-medium text-green-900">{item.product.name}</div>
                        <div className="text-green-700">Quantity: {item.quantity}</div>
                      </div>
                      <div className="text-green-900 font-medium">
                        {numberFormat(item.subtotal, 2)} {currency}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Failed Items */}
            {failedItems.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-800 mb-2 flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  Failed Items ({failedItems.length})
                </h3>
                <div className="space-y-3">
                  {failedItems.map((item) => (
                    <div key={item.id} className="border-b border-red-200 last:border-0 pb-2 last:pb-0">
                      <div className="flex justify-between items-start text-sm mb-1">
                        <div className="flex-1">
                          <div className="font-medium text-red-900">{item.product.name}</div>
                          <div className="text-red-700">Quantity: {item.quantity}</div>
                        </div>
                        <div className="text-red-900 font-medium">
                          {numberFormat(item.subtotal, 2)} {currency}
                        </div>
                      </div>
                      {item.errorMessage && (
                        <div className="bg-red-100 rounded p-2 mt-2">
                          <p className="text-xs text-red-800">
                            <span className="font-semibold">Error:</span> {item.errorMessage}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full bg-gray-500 text-white py-3 rounded-lg font-semibold hover:opacity-90">
            Close
          </button>
        </div>
      </div>
    );
  }

  // Handle string error messages (original behavior)
  const safeMessage = (() => {
    try {
      if (typeof errorMessage === 'string') return errorMessage;
      if (errorMessage == null) return "Something went wrong, please try again later";
      // Handle Error objects and other types safely
      if ((errorMessage as any)?.message && typeof (errorMessage as any).message === 'string') {
        return (errorMessage as any).message as string;
      }
      try {
        return JSON.stringify(errorMessage);
      } catch {
        return String(errorMessage);
      }
    } catch {
      return "Something went wrong, please try again later";
    }
  })();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 text-center">
        <div className="mb-6">
          <div className="w-24 h-24 mx-auto mb-4 bg-red-500 rounded-full flex items-center justify-center">
            <svg
              className="w-12 h-12 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-red-600 mb-2">
            Transaction failed
          </h2>
          <p className="text-gray-600">{safeMessage}</p>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-gray-500 text-white py-3 rounded-lg font-semibold hover:opacity-90">
          Close
        </button>
      </div>
    </div>
  );
};
