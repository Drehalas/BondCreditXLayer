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
              <div key={item.path} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) => (isActive ? 'bc-tab bc-tabActive' : 'bc-tab')}
                  style={{ flex: 1, textAlign: 'left', padding: '12px 16px', textDecoration: 'none' }}
                >
                  {item.label}
                </NavLink>
                {item.path !== '/analytics' && (
                  <NavLink 
                    to={item.path} 
                    style={{ 
                      fontSize: '0.75rem', 
                      color: 'var(--bondcredit-green)', 
                      padding: '4px 8px', 
                      border: '1px solid rgba(59, 247, 210, 0.2)', 
                      borderRadius: '4px',
                      textDecoration: 'none'
                    }}
                  >
                    Create
                  </NavLink>
                )}
              </div>
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
