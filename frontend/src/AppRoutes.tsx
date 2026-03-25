import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import SubscribePage from './pages/SubscribePage';
import GuaranteePage from './pages/GuaranteePage';
import CreditPage from './pages/CreditPage';
import AnalyticsPage from './pages/AnalyticsPage';

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/subscribe" element={<SubscribePage />} />
      <Route path="/guarantee" element={<GuaranteePage />} />
      <Route path="/credit" element={<CreditPage />} />
      <Route path="/analytics" element={<AnalyticsPage />} />
    </Routes>
  );
};

export default AppRoutes;
