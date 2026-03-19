import type {
  AnalyticsEvent,
  AnalyticsMonitorUpdate,
  AnalyticsReport,
  AnalyticsSimulation,
  AnalyticsSimulateAction,
  BondCreditClientConfig,
  CreditHistory,
  CreditRequest,
  CreditHealth,
  MonitorStop
} from '../types.js';
import { nowIso } from '../util.js';

function periodToDays(period: string): number {
  const p = period.toLowerCase().trim();
  const m = p.match(/(\d+)\s*d/);
  return m ? Math.max(1, Number(m[1])) : 30;
}

export class AnalyticsClient {
  constructor(private readonly cfg: BondCreditClientConfig) {}

  // --- Legacy event hooks (kept from scaffold) ---
  async trade(credit: CreditRequest): Promise<AnalyticsEvent> {
    return { type: 'trade', timestamp: nowIso(), payload: { agentId: this.cfg.agentId, credit } };
  }

  async event(type: AnalyticsEvent['type'], payload: unknown): Promise<AnalyticsEvent> {
    return { type, timestamp: nowIso(), payload };
  }

  // --- Analytics spec methods ---
  async getHealth(): Promise<CreditHealth> {
    // Scaffold: provide a plausible snapshot. Replace with real utilization/repayment metrics.
    const health: CreditHealth = {
      status: 'healthy',
      metrics: {
        creditUtilization: '18%',
        repaymentRate: '100%',
        avgRepaymentTime: '4.2 minutes',
        scoreTrend: '+5 this week'
      },
      warnings: []
    };

    return health;
  }

  async getHistory(period: string = '30d'): Promise<CreditHistory> {
    const days = periodToDays(period);
    const last = days;

    // Scaffold: simple end-to-end timeline.
    const scores: Array<{ date: string; score: number }> = [];
    const base = 700;
    for (let i = last - 1; i >= 0; i -= Math.max(1, Math.floor(last / 6))) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      scores.push({ date: d.toISOString().slice(0, 10), score: base + Math.round((last - i) * 0.5) });
    }

    return {
      scores,
      transactions: 47,
      totalCreditUsed: '0.3 OKB',
      totalRepaid: '0.3005 OKB'
    };
  }

  async simulate(input: { actions: AnalyticsSimulateAction[] }): Promise<AnalyticsSimulation> {
    // Scaffold: map actions to score delta.
    let delta = 0;
    for (const a of input.actions) {
      if (a.type === 'subscribe') delta += 10;
      if (a.type === 'payment') delta += a.success ? Math.min(20, a.count) : 0;
      if (a.type === 'repay') delta += 5;
    }

    const projectedScore = 700 + delta;
    return {
      projectedScore,
      projectedLimit: '0.65 OKB',
      timeToAchieve: '7 days',
      confidence: projectedScore > 750 ? 'high' : 'medium'
    };
  }

  async generateReport(): Promise<AnalyticsReport> {
    return {
      summary: {
        avgScore: 695,
        totalCreditUsed: '2.5 OKB',
        totalRepaid: '2.51 OKB',
        profitFromCredit: '0.35 OKB',
        roi: '14%'
      },
      recommendations: [
        'Repay faster to increase score',
        'Use more diverse services'
      ]
    };
  }

  async monitor(callback: (update: AnalyticsMonitorUpdate) => void): Promise<MonitorStop> {
    // Scaffold: emit periodic updates. Caller can stop via returned function.
    const interval = globalThis.setInterval(() => {
      const roll = Math.random();
      if (roll < 0.2) {
        callback({ type: 'warning', message: 'Credit usage high' });
      } else {
        callback({ type: 'info', message: 'Credit health stable' });
      }
    }, 2500);

    const stop: MonitorStop = () => {
      globalThis.clearInterval(interval);
    };

    // Match the spec style: `const stop = await monitor(...)`.
    return stop;
  }
}

