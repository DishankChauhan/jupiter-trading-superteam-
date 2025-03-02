import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { AlertTriangle, Save, Trash2 } from 'lucide-react';
import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import toast from 'react-hot-toast';

interface UserSettings {
  slippage: string;
  notifications: boolean;
  defaultOrderType: 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
  autoRefresh: boolean;
  theme: 'dark' | 'light';
}

const defaultSettings: UserSettings = {
  slippage: '1.0',
  notifications: true,
  defaultOrderType: 'LIMIT',
  autoRefresh: true,
  theme: 'dark',
};

const Settings: React.FC = () => {
  const { connected, publicKey } = useWallet();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(false);
  
  // Load user settings from Firebase
  useEffect(() => {
    const loadSettings = async () => {
      if (!connected || !publicKey) return;
      
      try {
        const userRef = doc(db, 'settings', publicKey.toString());
        const docSnap = await getDoc(userRef);
        
        if (docSnap.exists()) {
          setSettings({
            ...defaultSettings,
            ...docSnap.data() as UserSettings,
          });
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        toast.error('Failed to load settings');
      }
    };
    
    loadSettings();
  }, [connected, publicKey]);
  
  // Save settings to Firebase
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }
    
    setIsLoading(true);
    try {
      await setDoc(doc(db, 'settings', publicKey.toString()), settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Reset settings to defaults
  const handleReset = () => {
    setSettings(defaultSettings);
    toast.success('Settings reset to defaults');
  };
  
  if (!connected) {
    return (
      <div className="bg-gray-800 rounded-lg shadow-lg p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Wallet Not Connected</h2>
        <p className="text-gray-400 mb-4">Please connect your wallet to access settings.</p>
      </div>
    );
  }
  
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <div className="bg-gray-800 rounded-lg shadow-lg p-6">
        <form onSubmit={handleSave}>
          {/* Wallet Info */}
          <div className="mb-6">
            <h2 className="text-lg font-medium mb-4 border-b border-gray-700 pb-2">Wallet Information</h2>
            <div className="flex flex-col space-y-2">
              <div>
                <span className="text-gray-400">Connected Address:</span>
                <span className="ml-2 text-gray-300 font-mono text-sm">
                  {publicKey?.toString()}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Network:</span>
                <span className="ml-2 text-gray-300">
                  {import.meta.env.VITE_SOLANA_NETWORK === 'mainnet-beta' ? 'Mainnet' : 'Devnet'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Trading Settings */}
          <div className="mb-6">
            <h2 className="text-lg font-medium mb-4 border-b border-gray-700 pb-2">Trading Settings</h2>
            
            <div className="mb-4">
              <label htmlFor="slippage" className="block text-sm font-medium text-gray-400 mb-2">
                Default Slippage Tolerance (%)
              </label>
              <input
                type="number"
                id="slippage"
                value={settings.slippage}
                onChange={(e) => setSettings({...settings, slippage: e.target.value})}
                min="0.1"
                max="5"
                step="0.1"
                className="bg-gray-700 text-white rounded-md p-2 w-full"
              />
              <p className="mt-1 text-sm text-gray-500">
                Your transaction will revert if the price changes unfavorably by more than this percentage.
              </p>
            </div>
            
            <div className="mb-4">
              <label htmlFor="defaultOrderType" className="block text-sm font-medium text-gray-400 mb-2">
                Default Order Type
              </label>
              <select
                id="defaultOrderType"
                value={settings.defaultOrderType}
                onChange={(e) => setSettings({...settings, defaultOrderType: e.target.value as any})}
                className="bg-gray-700 text-white rounded-md p-2 w-full"
              >
                <option value="LIMIT">Limit</option>
                <option value="STOP_LOSS">Stop Loss</option>
                <option value="TAKE_PROFIT">Take Profit</option>
              </select>
            </div>
          </div>
          
          {/* Notification Settings */}
          <div className="mb-6">
            <h2 className="text-lg font-medium mb-4 border-b border-gray-700 pb-2">Notifications</h2>
            
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="notifications"
                checked={settings.notifications}
                onChange={(e) => setSettings({...settings, notifications: e.target.checked})}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600 rounded"
              />
              <label htmlFor="notifications" className="ml-2 block text-sm text-gray-300">
                Enable browser notifications for order updates
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoRefresh"
                checked={settings.autoRefresh}
                onChange={(e) => setSettings({...settings, autoRefresh: e.target.checked})}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600 rounded"
              />
              <label htmlFor="autoRefresh" className="ml-2 block text-sm text-gray-300">
                Auto-refresh order status every 30 seconds
              </label>
            </div>
          </div>
          
          {/* Theme Settings */}
          <div className="mb-6">
            <h2 className="text-lg font-medium mb-4 border-b border-gray-700 pb-2">Appearance</h2>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="themeDark"
                  name="theme"
                  value="dark"
                  checked={settings.theme === 'dark'}
                  onChange={() => setSettings({...settings, theme: 'dark'})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600"
                />
                <label htmlFor="themeDark" className="ml-2 block text-sm text-gray-300">
                  Dark Theme
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="radio"
                  id="themeLight"
                  name="theme"
                  value="light"
                  checked={settings.theme === 'light'}
                  onChange={() => setSettings({...settings, theme: 'light'})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600"
                />
                <label htmlFor="themeLight" className="ml-2 block text-sm text-gray-300">
                  Light Theme (Coming Soon)
                </label>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-5 w-5 mr-2" />
              {isLoading ? 'Saving...' : 'Save Settings'}
            </button>
            
            <button
              type="button"
              onClick={handleReset}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center"
            >
              <Trash2 className="h-5 w-5 mr-2" />
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;

