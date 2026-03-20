import type { AnalyticsEvent, AnalyticsMonitorUpdate, AnalyticsReport, AnalyticsSimulation, AnalyticsSimulateAction, BondCreditClientConfig, CreditHistory, CreditRequest, CreditHealth, MonitorStop } from '../types.js';
export declare class AnalyticsClient {
    private readonly cfg;
    constructor(cfg: BondCreditClientConfig);
    trade(credit: CreditRequest): Promise<AnalyticsEvent>;
    event(type: AnalyticsEvent['type'], payload: unknown): Promise<AnalyticsEvent>;
    getHealth(): Promise<CreditHealth>;
    getHistory(period?: string): Promise<CreditHistory>;
    simulate(input: {
        actions: AnalyticsSimulateAction[];
    }): Promise<AnalyticsSimulation>;
    generateReport(): Promise<AnalyticsReport>;
    monitor(callback: (update: AnalyticsMonitorUpdate) => void): Promise<MonitorStop>;
}
//# sourceMappingURL=AnalyticsClient.d.ts.map