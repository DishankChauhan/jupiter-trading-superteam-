import React, { createContext, useContext, useState, useEffect, useRef} from 'react';
import { getTokenPrice, getPriceForPair as getJupiterPriceForPair, TOKENS } from '../services/jupiterService';
import websocketService, { PriceUpdateEvent } from '../services/websocketService';

interface TokenPrice {
  [tokenMint: string]: {
    price: number;
    lastUpdated: Date;
  };
}

interface PriceContextType {
  prices: TokenPrice;
  getPriceForPair: (inputToken: string, outputToken: string) => Promise<number>;
  isLoading: boolean;
  isWebSocketConnected: boolean;
}

const PriceContext = createContext<PriceContextType>({
  prices: {},
  getPriceForPair: async () => 0,
  isLoading: false,
  isWebSocketConnected: false,
});

export const usePrice = () => useContext(PriceContext);

export const PriceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [prices, setPrices] = useState<TokenPrice>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);

  // Initialize WebSocket service
  useEffect(() => {
    const ws = websocketService;
    
    // Subscribe to connection status
    ws.subscribeToConnectionStatus((connected) => {
      setIsWebSocketConnected(connected);
    });
    
    // Subscribe to price updates for common tokens
    const handlePriceUpdate = (update: PriceUpdateEvent) => {
      setPrices(prevPrices => ({
        ...prevPrices,
        [update.tokenMint]: {
          price: update.price,
          lastUpdated: new Date(update.timestamp),
        },
      }));
    };
    
    // Subscribe to all common tokens
    Object.values(TOKENS).forEach(tokenMint => {
      ws.subscribeToPriceUpdates(tokenMint, handlePriceUpdate);
    });
    
    return () => {
      // Cleanup subscriptions
      Object.values(TOKENS).forEach(tokenMint => {
        ws.unsubscribeFromPriceUpdates(tokenMint, handlePriceUpdate);
      });
      ws.unsubscribeFromConnectionStatus(setIsWebSocketConnected);
    };
  }, []);

  // Fetch prices for common tokens periodically as a fallback
  useEffect(() => {
    const fetchPrices = async () => {
      // Skip if WebSocket is connected
      if (isWebSocketConnected) {
        return;
      }
      
      setIsLoading(true);
      try {
        const newPrices: TokenPrice = {};
        
        // Fetch prices for all common tokens
        for (const [symbol, tokenMint] of Object.entries(TOKENS)) {
          try {
            const price = await getTokenPrice(tokenMint);
            if (price) {
              newPrices[tokenMint] = {
                price,
                lastUpdated: new Date(),
              };
            }
          } catch (error) {
            // Don't log the full error object to avoid DataCloneError
            console.error(`Error fetching price for ${symbol}`);
          }
        }
        
        setPrices(prevPrices => ({
          ...prevPrices,
          ...newPrices,
        }));
      } catch (error) {
        // Don't log the full error object to avoid DataCloneError
        console.error('Error fetching prices');
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch immediately and then every 10 seconds if WebSocket is not connected
    fetchPrices();
    const interval = setInterval(() => {
      if (!isWebSocketConnected) {
        fetchPrices();
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [isWebSocketConnected]);

  // Cache for price pairs to reduce API calls
  const pricePairCache = useRef<Map<string, {price: number, timestamp: number}>>(new Map());
  const CACHE_TTL = 30000; // 30 seconds

  const getPriceForPair = async (inputToken: string, outputToken: string): Promise<number> => {
    try {
      // Check cache first
      const cacheKey = `${inputToken}-${outputToken}`;
      const now = Date.now();
      const cachedPrice = pricePairCache.current.get(cacheKey);
      
      if (cachedPrice && (now - cachedPrice.timestamp < CACHE_TTL)) {
        return cachedPrice.price;
      }
      
      // Check if we already have recent prices (less than 30 seconds old)
      const inputPrice = prices[inputToken];
      const outputPrice = prices[outputToken];
      
      const isInputPriceRecent = inputPrice && 
        (now - inputPrice.lastUpdated.getTime() < CACHE_TTL);
      const isOutputPriceRecent = outputPrice && 
        (now - outputPrice.lastUpdated.getTime() < CACHE_TTL);
      
      // If we have recent prices, calculate the ratio
      if (isInputPriceRecent && isOutputPriceRecent) {
        const price = inputPrice.price / outputPrice.price;
        
        // Cache the result
        pricePairCache.current.set(cacheKey, {
          price,
          timestamp: now
        });
        
        return price;
      }
      
      // Otherwise, fetch from Jupiter API
      const price = await getJupiterPriceForPair(inputToken, outputToken);
      
      // Cache the result
      pricePairCache.current.set(cacheKey, {
        price,
        timestamp: now
      });
      
      return price;
    } catch (error) {
      // Don't log the full error object to avoid DataCloneError
      console.error('Error getting price for pair');
      // Return a fallback price instead of throwing
      if (inputToken === TOKENS.SOL && outputToken === TOKENS.USDC) {
        return 150; // 1 SOL = 150 USDC
      } else if (inputToken === TOKENS.USDC && outputToken === TOKENS.SOL) {
        return 1/150; // 1 USDC = 0.00667 SOL
      } else {
        return 1; // Default fallback
      }
    }
  };

  return (
    <PriceContext.Provider value={{ prices, getPriceForPair, isLoading, isWebSocketConnected }}>
      {children}
    </PriceContext.Provider>
  );
};