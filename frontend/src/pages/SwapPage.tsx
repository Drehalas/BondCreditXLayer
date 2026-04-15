import React, { useState } from 'react';
import { ArrowDown, Settings, ChevronDown, Activity, Navigation, Zap } from 'lucide-react';
import '../styles/dashboard.css';

const SwapPage: React.FC = () => {
  const [payAmount, setPayAmount] = useState<string>('');
  const [receiveAmount, setReceiveAmount] = useState<string>('');
  const [isHoveringSwap, setIsHoveringSwap] = useState(false);

  const tokens = {
    ETH: { symbol: 'ETH', balance: '1.45', price: 3450.21, logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png' },
    USDC: { symbol: 'USDC', balance: '250.00', price: 1.00, logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png' }
  };

  const handlePayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^[0-9]*[.,]?[0-9]*$/.test(val)) {
      setPayAmount(val);
      if (val) {
        setReceiveAmount((parseFloat(val) * tokens.ETH.price).toFixed(6));
      } else {
        setReceiveAmount('');
      }
    }
  };

  return (
    <main className="wt-container" style={{ marginTop: '88px', minHeight: 'calc(100vh - 88px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: '100px' }}>
      
      {/* Swap Widget */}
      <div style={{ width: '100%', maxWidth: '440px', background: '#050505', border: '1px solid #1a1a1a', borderRadius: '24px', padding: '16px', position: 'relative' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '0 8px' }}>
          <div style={{ display: 'flex', gap: '20px' }}>
            <span style={{ color: '#fff', fontSize: '1.125rem', fontWeight: 600 }}>Swap</span>
            <span style={{ color: '#6b7280', fontSize: '1.125rem', fontWeight: 500, cursor: 'pointer' }}>Limit</span>
          </div>
          <div style={{ display: 'flex', gap: '16px', color: '#9ca3af' }}>
            <Activity strokeWidth={2} size={20} style={{ cursor: 'pointer', transition: 'color 0.2s' }} />
            <Settings strokeWidth={2} size={20} style={{ cursor: 'pointer', transition: 'color 0.2s' }} />
          </div>
        </div>

        {/* Pay Block */}
        <div style={{ background: '#111111', borderRadius: '16px', padding: '16px', border: '1px solid transparent', transition: 'border-color 0.2s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af', fontSize: '0.875rem', marginBottom: '8px' }}>
            <span>Pay</span>
            <span>Balance: {tokens.ETH.balance}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="0"
              value={payAmount}
              onChange={handlePayChange}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '2rem', fontWeight: 600, width: '100%', outline: 'none', padding: 0 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1f1f1f', padding: '6px 12px 6px 8px', borderRadius: '100px', cursor: 'pointer', flexShrink: 0, border: '1px solid #333' }}>
              <img src={tokens.ETH.logo} alt="ETH" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
              <span style={{ color: '#fff', fontSize: '1rem', fontWeight: 600 }}>ETH</span>
              <ChevronDown size={18} color="#9ca3af" />
            </div>
          </div>
          <div style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '8px' }}>
            {payAmount ? "~$" + (parseFloat(payAmount) * tokens.ETH.price).toFixed(2) : '$0.00'}
          </div>
        </div>

        {/* Inverter Button */}
        <div style={{ display: 'flex', justifyContent: 'center', height: '8px', position: 'relative', zIndex: 10 }}>
          <div 
            style={{ 
              background: '#050505', 
              border: '4px solid #050505',
              borderRadius: '50%', 
              position: 'absolute', 
              top: '-20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px'
            }}
            onMouseEnter={() => setIsHoveringSwap(true)}
            onMouseLeave={() => setIsHoveringSwap(false)}
          >
            <div style={{ 
              background: isHoveringSwap ? '#1f1f1f' : '#111111', 
              width: '100%', 
              height: '100%', 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}>
              <ArrowDown size={18} color="#fff" />
            </div>
          </div>
        </div>

        {/* Receive Block */}
        <div style={{ background: '#111111', borderRadius: '16px', padding: '16px', border: '1px solid transparent', transition: 'border-color 0.2s', marginTop: '2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af', fontSize: '0.875rem', marginBottom: '8px' }}>
            <span>Receive</span>
            <span>Balance: {tokens.USDC.balance}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="0"
              value={receiveAmount}
              readOnly
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '2rem', fontWeight: 600, width: '100%', outline: 'none', padding: 0 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', padding: '6px 12px 6px 8px', borderRadius: '100px', cursor: 'pointer', flexShrink: 0 }}>
              <img src={tokens.USDC.logo} alt="USDC" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
              <span style={{ color: '#000', fontSize: '1rem', fontWeight: 600 }}>USDC</span>
              <ChevronDown size={18} color="#000" />
            </div>
          </div>
          <div style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '8px' }}>
            {receiveAmount ? "~$" + receiveAmount : '$0.00'}
          </div>
        </div>

        {/* Rate Info */}
        {payAmount && (
          <div style={{ padding: '16px 8px 8px 8px', fontSize: '0.875rem', color: '#9ca3af', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <span style={{ cursor: 'pointer' }}>1 ETH = 3,450.21 USDC</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}><Zap size={14} fill="#10b981"/> $0.41 Gas</span>
              <ChevronDown size={16} />
            </div>
          </div>
        )}

        {/* Button */}
        <button style={{ 
          width: '100%', 
          background: payAmount ? '#fff' : '#1f1f1f', 
          color: payAmount ? '#000' : '#6b7280', 
          fontSize: '1.125rem', 
          fontWeight: 600, 
          padding: '16px', 
          borderRadius: '100px', 
          border: 'none', 
          marginTop: payAmount ? '16px' : '24px',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}>
          {payAmount ? 'Swap' : 'Enter an amount'}
        </button>

      </div>
      
      {/* Routing Notice */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6b7280', fontSize: '0.875rem', marginTop: '24px' }}>
        <Navigation size={14} />
        <span>Trades routed through Uniswap V3 on OKX DEX</span>
      </div>

    </main>
  );
};

export default SwapPage;
