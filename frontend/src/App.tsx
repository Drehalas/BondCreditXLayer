import { BrowserRouter as Router } from 'react-router-dom';
import { BondCreditProvider, useBondCredit } from './context/BondCreditContext';
import AppRoutes from './AppRoutes';
import BondCreditHeader from './components/BondCreditHeader';
import BondCreditTicker from './components/BondCreditTicker';
import BondCreditFooter from './components/BondCreditFooter';
import { RegisterAgent } from './components/RegisterAgent';
import { AnimatePresence } from 'framer-motion';
import './styles/app.css';
import './styles/create.css';
import './styles/dashboard.css';

function AppContent() {
  const { showRegister, setShowRegister } = useBondCredit();

  return (
    <div className="bc-root">
      <BondCreditHeader
        connected={true}
        onRegisterClick={() => setShowRegister(true)}
      />

      <BondCreditTicker />

      <AnimatePresence mode="wait">
        {showRegister ? (
          <RegisterAgent key="register" onBack={() => setShowRegister(false)} />
        ) : (
          <AppRoutes />
        )}
      </AnimatePresence>

      <BondCreditFooter />
    </div>
  );
}

export default function App() {
  return (
    <BondCreditProvider>
      <Router>
        <AppContent />
      </Router>
    </BondCreditProvider>
  );
}

