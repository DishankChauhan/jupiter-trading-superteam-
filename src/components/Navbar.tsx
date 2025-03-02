import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { BarChart3, History, Settings } from 'lucide-react';

const Navbar: React.FC = () => {
  const location = useLocation();
  const { connected } = useWallet();

  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <BarChart3 className="h-8 w-8 text-blue-400 mr-2" />
              <span className="text-xl font-bold text-white">Jupiter Trading</span>
            </Link>
            
            <div className="ml-10 flex items-center space-x-4">
              <NavLink to="/" active={location.pathname === '/'}>
                <BarChart3 className="h-5 w-5 mr-1" />
                Dashboard
              </NavLink>
              
              <NavLink to="/history" active={location.pathname === '/history'}>
                <History className="h-5 w-5 mr-1" />
                Order History
              </NavLink>
              
              <NavLink to="/settings" active={location.pathname === '/settings'}>
                <Settings className="h-5 w-5 mr-1" />
                Settings
              </NavLink>
            </div>
          </div>
          
          <div className="flex items-center">
            <WalletMultiButton className="!bg-blue-600 hover:!bg-blue-700 !rounded-md" />
          </div>
        </div>
      </div>
    </nav>
  );
};

interface NavLinkProps {
  to: string;
  active: boolean;
  children: React.ReactNode;
}

const NavLink: React.FC<NavLinkProps> = ({ to, active, children }) => {
  return (
    <Link
      to={to}
      className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
        active
          ? 'bg-gray-900 text-white'
          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
      }`}
    >
      {children}
    </Link>
  );
};

export default Navbar;