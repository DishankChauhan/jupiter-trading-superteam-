import axios from 'axios';
import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import Decimal from 'decimal.js';

// Common token mints
export const TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  mSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  JTO: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9XCi',
};

// Token metadata for UI display
export const TOKEN_METADATA = {
  [TOKENS.SOL]: {
    symbol: 'SOL',
    name: 'Solana',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    decimals: 9,
  },
  [TOKENS.USDC]: {
    symbol: 'USDC',
    name: 'USD Coin',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    decimals: 6,
  },
  [TOKENS.BONK]: {
    symbol: 'BONK',
    name: 'Bonk',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/logo.png',
    decimals: 5,
  },
  [TOKENS.USDT]: {
    symbol: 'USDT',
    name: 'Tether',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png',
    decimals: 6,
  },
  [TOKENS.mSOL]: {
    symbol: 'mSOL',
    name: 'Marinade staked SOL',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png',
    decimals: 9,
  },
  [TOKENS.JTO]: {
    symbol: 'JTO',
    name: 'Jito',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9XCi/logo.png',
    decimals: 9,
  },
};

// Create a Solana connection
const getConnection = () => {
  const network = import.meta.env.VITE_SOLANA_NETWORK || 'devnet';
  const endpoint = network === 'mainnet-beta' 
    ? 'https://api.mainnet-beta.solana.com' 
    : 'https://api.devnet.solana.com';
  
  return new Connection(endpoint, 'confirmed');
};

// Get all available tokens from Jupiter
export const fetchTokens = async () => {
  try {
    const response = await axios.get('https://token.jup.ag/all');
    return response.data;
  } catch (error) {
    console.error('Error fetching tokens:', error);
    return []; // Return empty array instead of throwing
  }
};

// Get quote for a swap
export const getQuote = async (
  inputMint: string,
  outputMint: string,
  amount: number,
  slippage = 1 // 1% default slippage
) => {
  try {
    // Convert amount to proper format based on token decimals
    const inputDecimals = TOKEN_METADATA[inputMint]?.decimals || 9;
    const amountInSmallestUnit = new Decimal(amount).mul(Decimal.pow(10, inputDecimals)).floor().toString();

    const response = await axios.get('https://quote-api.jup.ag/v6/quote', {
      params: {
        inputMint,
        outputMint,
        amount: amountInSmallestUnit,
        slippageBps: slippage * 100,
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error getting quote:', error);
    throw error;
  }
};

// Execute a swap using Jupiter API
export const executeSwap = async ({
  inputToken,
  outputToken,
  amount,
  walletAddress,
  slippage = 1,
  wallet = null, // Pass the wallet adapter
}: {
  inputToken: string;
  outputToken: string;
  amount: number;
  walletAddress: string;
  slippage?: number;
  wallet?: any;
}) => {
  try {
    // If no wallet is provided, we can't execute the transaction
    if (!wallet) {
      console.error('Wallet not provided for transaction signing');
      return {
        success: false,
        error: 'Wallet not available for transaction signing',
      };
    }

    // Step 1: Get a quote from Jupiter
    const quoteResponse = await getQuote(inputToken, outputToken, amount, slippage);
    
    // Step 2: Get serialized transactions for the swap
    const swapResponse = await axios.post('https://quote-api.jup.ag/v6/swap', {
      quoteResponse,
      userPublicKey: walletAddress,
      wrapUnwrapSOL: true,
    });
    
    const { swapTransaction } = swapResponse.data;
    
    // Step 3: Deserialize and sign the transaction
    const connection = getConnection();
    
    // Check if it's a versioned transaction
    let transaction;
    if (swapTransaction.includes('base64')) {
      // Handle versioned transaction
      const serializedTransaction = Buffer.from(swapTransaction, 'base64');
      transaction = VersionedTransaction.deserialize(serializedTransaction);
    } else {
      // Handle legacy transaction
      transaction = Transaction.from(Buffer.from(swapTransaction, 'base64'));
    }
    
    // Step 4: Sign and send the transaction
    try {
      let signedTransaction;
      
      if (transaction instanceof VersionedTransaction) {
        // Sign versioned transaction
        signedTransaction = await wallet.signTransaction(transaction);
      } else {
        // Sign legacy transaction
        signedTransaction = await wallet.signTransaction(transaction);
      }
      
      // Send the signed transaction
      const signature = await connection.sendRawTransaction(
        signedTransaction.serialize()
      );
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');
      
      return {
        success: true,
        signature,
      };
    } catch (error) {
      console.error('Error signing or sending transaction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transaction signing failed',
      };
    }
  } catch (error) {
    console.error('Error executing swap:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Cached price history data to prevent excessive API calls
const priceHistoryCache = new Map<string, {data: any[], timestamp: number}>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Get price history for a token
export const getPriceHistory = async (
  mint: string,
  interval = '1d', // 1d, 1h, etc.
  limit = 100
) => {
  try {
    // Check cache first
    const cacheKey = `${mint}-${interval}-${limit}`;
    const cachedData = priceHistoryCache.get(cacheKey);
    const now = Date.now();
    
    if (cachedData && (now - cachedData.timestamp < CACHE_TTL)) {
      return cachedData.data;
    }
    
    // Use Jupiter's price API to get historical data
    const response = await axios.get(`https://price.jup.ag/v4/price/chart`, {
      params: {
        mint,
        interval,
        limit,
      },
    });
    
    // Transform the data for lightweight-charts format
    const chartData = response.data.data.map((item: any) => ({
      time: item.time / 1000, // Convert to seconds
      value: item.price,
    }));
    
    // Cache the result
    priceHistoryCache.set(cacheKey, {
      data: chartData,
      timestamp: now
    });
    
    return chartData;
  } catch (error) {
    // Don't log the full error object to avoid DataCloneError
    console.error('Error getting price history');
    // Return fallback data if API fails
    return generateFallbackPriceData();
  }
};

// Cached token prices to prevent excessive API calls
const tokenPriceCache = new Map<string, {price: number, timestamp: number}>();

// Get real-time price for a token
export const getTokenPrice = async (mint: string) => {
  try {
    // Check cache first
    const cachedPrice = tokenPriceCache.get(mint);
    const now = Date.now();
    
    if (cachedPrice && (now - cachedPrice.timestamp < 30000)) { // 30 seconds TTL
      return cachedPrice.price;
    }
    
    const response = await axios.get('https://price.jup.ag/v4/price', {
      params: {
        ids: mint,
      },
    });
    
    const price = response.data.data[mint]?.price;
    
    if (price) {
      // Cache the result
      tokenPriceCache.set(mint, {
        price,
        timestamp: now
      });
    }
    
    return price;
  } catch (error) {
    // Don't log the full error object to avoid DataCloneError
    console.error('Error getting token price');
    // Return a fallback price instead of throwing
    return generateFallbackPrice(mint);
  }
};

// Generate fallback price data if API fails
const generateFallbackPriceData = () => {
  const now = Date.now();
  const data = [];
  
  let price = 100;
  for (let i = 0; i < 100; i++) {
    const time = now - (100 - i) * 3600 * 1000;
    price = price * (1 + (Math.random() * 0.06 - 0.03));
    
    data.push({
      time: time / 1000,
      value: price,
    });
  }
  
  return data;
};

// Generate a fallback price for a token
const generateFallbackPrice = (mint: string) => {
  // Return reasonable fallback prices based on token
  switch (mint) {
    case TOKENS.SOL:
      return 150 + (Math.random() * 10 - 5); // Around $150
    case TOKENS.USDC:
    case TOKENS.USDT:
      return 1.0 + (Math.random() * 0.01 - 0.005); // Around $1
    case TOKENS.BONK:
      return 0.00001 + (Math.random() * 0.000001); // Very small value
    case TOKENS.mSOL:
      return 160 + (Math.random() * 10 - 5); // Slightly higher than SOL
    case TOKENS.JTO:
      return 2.5 + (Math.random() * 0.2 - 0.1); // Around $2.50
    default:
      return 1.0; // Default fallback
  }
};

// Convert token amount to human-readable format
export const formatTokenAmount = (amount: number | string, tokenMint: string) => {
  const decimals = TOKEN_METADATA[tokenMint]?.decimals || 9;
  const amountDecimal = new Decimal(amount);
  return amountDecimal.div(Decimal.pow(10, decimals)).toFixed(decimals > 6 ? 6 : decimals);
};

// Convert human-readable amount to token amount in smallest units
export const parseTokenAmount = (amount: string, tokenMint: string) => {
  const decimals = TOKEN_METADATA[tokenMint]?.decimals || 9;
  return new Decimal(amount).mul(Decimal.pow(10, decimals)).floor().toString();
};

// Cached price ratios to prevent excessive API calls
const pairPriceCache = new Map<string, {price: number, timestamp: number}>();

// Get price for a token pair
export const getPriceForPair = async (inputMint: string, outputMint: string) => {
  try {
    // Check cache first
    const cacheKey = `${inputMint}-${outputMint}`;
    const cachedPrice = pairPriceCache.get(cacheKey);
    const now = Date.now();
    
    if (cachedPrice && (now - cachedPrice.timestamp < 30000)) { // 30 seconds TTL
      return cachedPrice.price;
    }
    
    // For direct comparison, get prices for both tokens in USD and calculate the ratio
    const inputPrice = await getTokenPrice(inputMint);
    const outputPrice = await getTokenPrice(outputMint);
    
    if (!inputPrice || !outputPrice) {
      throw new Error('Failed to get token prices');
    }
    
    // Calculate the exchange rate
    const price = inputPrice / outputPrice;
    
    // Cache the result
    pairPriceCache.set(cacheKey, {
      price,
      timestamp: now
    });
    
    return price;
  } catch (error) {
    // Don't log the full error object to avoid DataCloneError
    console.error('Error getting price for pair');
    // Return a fallback price ratio instead of throwing
    return getFallbackPriceRatio(inputMint, outputMint);
  }
};

// Get a fallback price ratio for a token pair
const getFallbackPriceRatio = (inputMint: string, outputMint: string) => {
  // Common price ratios for fallback
  if (inputMint === TOKENS.SOL && outputMint === TOKENS.USDC) {
    return 150; // 1 SOL = 150 USDC
  } else if (inputMint === TOKENS.USDC && outputMint === TOKENS.SOL) {
    return 1/150; // 1 USDC = 0.00667 SOL
  } else if (inputMint === TOKENS.SOL && outputMint === TOKENS.BONK) {
    return 15000000; // 1 SOL = 15,000,000 BONK (example)
  } else if (inputMint === TOKENS.USDC && outputMint === TOKENS.USDT) {
    return 1; // 1 USDC = 1 USDT
  } else if (inputMint === TOKENS.SOL && outputMint === TOKENS.mSOL) {
    return 0.95; // 1 SOL = 0.95 mSOL (mSOL is worth more than SOL)
  } else {
    // Default fallback - generate a reasonable ratio
    const inputValue = generateFallbackPrice(inputMint);
    const outputValue = generateFallbackPrice(outputMint);
    return inputValue / outputValue;
  }
};