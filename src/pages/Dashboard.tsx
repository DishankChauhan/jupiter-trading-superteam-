import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import OrderForm from '../components/OrderForm';
import PriceChart from '../components/PriceChart';
import OrderTable from '../components/OrderTable';
import { TOKENS, TOKEN_METADATA } from '../services/jupiterService';
import { useOrders } from '../contexts/OrderContext';

const Dashboard: React.FC = () => {
  const { connected } = useWallet();
  const { orders } = useOrders();
  const [selectedTokens, setSelectedTokens] = useState({
    inputToken: TOKENS.SOL,
    outputToken: TOKENS.USDC,
  });
  
  // Get the most recent pending order for the selected token pair
  const pendingOrder = orders
    .filter(order => 
      order.status === 'PENDING' && 
      order.inputToken === selectedTokens.inputToken && 
      order.outputToken === selectedTokens.outputToken
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  
  // Handle token pair selection
  const handleTokenPairChange = (inputToken: string, outputToken: string) => {
    setSelectedTokens({
      inputToken,
      outputToken,
    });
  };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column - Order Form */}
      <div className="lg:col-span-1">
        <OrderForm />
      </div>
      
      {/* Right Column - Chart and Orders */}
      <div className="lg:col-span-2 space-y-6">
        {/* Token Pair Selection */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-4">
          <h2 className="text-lg font-medium mb-3">Popular Pairs</h2>
          <div className="grid grid-cols-3 gap-2">
            <TokenPairButton
              inputToken={TOKENS.SOL}
              outputToken={TOKENS.USDC}
              selected={selectedTokens.inputToken === TOKENS.SOL && selectedTokens.outputToken === TOKENS.USDC}
              onClick={() => handleTokenPairChange(TOKENS.SOL, TOKENS.USDC)}
            />
            <TokenPairButton
              inputToken={TOKENS.USDC}
              outputToken={TOKENS.SOL}
              selected={selectedTokens.inputToken === TOKENS.USDC && selectedTokens.outputToken === TOKENS.SOL}
              onClick={() => handleTokenPairChange(TOKENS.USDC, TOKENS.SOL)}
            />
            <TokenPairButton
              inputToken={TOKENS.SOL}
              outputToken={TOKENS.BONK}
              selected={selectedTokens.inputToken === TOKENS.SOL && selectedTokens.outputToken === TOKENS.BONK}
              onClick={() => handleTokenPairChange(TOKENS.SOL, TOKENS.BONK)}
            />
          </div>
        </div>
        
        {/* Price Chart */}
        <PriceChart 
          inputToken={selectedTokens.inputToken}
          outputToken={selectedTokens.outputToken}
          triggerPrice={pendingOrder?.triggerPrice}
          orderType={pendingOrder?.orderType}
        />
        
        {/* Pending Orders */}
        <div>
          <h2 className="text-xl font-bold mb-4">Pending Orders</h2>
          <OrderTable filter="PENDING" limit={5} />
        </div>
        
        {/* Recent Executions */}
        <div>
          <h2 className="text-xl font-bold mb-4">Recent Executions</h2>
          <OrderTable filter="EXECUTED" limit={5} />
        </div>
      </div>
    </div>
  );
};

interface TokenPairButtonProps {
  inputToken: string;
  outputToken: string;
  selected: boolean;
  onClick: () => void;
}

const TokenPairButton: React.FC<TokenPairButtonProps> = ({ 
  inputToken, 
  outputToken, 
  selected, 
  onClick 
}) => {
  const inputSymbol = TOKEN_METADATA[inputToken]?.symbol || 'Unknown';
  const outputSymbol = TOKEN_METADATA[outputToken]?.symbol || 'Unknown';
  
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center py-2 px-3 rounded-md text-sm font-medium transition-colors ${
        selected
          ? 'bg-blue-600 text-white'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
    >
      {inputSymbol}/{outputSymbol}
    </button>
  );
};

export default Dashboard;