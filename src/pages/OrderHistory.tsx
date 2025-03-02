import React, { useState } from 'react';
import { useOrders } from '../contexts/OrderContext';
import OrderTable from '../components/OrderTable';
import { Filter, RefreshCw, Download } from 'lucide-react';
import { format } from 'date-fns';

const OrderHistory: React.FC = () => {
  const { orders } = useOrders();
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'EXECUTING' | 'EXECUTED' | 'FAILED' | 'CANCELLED'>('ALL');
  
  // Export orders to CSV
  const exportToCSV = () => {
    // Filter orders based on current filter
    const filteredOrders = filter === 'ALL' 
      ? orders 
      : orders.filter(order => order.status === filter);
    
    // Sort by date (newest first)
    const sortedOrders = [...filteredOrders].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    // Create CSV content
    const headers = ['Date', 'Type', 'Pair', 'Amount', 'Trigger Price', 'Status', 'Transaction'];
    const rows = sortedOrders.map(order => [
      format(order.createdAt, 'yyyy-MM-dd HH:mm:ss'),
      order.orderType,
      `${order.inputToken}/${order.outputToken}`,
      order.inputAmount.toString(),
      order.triggerPrice.toString(),
      order.status,
      order.transactionSignature || ''
    ]);
    
    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `jupiter-orders-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Order History</h1>
        
        <div className="flex space-x-2">
          <div className="relative">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="bg-gray-700 border border-gray-600 text-white rounded-md py-2 pl-3 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">All Orders</option>
              <option value="PENDING">Pending</option>
              <option value="EXECUTING">Executing</option>
              <option value="EXECUTED">Executed</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
              <Filter className="h-4 w-4" />
            </div>
          </div>
          
          <button
            onClick={() => window.location.reload()}
            className="bg-gray-700 hover:bg-gray-600 text-white rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          
          <button
            onClick={exportToCSV}
            className="bg-gray-700 hover:bg-gray-600 text-white rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Export to CSV"
          >
            <Download className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      {/* Order Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard 
          title="Total Orders" 
          value={orders.length} 
          color="blue"
        />
        <StatCard 
          title="Pending" 
          value={orders.filter(o => o.status === 'PENDING').length} 
          color="yellow"
        />
        <StatCard 
          title="Executed" 
          value={orders.filter(o => o.status === 'EXECUTED').length} 
          color="green"
        />
        <StatCard 
          title="Failed/Cancelled" 
          value={orders.filter(o => ['FAILED', 'CANCELLED'].includes(o.status)).length} 
          color="red"
        />
      </div>
      
      <OrderTable filter={filter} />
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: number;
  color: 'blue' | 'green' | 'yellow' | 'red';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, color }) => {
  const colorClasses = {
    blue: 'bg-blue-900 border-blue-700',
    green: 'bg-green-900 border-green-700',
    yellow: 'bg-yellow-900 border-yellow-700',
    red: 'bg-red-900 border-red-700',
  }[color];
  
  return (
    <div className={`${colorClasses} rounded-lg border p-4`}>
      <h3 className="text-sm font-medium text-gray-300">{title}</h3>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
};

export default OrderHistory;