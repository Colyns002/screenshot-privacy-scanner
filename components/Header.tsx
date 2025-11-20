import React from 'react';
import { Shield, EyeOff } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center space-x-2">
        <div className="bg-blue-600 p-2 rounded-lg">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">PrivacyGuard</h1>
          <p className="text-xs text-gray-400">Screenshot Analyzer</p>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <div className="hidden md:flex items-center text-sm text-gray-400 space-x-1">
          <EyeOff className="w-4 h-4" />
          <span>Client-side rendering for maximum privacy</span>
        </div>
      </div>
    </header>
  );
};

export default Header;