import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import SubscribePage from './pages/SubscribePage';
import GuaranteePage from './pages/GuaranteePage';
import CreditPage from './pages/CreditPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SkillPage from './pages/SkillPage';
import CreatePage from './pages/CreatePage';
import TradingDashboardPage from './pages/TradingDashboardPage';
import TradePage from './pages/TradePage';
import SwapPage from './pages/SwapPage';

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/subscribe" element={<SubscribePage />} />
      <Route path="/guarantee" element={<GuaranteePage />} />
      <Route path="/credit" element={<CreditPage />} />
      <Route path="/analytics" element={<AnalyticsPage />} />
      <Route path="/skill" element={<SkillPage />} />
      <Route path="/create" element={<CreatePage />} />
      <Route path="/dashboard" element={<TradingDashboardPage />} />
      <Route path="/trade" element={<TradePage />} />
      <Route path="/swap" element={<SwapPage />} />
    </Routes>
  );
};

export default AppRoutes;
