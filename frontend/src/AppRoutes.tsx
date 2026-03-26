import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import SubscribePage from './pages/SubscribePage';
import GuaranteePage from './pages/GuaranteePage';
import CreditPage from './pages/CreditPage';
import AnalyticsPage from './pages/AnalyticsPage';

import DashboardLayout from './components/layout/DashboardLayout';

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/subscribe" element={<DashboardLayout><SubscribePage /></DashboardLayout>} />
      <Route path="/guarantee" element={<DashboardLayout><GuaranteePage /></DashboardLayout>} />
      <Route path="/credit" element={<DashboardLayout><CreditPage /></DashboardLayout>} />
      <Route path="/analytics" element={<DashboardLayout><AnalyticsPage /></DashboardLayout>} />
    </Routes>
  );
};

export default AppRoutes;
