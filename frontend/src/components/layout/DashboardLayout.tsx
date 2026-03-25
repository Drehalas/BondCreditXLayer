import React from 'react';
import { NavLink } from 'react-router-dom';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const navItems = [
    { path: '/subscribe', label: 'Subscribe' },
    { path: '/guarantee', label: 'Guarantee (x402)' },
    { path: '/credit', label: 'Credit' },
    { path: '/analytics', label: 'Analytics' }
  ];

  return (
    <main className="bc-layout wt-container" style={{ marginTop: '88px' }}>
      <aside className="bc-sidebar">
        <section className="bc-card bc-tabs">
          <div className="bc-tabsRow" style={{ flexDirection: 'column', gap: '8px' }}>
            {navItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => (isActive ? 'bc-tab bc-tabActive' : 'bc-tab')}
                style={{ width: '100%', textAlign: 'left', padding: '12px 16px' }}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </section>
      </aside>

      <section className="bc-main">
        {children}
      </section>
    </main>
  );
};

export default DashboardLayout;
