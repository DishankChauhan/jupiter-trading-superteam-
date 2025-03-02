import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ArrowDownUp, AlertTriangle, TrendingUp } from 'lucide-react';
import { useOrders, OrderType } from '../contexts/OrderContext';
import { usePrice } from '../contexts/PriceContext';
import { TOKENS, TOKEN_METADATA } from '../services/jupiterService';
import toast from 'react-hot-toast';
import Decimal from 'decimal.js';

const OrderForm: React.FC = () => {
  const { connected } = useWallet();
  const { createOrder, isLoading } = useOrders();
  const { getPriceForPair, isLoading: isPriceLoading } = usePrice();
  
  const [inputToken, setInputToken] = useState(TOKENS.SOL);
  const [outputToken, setOutputToken] = useState(TOKENS.USDC);
  const [inputAmount, setInputAmount] = useState('1');
  const [orderType, setOrderType] = useState<OrderType>('LIMIT');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [slippage, setSlippage] = useState('1.0');
  
  // Fetch current price when tokens change
  useEffect(() => {
    const fetchPrice = async () => {
      if (inputToken && outputToken) {
        try {
          const price = await getPriceForPair(inputToken, outputToken);
          setCurrentPrice(price);
          
          // Set default trigger price based on order type
          if (!triggerPrice) {
            if (orderType === 'LIMIT') {
              // For limit orders, default to 5% below market
              setTriggerPrice((price * 0.95).toFixed(6));
            } else if (orderType === 'STOP_LOSS') {
              // For stop loss, default to 10% below market
              setTriggerPrice((price * 0.9).toFixed(6));
            } else if (orderType === 'TAKE_PROFIT') {
              // For take profit, default to 10% above market
              setTriggerPrice((price * 1.1).toFixed(6));
            }
          }
        } catch (error) {
          console.error('Error fetching price:', error);
          toast.error('Failed to fetch current price');
        }
      }
    };
    
    fetchPrice();
    
    // Refresh price every 10 seconds
    const interval = setInterval(fetchPrice, 10000);
    return () => clearInterval(interval);
  }, [inputToken, outputToken, orderType, getPriceForPair]);
  
  // Swap tokens
  const handleSwapTokens = () => {
    const temp = inputToken;
    setInputToken(outputToken);
    setOutputToken(temp);
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!connected) {
      toast.error('Please connect your wallet first');
      return;
    }
    
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    if (!triggerPrice || parseFloat(triggerPrice) <= 0) {
      toast.error('Please enter a valid trigger price');
      return;
    }
    
    try {
      await createOrder({
        inputToken,
        outputToken,
        inputAmount: parseFloat(inputAmount),
        orderType,
        triggerPrice: parseFloat(triggerPrice),
      });
      
      // Reset form
      setInputAmount('1');
      setTriggerPrice('');
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Failed to create order');
    }
  };
  
  // Calculate expected output amount
  const calculateExpectedOutput = () => {
    if (!currentPrice || !inputAmount) return null;
    
    const input = new Decimal(inputAmount);
    const price = new Decimal(currentPrice);
    
    return input.mul(price).toFixed(6);
  };
  
  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold mb-4">Create Order</h2>
      
      <form onSubmit={handleSubmit}>
        {/* Token Selection */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-400">From</label>
            <span className="text-sm text-gray-400">
              {currentPrice ? `1 ${TOKEN_METADATA[inputToken].symbol} = ${currentPrice.toFixed(6)} ${TOKEN_METADATA[outputToken].symbol}` : 'Loading price...'}
            </span>
          </div>
          
          <div className="flex items-center">
            <select
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
              className="bg-gray-700 text-white rounded-l-md border-r border-gray-600 p-2 flex-grow"
            >
              {Object.entries(TOKENS).map(([symbol, mint]) => (
                <option key={mint} value={mint}>
                  {symbol}
                </option>
              ))}
            </select>
            
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              placeholder="Amount"
              className="bg-gray-700 text-white rounded-r-md p-2 flex-grow"
              min="0"
              step="0.000001"
            />
          </div>
        </div>
        
        {/* Swap Button */}
        <div className="flex justify-center my-2">
          <button
            type="button"
            onClick={handleSwapTokens}
            className="bg-gray-700 p-2 rounded-full hover:bg-gray-600 transition-colors"
          >
            <ArrowDownUp className="h-5 w-5 text-blue-400" />
          </button>
        </div>
        
        {/* Output Token */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">To</label>
          <div className="flex items-center">
            <select
              value={outputToken}
              onChange={(e) => setOutputToken(e.target.value)}
              className="bg-gray-700 text-white rounded-l-md p-2 flex-grow"
            >
              {Object.entries(TOKENS).map(([symbol, mint]) => (
                <option key={mint} value={mint} disabled={mint === inputToken}>
                  {symbol}
                </option>
              ))}
            </select>
            
            <div className="bg-gray-700 text-white rounded-r-md p-2 flex-grow text-right">
              {calculateExpectedOutput() || '0.00'}
            </div>
          </div>
        </div>
        
        {/* Order Type */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">Order Type</label>
          <div className="grid grid-cols-3 gap-2">
            <OrderTypeButton
              type="LIMIT"
              current={orderType}
              onClick={() => setOrderType('LIMIT')}
              icon={<ArrowDownUp className="h-4 w-4 mr-1" />}
            />
            <OrderTypeButton
              type="STOP_LOSS"
              current={orderType}
              onClick={() => setOrderType('STOP_LOSS')}
              icon={<AlertTriangle className="h-4 w-4 mr-1" />}
            />
            <OrderTypeButton
              type="TAKE_PROFIT"
              current={orderType}
              onClick={() => setOrderType('TAKE_PROFIT')}
              icon={<TrendingUp className="h-4 w-4 mr-1" />}
            />
          </div>
        </div>
        
        {/* Trigger Price */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            {orderType === 'LIMIT' ? 'Limit Price' : 
             orderType === 'STOP_LOSS' ? 'Stop Price' : 'Target Price'}
          </label>
          <input
            type="number"
            value={triggerPrice}
            onChange={(e) => setTriggerPrice(e.target.value)}
            placeholder={`Enter ${orderType.toLowerCase()} price`}
            className="bg-gray-700 text-white rounded-md p-2 w-full"
            min="0"
            step="0.000001"
          />
          
          {currentPrice && triggerPrice && (
            <div className="mt-2 text-sm">
              <span className={`${
                orderType === 'LIMIT' && parseFloat(triggerPrice) < currentPrice ? 'text-green-400' :
                orderType === 'STOP_LOSS' && parseFloat(triggerPrice) < currentPrice ? 'text-red-400' :
                orderType === 'TAKE_PROFIT' && parseFloat(triggerPrice) > currentPrice ? 'text-green-400' :
                'text-yellow-400'
              }`}>
                {orderType === 'LIMIT' && parseFloat(triggerPrice) < currentPrice ? 
                  `${((1 - parseFloat(triggerPrice) / currentPrice) * 100).toFixed(2)}% below market` :
                 orderType === 'LIMIT' && parseFloat(triggerPrice) > currentPrice ?
                  `${((parseFloat(triggerPrice) / currentPrice - 1) * 100).toFixed(2)}% above market` :
                 orderType === 'STOP_LOSS' ?
                  `Triggers when price falls ${((1 - parseFloat(triggerPrice) / currentPrice) * 100).toFixed(2)}% from current` :
                  `Triggers when price rises ${((parseFloat(triggerPrice) / currentPrice - 1) * 100).toFixed(2)}% from current`
                }
              </span>
            </div>
          )}
        </div>
        
        {/* Slippage Tolerance */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Slippage Tolerance (%)
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
              className="bg-gray-700 text-white rounded-md p-2 w-full"
              min="0.1"
              max="5"
              step="0.1"
            />
            <div className="flex space-x-1">
              <button
                type="button"
                onClick={() => setSlippage('0.5')}
                className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-2 py-1 rounded"
              >
                0.5%
              </button>
              <button
                type="button"
                onClick={() => setSlippage('1.0')}
                className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-2 py-1 rounded"
              >
                1%
              </button>
              <button
                type="button"
                onClick={() => setSlippage('2.0')}
                className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-2 py-1 rounded"
              >
                2%
              </button>
            </div>
          </div>
        </div>
        
        {/* Submit Button */}
        <button
          type="submit"
          disabled={!connected || isLoading || isPriceLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Creating Order...' : `Create ${orderType} Order`}
        </button>
        
        {!connected && (
          <p className="mt-2 text-sm text-center text-red-400">
            Please connect your wallet to create orders
          </p>
        )}
      </form>
    </div>
  );
};

interface OrderTypeButtonProps {
  type: OrderType;
  current: OrderType;
  onClick: () => void;
  icon: React.ReactNode;
}

const OrderTypeButton: React.FC<OrderTypeButtonProps> = ({ type, current, onClick, icon }) => {
  const isActive = type === current;
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center py-2 px-3 rounded-md text-sm font-medium transition-colors ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
    >
      {icon}
      {type === 'LIMIT' ? 'Limit' : 
       type === 'STOP_LOSS' ? 'Stop Loss' : 'Take Profit'}
    </button>
  );
};

export default OrderForm;