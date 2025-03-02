import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { WalletProvider } from './contexts/WalletContext';
import { OrderProvider } from './contexts/OrderContext';
import { PriceProvider } from './contexts/PriceContext';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import OrderHistory from './pages/OrderHistory';
import Settings from './pages/Settings';

function App() {
  return (
    <WalletProvider>
      <PriceProvider>
        <OrderProvider>
          <Router>
            <div className="min-h-screen bg-gray-900 text-white">
              <Toaster position="top-right" />
              <Navbar />
              <div className="container mx-auto px-4 py-8">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/history" element={<OrderHistory />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </div>
            </div>
          </Router>
        </OrderProvider>
      </PriceProvider>
    </WalletProvider>
  );
}

export default App;