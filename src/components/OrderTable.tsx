import React from 'react';
import { format } from 'date-fns';
import { useWallet } from '@solana/wallet-adapter-react';
import { useOrders, Order } from '../contexts/OrderContext';
import { TOKEN_METADATA } from '../services/jupiterService';
import { AlertTriangle, Check, Clock, X, RefreshCw, ExternalLink } from 'lucide-react';

interface OrderTableProps {
  filter?: 'PENDING' | 'EXECUTING' | 'EXECUTED' | 'FAILED' | 'CANCELLED' | 'ALL';
  limit?: number;
}

const OrderTable: React.FC<OrderTableProps> = ({ 
  filter = 'ALL',
  limit
}) => {
  const { publicKey } = useWallet();
  const { orders, cancelOrder, retryOrder, isLoading } = useOrders();
  
  // Filter and sort orders
  const filteredOrders = orders
    .filter(order => filter === 'ALL' || order.status === filter)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
  
  if (!publicKey) {
    return (
      <div className="bg-gray-800 rounded-lg shadow-lg p-6 text-center">
        <p className="text-gray-400">Please connect your wallet to view orders</p>
      </div>
    );
  }
  
  if (filteredOrders.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg shadow-lg p-6 text-center">
        <p className="text-gray-400">No orders found</p>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Pair
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Amount
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Trigger Price
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Created
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {filteredOrders.map((order) => (
              <OrderRow 
                key={order.id} 
                order={order} 
                onCancel={cancelOrder}
                onRetry={retryOrder}
                isLoading={isLoading}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface OrderRowProps {
  order: Order;
  onCancel: (id: string) => Promise<void>;
  onRetry: (id: string) => Promise<void>;
  isLoading: boolean;
}

const OrderRow: React.FC<OrderRowProps> = ({ order, onCancel, onRetry, isLoading }) => {
  const handleCancel = async () => {
    if (order.id) {
      await onCancel(order.id);
    }
  };

  const handleRetry = async () => {
    if (order.id) {
      await onRetry(order.id);
    }
  };

  const inputSymbol = TOKEN_METADATA[order.inputToken]?.symbol || 'Unknown';
  const outputSymbol = TOKEN_METADATA[order.outputToken]?.symbol || 'Unknown';

  // Status rendering logic
  const statusConfig = {
    PENDING: { color: 'bg-yellow-900 text-yellow-200', icon: <Clock className="h-4 w-4" /> },
    EXECUTING: { color: 'bg-blue-900 text-blue-200', icon: <RefreshCw className="h-4 w-4 animate-spin" /> },
    EXECUTED: { color: 'bg-green-900 text-green-200', icon: <Check className="h-4 w-4" /> },
    FAILED: { color: 'bg-red-900 text-red-200', icon: <AlertTriangle className="h-4 w-4" /> },
    CANCELLED: { color: 'bg-gray-600 text-gray-200', icon: <X className="h-4 w-4" /> },
  }[order.status];

  // Get explorer URL for transaction
  const getExplorerUrl = (signature: string) => {
    const network = import.meta.env.VITE_SOLANA_NETWORK || 'devnet';
    const baseUrl = network === 'mainnet-beta' 
      ? 'https://explorer.solana.com/tx/' 
      : 'https://explorer.solana.com/tx/';
    
    return `${baseUrl}${signature}?cluster=${network}`;
  };

  return (
    <tr>
      {/* Type */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          order.orderType === 'LIMIT' ? 'bg-blue-900 text-blue-200' :
          order.orderType === 'STOP_LOSS' ? 'bg-red-900 text-red-200' :
          'bg-green-900 text-green-200'
        }`}>
          {order.orderType}
        </div>
      </td>

      {/* Pair */}
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
        {inputSymbol}/{outputSymbol}
      </td>

      {/* Amount */}
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
        {order.inputAmount} {inputSymbol}
      </td>

      {/* Trigger Price */}
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
        {order.triggerPrice} {outputSymbol}
      </td>

      {/* Status */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className={`inline-flex items-center ${statusConfig.color} px-2.5 py-0.5 rounded-full text-xs font-medium`}>
          {statusConfig.icon}
          <span className="ml-1">{order.status}</span>
        </div>
      </td>

      {/* Created */}
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
        {format(order.createdAt, 'MMM dd, HH:mm')}
      </td>

      {/* Actions */}
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex items-center justify-end space-x-2">
          {order.status === 'PENDING' && (
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className="text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          )}
          
          {order.status === 'FAILED' && (
            <button
              onClick={handleRetry}
              disabled={isLoading}
              className="text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Retry
            </button>
          )}
          
          {order.status === 'EXECUTED' && order.transactionSignature && (
            <a
              href={getExplorerUrl(order.transactionSignature)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 flex items-center"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              View
            </a>
          )}
        </div>
      </td>
    </tr>
  );
};

export default OrderTable;