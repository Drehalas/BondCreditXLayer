import React from 'react';

interface TickerItemProps {
  symbol: string;
  price: string;
  change: string;
  isPositive: boolean;
}

const TickerItem: React.FC<TickerItemProps> = ({ symbol, price, change, isPositive }) => (
  <div
    className="flex items-center border-none transition-opacity hover:opacity-80 h-full"
    style={{
      padding: '0 20px',
      gap: '10px',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center'
    }}
  >
    <span className="text-mono font-medium" style={{ color: 'var(--bondcredit-s2)', fontSize: '0.75rem' }}>
      ${symbol}
    </span>
    <span className="text-mono font-bold" style={{ color: 'var(--bondcredit-white)', fontSize: '0.75rem' }}>
      ${price}
    </span>
    <span className={`text-mono font-semibold ${isPositive ? 'text-bondcredit-green' : 'text-bondcredit-red'}`} style={{ color: isPositive ? 'var(--bondcredit-green)' : 'var(--bondcredit-red)', fontSize: '0.75rem', marginLeft: '6px' }}>
      {isPositive ? '+' : '-'}{change}%
    </span>
  </div>
);

const BondCreditTicker: React.FC = () => {
  const items: TickerItemProps[] = [
    { symbol: 'BTC', price: '94,432.12', change: '2.4', isPositive: true },
    { symbol: 'ETH', price: '3,124.55', change: '1.2', isPositive: false },
    { symbol: 'HBAR', price: '0.1452', change: '5.8', isPositive: true },
    { symbol: 'USDC', price: '1.00', change: '0.01', isPositive: true },
    { symbol: 'MAMO', price: '0.124', change: '15.2', isPositive: true },
    { symbol: 'GIZA', price: '0.0179', change: '0.53', isPositive: true },
  ];

  const displayItems = [...items, ...items, ...items, ...items];

  return (
    <div className="ticker-wrap overflow-hidden" style={{ height: '32px', background: 'var(--bondcredit-bg)', borderBottom: '1px solid var(--bondcredit-border)', position: 'fixed', top: '48px', left: 0, right: 0, display: 'flex', alignItems: 'center', zIndex: 40 }}>
      <div className="animate-scroll flex whitespace-nowrap items-center h-full">
        {displayItems.map((item, idx) => (
          <TickerItem key={idx} {...item} />
        ))}
      </div>
    </div>
  );
};

export default BondCreditTicker;
