import React, { createContext, useContext, useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, onSnapshot, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { usePrice } from './PriceContext';
import { executeSwap, getPriceForPair } from '../services/jupiterService';
import websocketService, { OrderUpdateEvent } from '../services/websocketService';
import toast from 'react-hot-toast';

export type OrderType = 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';

export interface Order {
  id?: string;
  walletAddress: string;
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  orderType: OrderType;
  triggerPrice: number;
  status: 'PENDING' | 'EXECUTING' | 'EXECUTED' | 'FAILED' | 'CANCELLED';
  createdAt: Date;
  executedAt?: Date;
  transactionSignature?: string;
  failureReason?: string;
  amount?: number; // For backward compatibility
}

interface OrderContextType {
  orders: Order[];
  createOrder: (order: Omit<Order, 'id' | 'walletAddress' | 'status' | 'createdAt'>) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
  isLoading: boolean;
  retryOrder: (orderId: string) => Promise<void>;
}

const OrderContext = createContext<OrderContextType>({
  orders: [],
  createOrder: async () => {},
  cancelOrder: async () => {},
  isLoading: false,
  retryOrder: async () => {},
});

export const useOrders = () => useContext(OrderContext);

export const OrderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const { getPriceForPair } = usePrice();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingOrders, setCheckingOrders] = useState(false);

  // Load user's orders when wallet connects
  useEffect(() => {
    if (!publicKey) return;

    const walletAddress = publicKey.toString();
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('walletAddress', '==', walletAddress));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orderData: Order[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Omit<Order, 'id' | 'createdAt' | 'executedAt'> & {
          createdAt: Timestamp;
          executedAt?: Timestamp;
        };
        
        orderData.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt.toDate(),
          executedAt: data.executedAt ? data.executedAt.toDate() : undefined,
          // Ensure inputAmount is set (backward compatibility)
          inputAmount: data.inputAmount || data.amount || 0,
        });
      });
      setOrders(orderData);
    });

    return () => {
      unsubscribe();
    };
  }, [publicKey]);

  // Check for order triggers every 10 seconds
  useEffect(() => {
    if (!orders.length || !publicKey || checkingOrders) return;

    const interval = setInterval(async () => {
      await checkOrderTriggers();
    }, 10000);

    return () => clearInterval(interval);
  }, [orders, publicKey, checkingOrders]);

  // Check if any orders should be triggered
  const checkOrderTriggers = async () => {
    if (checkingOrders) return;
    
    setCheckingOrders(true);
    try {
      const pendingOrders = orders.filter(order => order.status === 'PENDING');
      
      for (const order of pendingOrders) {
        try {
          // Get current price from Jupiter API
          const currentPrice = await getPriceForPair(order.inputToken, order.outputToken);
          
          let shouldExecute = false;
          
          switch (order.orderType) {
            case 'LIMIT':
              // For limit orders, execute when price is better than or equal to trigger price
              shouldExecute = currentPrice <= order.triggerPrice;
              break;
            case 'STOP_LOSS':
              // For stop loss, execute when price falls below trigger
              shouldExecute = currentPrice <= order.triggerPrice;
              break;
            case 'TAKE_PROFIT':
              // For take profit, execute when price rises above trigger
              shouldExecute = currentPrice >= order.triggerPrice;
              break;
          }
          
          if (shouldExecute && order.id) {
            await executeOrder(order.id);
          }
        } catch (error) {
          // Don't log the full error object to avoid DataCloneError
          console.error(`Error checking trigger for order ${order.id}`);
        }
      }
    } finally {
      setCheckingOrders(false);
    }
  };

  // Execute an order
  const executeOrder = async (orderId: string) => {
    if (!publicKey || !signTransaction || !signAllTransactions) {
      console.error('Wallet not connected');
      return;
    }
    
    // Get the order
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);
    
    if (!orderSnap.exists()) {
      console.error('Order not found');
      return;
    }
    
    const orderData = orderSnap.data() as Order;
    
    // Update order status to prevent duplicate execution
    await updateDoc(orderRef, {
      status: 'EXECUTING',
    });
    
    // Notify listeners
    websocketService.triggerOrderUpdate({
      orderId,
      status: 'EXECUTING',
    });
    
    try {
      // Execute the swap via Jupiter
      const result = await executeSwap({
        inputToken: orderData.inputToken,
        outputToken: orderData.outputToken,
        amount: orderData.inputAmount,
        walletAddress: publicKey.toString(),
        wallet: {
          signTransaction,
          signAllTransactions,
          publicKey,
        },
      });
      
      if (result.success) {
        // Update order status
        await updateDoc(orderRef, {
          status: 'EXECUTED',
          executedAt: new Date(),
          transactionSignature: result.signature,
        });
        
        // Notify listeners
        websocketService.triggerOrderUpdate({
          orderId,
          status: 'EXECUTED',
          transactionSignature: result.signature,
        });
        
        toast.success(`Order executed successfully!`);
      } else {
        // Update order status
        await updateDoc(orderRef, {
          status: 'FAILED',
          failureReason: result.error,
        });
        
        // Notify listeners
        websocketService.triggerOrderUpdate({
          orderId,
          status: 'FAILED',
        });
        
        toast.error(`Order execution failed: ${result.error}`);
      }
    } catch (error) {
      // Don't log the full error object to avoid DataCloneError
      console.error('Error executing order');
      
      // Update order status
      await updateDoc(orderRef, {
        status: 'FAILED',
        failureReason: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Notify listeners
      websocketService.triggerOrderUpdate({
        orderId,
        status: 'FAILED',
      });
      
      toast.error(`Order execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const createOrder = async (orderData: Omit<Order, 'id' | 'walletAddress' | 'status' | 'createdAt'>) => {
    if (!publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    try {
      const walletAddress = publicKey.toString();
      
      // Add the order to Firestore
      const docRef = await addDoc(collection(db, 'orders'), {
        ...orderData,
        walletAddress,
        status: 'PENDING',
        createdAt: new Date(),
      });
      
      toast.success('Order created successfully');
      
      // Check if the order should be executed immediately
      const currentPrice = await getPriceForPair(orderData.inputToken, orderData.outputToken);
      
      let shouldExecute = false;
      
      switch (orderData.orderType) {
        case 'LIMIT':
          shouldExecute = currentPrice <= orderData.triggerPrice;
          break;
        case 'STOP_LOSS':
          shouldExecute = currentPrice <= orderData.triggerPrice;
          break;
        case 'TAKE_PROFIT':
          shouldExecute = currentPrice >= orderData.triggerPrice;
          break;
      }
      
      if (shouldExecute) {
        toast.loading('Order conditions met, executing immediately...');
        await executeOrder(docRef.id);
      }
    } catch (error) {
      // Don't log the full error object to avoid DataCloneError
      console.error('Error creating order');
      toast.error('Failed to create order');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelOrder = async (orderId: string) => {
    setIsLoading(true);
    try {
      // Update the order status
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'CANCELLED',
      });
      
      // Notify listeners
      websocketService.triggerOrderUpdate({
        orderId,
        status: 'CANCELLED',
      });
      
      toast.success('Order cancelled');
    } catch (error) {
      // Don't log the full error object to avoid DataCloneError
      console.error('Error cancelling order');
      toast.error('Failed to cancel order');
    } finally {
      setIsLoading(false);
    }
  };

  const retryOrder = async (orderId: string) => {
    setIsLoading(true);
    try {
      // Update the order status
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'PENDING',
        failureReason: null,
      });
      
      // Notify listeners
      websocketService.triggerOrderUpdate({
        orderId,
        status: 'PENDING',
      });
      
      toast.success('Order retry initiated');
      
      // Check if the order should be executed immediately
      await checkOrderTriggers();
    } catch (error) {
      // Don't log the full error object to avoid DataCloneError
      console.error('Error retrying order');
      toast.error('Failed to retry order');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <OrderContext.Provider value={{ orders, createOrder, cancelOrder, isLoading, retryOrder }}>
      {children}
    </OrderContext.Provider>
  );
};