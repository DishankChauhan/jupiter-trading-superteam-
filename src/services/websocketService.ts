import { io, Socket } from 'socket.io-client';
import { TOKENS, getTokenPrice } from './jupiterService';

// Define event types
export type PriceUpdateEvent = {
  tokenMint: string;
  price: number;
  timestamp: number;
};

export type OrderUpdateEvent = {
  orderId: string;
  status: 'PENDING' | 'EXECUTING' | 'EXECUTED' | 'FAILED' | 'CANCELLED';
  transactionSignature?: string;
};

// Define listener types
type PriceUpdateListener = (update: PriceUpdateEvent) => void;
type OrderUpdateListener = (update: OrderUpdateEvent) => void;
type ConnectionStatusListener = (connected: boolean) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private priceListeners: Map<string, Set<PriceUpdateListener>> = new Map();
  private orderListeners: Map<string, Set<OrderUpdateListener>> = new Map();
  private connectionListeners: Set<ConnectionStatusListener> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000; // Start with 2 seconds
  private subscribedTokens: Set<string> = new Set();
  private subscribedOrders: Set<string> = new Set();
  private pollingInterval: NodeJS.Timeout | null = null;
  
  // Initialize the socket connection
  public connect(url: string = 'https://price.jup.ag'): void {
    // Start with polling instead of WebSocket to avoid connection errors
    this.startPolling();
    
    // Notify listeners that we're using polling (not connected to WebSocket)
    this.notifyConnectionListeners(false);
  }
  
  // Start polling for price updates
  private startPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    
    // Poll immediately
    this.pollPriceUpdates();
    
    // Then set up interval
    this.pollingInterval = setInterval(() => {
      this.pollPriceUpdates();
    }, 5000); // Poll every 5 seconds
  }
  
  // Poll for price updates
  private async pollPriceUpdates(): Promise<void> {
    try {
      // Only poll for subscribed tokens
      if (this.subscribedTokens.size === 0) return;
      
      const tokenMints = Array.from(this.subscribedTokens);
      
      // Get prices for each token
      for (const tokenMint of tokenMints) {
        try {
          const price = await getTokenPrice(tokenMint);
          
          if (price) {
            const priceUpdate: PriceUpdateEvent = {
              tokenMint,
              price,
              timestamp: Date.now(),
            };
            
            this.handlePriceUpdate(priceUpdate);
          }
        } catch (error) {
          console.error(`Error polling price for ${tokenMint}:`, error);
        }
      }
    } catch (error) {
      console.error('Error polling price updates:', error);
    }
  }
  
  // Disconnect the socket
  public disconnect(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.subscribedTokens.clear();
    this.subscribedOrders.clear();
    this.notifyConnectionListeners(false);
  }
  
  // Subscribe to price updates for a token
  public subscribeToPriceUpdates(tokenMint: string, listener: PriceUpdateListener): void {
    if (!this.priceListeners.has(tokenMint)) {
      this.priceListeners.set(tokenMint, new Set());
    }
    
    this.priceListeners.get(tokenMint)?.add(listener);
    
    // Subscribe to the token if not already subscribed
    if (!this.subscribedTokens.has(tokenMint)) {
      this.subscribedTokens.add(tokenMint);
    }
  }
  
  // Unsubscribe from price updates for a token
  public unsubscribeFromPriceUpdates(tokenMint: string, listener: PriceUpdateListener): void {
    const listeners = this.priceListeners.get(tokenMint);
    if (!listeners) {
      return;
    }
    
    listeners.delete(listener);
    
    // If no more listeners for this token, unsubscribe
    if (listeners.size === 0) {
      this.priceListeners.delete(tokenMint);
      this.subscribedTokens.delete(tokenMint);
    }
  }
  
  // Subscribe to order updates
  public subscribeToOrderUpdates(orderId: string, listener: OrderUpdateListener): void {
    if (!this.orderListeners.has(orderId)) {
      this.orderListeners.set(orderId, new Set());
    }
    
    this.orderListeners.get(orderId)?.add(listener);
    this.subscribedOrders.add(orderId);
  }
  
  // Unsubscribe from order updates
  public unsubscribeFromOrderUpdates(orderId: string, listener: OrderUpdateListener): void {
    const listeners = this.orderListeners.get(orderId);
    if (!listeners) {
      return;
    }
    
    listeners.delete(listener);
    
    // If no more listeners for this order, unsubscribe
    if (listeners.size === 0) {
      this.orderListeners.delete(orderId);
      this.subscribedOrders.delete(orderId);
    }
  }
  
  // Subscribe to connection status updates
  public subscribeToConnectionStatus(listener: ConnectionStatusListener): void {
    this.connectionListeners.add(listener);
    // Immediately notify of current status
    if (this.socket) {
      listener(this.socket.connected);
    } else {
      listener(false);
    }
  }
  
  // Unsubscribe from connection status updates
  public unsubscribeFromConnectionStatus(listener: ConnectionStatusListener): void {
    this.connectionListeners.delete(listener);
  }
  
  // Handle price update events
  private handlePriceUpdate(data: PriceUpdateEvent): void {
    const listeners = this.priceListeners.get(data.tokenMint);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error('Error in price update listener:', error);
        }
      });
    }
  }
  
  // Manually trigger an order update (for Firebase integration)
  public triggerOrderUpdate(data: OrderUpdateEvent): void {
    this.handleOrderUpdate(data);
  }
  
  // Handle order update events
  private handleOrderUpdate(data: OrderUpdateEvent): void {
    const listeners = this.orderListeners.get(data.orderId);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error('Error in order update listener:', error);
        }
      });
    }
  }
  
  // Notify all connection status listeners
  private notifyConnectionListeners(connected: boolean): void {
    this.connectionListeners.forEach(listener => {
      try {
        listener(connected);
      } catch (error) {
        console.error('Error in connection status listener:', error);
      }
    });
  }
  
  // Get the current connection status
  public isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// Create a singleton instance
const websocketService = new WebSocketService();

// Initialize with common tokens
export const initializeWebSocketService = () => {
  websocketService.connect();
  
  // Subscribe to common tokens by default
  Object.values(TOKENS).forEach(tokenMint => {
    websocketService.subscribeToPriceUpdates(tokenMint, () => {
      // This is just to keep the subscription active
      // Actual handling will be done by components that subscribe
    });
  });
  
  return websocketService;
};

export default websocketService;