import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, LineStyle, IChartApi, ISeriesApi } from 'lightweight-charts';
import { getPriceHistory } from '../services/jupiterService';
import { usePrice } from '../contexts/PriceContext';
import websocketService, { PriceUpdateEvent } from '../services/websocketService';
import { TOKEN_METADATA } from '../services/jupiterService';

interface PriceChartProps {
  inputToken: string;
  outputToken: string;
  triggerPrice?: number;
  orderType?: 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
}

const PriceChart: React.FC<PriceChartProps> = ({ 
  inputToken, 
  outputToken, 
  triggerPrice,
  orderType
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const triggerLineRef = useRef<any>(null);
  const { isWebSocketConnected } = usePrice();
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [timeframe, setTimeframe] = useState<'1h' | '1d' | '1w'>('1d');
  const [isLoading, setIsLoading] = useState(false);
  
  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    // Initialize chart
    if (!chartRef.current) {
      chartRef.current = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: '#1f2937' },
          textColor: '#d1d5db',
        },
        grid: {
          vertLines: { color: '#374151' },
          horzLines: { color: '#374151' },
        },
        timeScale: {
          borderColor: '#4b5563',
          timeVisible: true,
        },
        crosshair: {
          mode: 0,
        },
        width: chartContainerRef.current.clientWidth,
        height: 400,
      });
      
      // Create series
      seriesRef.current = chartRef.current.addAreaSeries({
        topColor: 'rgba(59, 130, 246, 0.56)',
        bottomColor: 'rgba(59, 130, 246, 0.04)',
        lineColor: 'rgba(59, 130, 246, 1)',
        lineWidth: 2,
      });
      
      // Handle resize
      const handleResize = () => {
        if (chartRef.current && chartContainerRef.current) {
          chartRef.current.applyOptions({ 
            width: chartContainerRef.current.clientWidth 
          });
        }
      };
      
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
          seriesRef.current = null;
          triggerLineRef.current = null;
        }
      };
    }
  }, []);
  
  // Load price data and set up trigger price line
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    
    // Load price data
    const loadPriceData = async () => {
      setIsLoading(true);
      try {
        const data = await getPriceHistory(inputToken, timeframe);
        if (seriesRef.current) {
          seriesRef.current.setData(data);
          
          // Set last price
          if (data.length > 0) {
            setLastPrice(data[data.length - 1].value);
          }
          
          // Add trigger price line if provided
          updateTriggerPriceLine();
          
          // Fit content
          chartRef.current?.timeScale().fitContent();
        }
      } catch (error) {
        // Don't log the full error object to avoid DataCloneError
        console.error('Error loading price data');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadPriceData();
    
    // Refresh data every 60 seconds
    const interval = setInterval(loadPriceData, 60000);
    
    return () => clearInterval(interval);
  }, [inputToken, outputToken, timeframe]);
  
  // Update trigger price line when trigger price changes
  useEffect(() => {
    updateTriggerPriceLine();
  }, [triggerPrice, orderType]);
  
  // Subscribe to real-time price updates
  useEffect(() => {
    if (!seriesRef.current) return;
    
    const handlePriceUpdate = (update: PriceUpdateEvent) => {
      if (update.tokenMint === inputToken) {
        // Add new price point
        const newPoint = {
          time: Math.floor(update.timestamp / 1000),
          value: update.price,
        };
        
        seriesRef.current?.update(newPoint);
        setLastPrice(update.price);
      }
    };
    
    // Subscribe to price updates
    websocketService.subscribeToPriceUpdates(inputToken, handlePriceUpdate);
    
    return () => {
      websocketService.unsubscribeFromPriceUpdates(inputToken, handlePriceUpdate);
    };
  }, [inputToken]);
  
  // Update trigger price line
  const updateTriggerPriceLine = () => {
    if (!chartRef.current || !triggerPrice || !seriesRef.current) return;
    
    // Remove existing line
    if (triggerLineRef.current) {
      seriesRef.current.removePriceLine(triggerLineRef.current);
      triggerLineRef.current = null;
    }
    
    // Add new line with appropriate color based on order type
    let lineColor = '#3b82f6'; // Default blue
    let lineStyle = LineStyle.Dashed;
    let title = 'Trigger Price';
    
    if (orderType) {
      switch (orderType) {
        case 'LIMIT':
          lineColor = '#3b82f6'; // Blue
          title = 'Limit Price';
          break;
        case 'STOP_LOSS':
          lineColor = '#ef4444'; // Red
          title = 'Stop Price';
          break;
        case 'TAKE_PROFIT':
          lineColor = '#10b981'; // Green
          title = 'Target Price';
          break;
      }
    }
    
    // Create price line
    triggerLineRef.current = seriesRef.current.createPriceLine({
      price: triggerPrice,
      color: lineColor,
      lineWidth: 2,
      lineStyle,
      axisLabelVisible: true,
      title,
    });
  };
  
  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe: '1h' | '1d' | '1w') => {
    setTimeframe(newTimeframe);
  };
  
  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium">
          {TOKEN_METADATA[inputToken]?.symbol || 'Token'} / {TOKEN_METADATA[outputToken]?.symbol || 'Token'} Chart
        </h2>
        
        <div className="flex space-x-2">
          <button
            onClick={() => handleTimeframeChange('1h')}
            className={`px-3 py-1 text-sm rounded-md ${
              timeframe === '1h'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            1H
          </button>
          <button
            onClick={() => handleTimeframeChange('1d')}
            className={`px-3 py-1 text-sm rounded-md ${
              timeframe === '1d'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            1D
          </button>
          <button
            onClick={() => handleTimeframeChange('1w')}
            className={`px-3 py-1 text-sm rounded-md ${
              timeframe === '1w'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            1W
          </button>
        </div>
      </div>
      
      {/* Price info */}
      <div className="flex justify-between items-center mb-4">
        <div>
          {lastPrice && (
            <div className="text-2xl font-bold">
              {lastPrice.toFixed(6)} {TOKEN_METADATA[outputToken]?.symbol}
            </div>
          )}
        </div>
        
        {/* Connection status */}
        <div className="flex items-center">
          <div className={`h-2 w-2 rounded-full mr-2 ${isWebSocketConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
          <span className="text-xs text-gray-400">
            {isWebSocketConnected ? 'Live' : 'Polling'}
          </span>
        </div>
      </div>
      
      {/* Chart */}
      <div className="relative">
        <div ref={chartContainerRef} className="w-full h-[400px]"></div>
        
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-70">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>
      
      {/* Trigger price info */}
      {triggerPrice && orderType && (
        <div className="mt-4 p-3 rounded-md bg-gray-700">
          <div className="flex items-center">
            <div className={`h-3 w-3 rounded-full mr-2 ${
              orderType === 'LIMIT' ? 'bg-blue-500' :
              orderType === 'STOP_LOSS' ? 'bg-red-500' : 'bg-green-500'
            }`}></div>
            <span className="text-sm">
              {orderType === 'LIMIT' ? 'Limit order at ' :
               orderType === 'STOP_LOSS' ? 'Stop loss at ' : 'Take profit at '}
              <span className="font-bold">{triggerPrice.toFixed(6)} {TOKEN_METADATA[outputToken]?.symbol}</span>
            </span>
          </div>
          
          {lastPrice && (
            <div className="text-xs text-gray-400 mt-1 ml-5">
              {orderType === 'LIMIT' && triggerPrice < lastPrice && 
                `${((1 - triggerPrice / lastPrice) * 100).toFixed(2)}% below current price`}
              {orderType === 'LIMIT' && triggerPrice > lastPrice && 
                `${((triggerPrice / lastPrice - 1) * 100).toFixed(2)}% above current price`}
              {orderType === 'STOP_LOSS' && 
                `Triggers when price falls ${((1 - triggerPrice / lastPrice) * 100).toFixed(2)}% from current`}
              {orderType === 'TAKE_PROFIT' && 
                `Triggers when price rises ${((triggerPrice / lastPrice - 1) * 100).toFixed(2)}% from current`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PriceChart;