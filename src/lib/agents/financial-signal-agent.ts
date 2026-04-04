/**
 * Financial Signal Agent v1
 * Analyzes financial health of clients based on Stripe invoice data
 */

import {
  StripeInvoiceData,
  DisputeSignal,
  TrendSignal,
  FinancialHealthScore,
  ClientRevenue,
} from '@/types/stripe';

export class FinancialSignalAgent {
  /**
   * Analyzes payment timeliness from invoice data
   * Returns 0-100 score where 100 is perfect on-time payment
   */
  analyzePaymentTimeliness(invoices: StripeInvoiceData[]): number {
    if (invoices.length === 0) {
      return 100; // No history = good
    }

    const paidInvoices = invoices.filter((inv) => inv.status === 'paid');
    if (paidInvoices.length === 0) {
      return 0; // No paid invoices = bad
    }

    let totalLateDays = 0;
    let latePaidCount = 0;

    for (const invoice of paidInvoices) {
      if (invoice.dueDate && invoice.paidDate) {
        const lateDays = Math.max(0, invoice.paidDate - invoice.dueDate) / (24 * 60 * 60);
        if (lateDays > 0) {
          latePaidCount++;
          totalLateDays += lateDays;
        }
      }
    }

    if (latePaidCount === 0) {
      return 100; // All paid on time
    }

    const avgLateDays = totalLateDays / latePaidCount;
    const latePercentage = (latePaidCount / paidInvoices.length) * 100;

    // Scoring: deduct based on percentage of late payments and avg days late
    let score = 100;
    score -= latePercentage * 0.5; // Late payment percentage
    score -= Math.min(avgLateDays * 0.5, 30); // Avg late days (capped at 30 days impact)

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Detects invoice disputes and payment issues
   */
  detectInvoiceDisputes(invoices: StripeInvoiceData[]): DisputeSignal[] {
    const signals: DisputeSignal[] = [];

    // Check for unpaid/uncollectible invoices
    for (const invoice of invoices) {
      if (invoice.status === 'uncollectible') {
        signals.push({
          type: 'dispute',
          severity: 'high',
          invoiceId: invoice.id,
          message: `Invoice ${invoice.invoiceNumber || invoice.id} marked as uncollectible`,
          detectedAt: Date.now(),
        });
      }

      // Detect late payments
      if (
        invoice.status === 'paid' &&
        invoice.dueDate &&
        invoice.paidDate &&
        invoice.paidDate > invoice.dueDate
      ) {
        const lateDays = Math.floor((invoice.paidDate - invoice.dueDate) / (24 * 60 * 60));
        const severity =
          lateDays > 60 ? 'high' : lateDays > 30 ? 'medium' : 'low';

        signals.push({
          type: 'late_payment',
          severity,
          invoiceId: invoice.id,
          message: `Invoice ${invoice.invoiceNumber || invoice.id} paid ${lateDays} days late (Amount: $${(invoice.amount / 100).toFixed(2)})`,
          detectedAt: Date.now(),
        });
      }

      // Detect open invoices that are overdue
      if (invoice.status === 'open' && invoice.dueDate) {
        const now = Math.floor(Date.now() / 1000);
        if (invoice.dueDate < now) {
          const overdueDays = Math.floor((now - invoice.dueDate) / (24 * 60 * 60));
          const severity =
            overdueDays > 60 ? 'high' : overdueDays > 30 ? 'medium' : 'low';

          signals.push({
            type: 'late_payment',
            severity,
            invoiceId: invoice.id,
            message: `Invoice ${invoice.invoiceNumber || invoice.id} is overdue by ${overdueDays} days (Amount: $${(invoice.amount / 100).toFixed(2)})`,
            detectedAt: Date.now(),
          });
        }
      }

      // Detect failed payment attempts
      if (invoice.paymentIntentStatus === 'requires_payment_method' || invoice.paymentIntentStatus === 'requires_action') {
        signals.push({
          type: 'failed_payment',
          severity: 'medium',
          invoiceId: invoice.id,
          message: `Invoice ${invoice.invoiceNumber || invoice.id} has failed payment attempts (Amount: $${(invoice.amount / 100).toFixed(2)})`,
          detectedAt: Date.now(),
        });
      }
    }

    return signals;
  }

  /**
   * Analyzes contract value trend from invoices
   * Returns trend direction and percentage change
   */
  analyzeContractValueTrend(invoices: StripeInvoiceData[]): TrendSignal {
    if (invoices.length < 2) {
      return {
        direction: 'stable',
        percentageChange: 0,
        confidence: 0.3,
        message: 'Insufficient data to determine trend',
      };
    }

    // Sort by date ascending
    const sorted = [...invoices].sort((a, b) => a.createdAt - b.createdAt);

    // Split into two periods
    const midpoint = Math.floor(sorted.length / 2);
    const periodOne = sorted.slice(0, midpoint);
    const periodTwo = sorted.slice(midpoint);

    const avg1 =
      periodOne.reduce((sum, inv) => sum + inv.amount, 0) / periodOne.length;
    const avg2 =
      periodTwo.reduce((sum, inv) => sum + inv.amount, 0) / periodTwo.length;

    const percentageChange = ((avg2 - avg1) / avg1) * 100;
    const absoluteChange = Math.abs(percentageChange);

    let direction: 'increasing' | 'decreasing' | 'stable';
    if (absoluteChange < 5) {
      direction = 'stable';
    } else {
      direction = percentageChange > 0 ? 'increasing' : 'decreasing';
    }

    // Confidence based on consistency
    const variance1 = this.calculateVariance(
      periodOne.map((inv) => inv.amount)
    );
    const variance2 = this.calculateVariance(
      periodTwo.map((inv) => inv.amount)
    );
    const avgVariance = (variance1 + variance2) / 2;
    const confidence = Math.max(0.3, Math.min(0.95, 1 - avgVariance / 100000));

    const message =
      direction === 'stable'
        ? 'Contract value is stable'
        : direction === 'increasing'
          ? `Contract value increasing by ${percentageChange.toFixed(1)}%`
          : `Contract value decreasing by ${Math.abs(percentageChange).toFixed(1)}%`;

    return {
      direction,
      percentageChange,
      confidence,
      message,
    };
  }

  /**
   * Detects revenue concentration risk
   * Returns 0-100 score where 100 is high risk (all from one client)
   */
  detectRevenueConcentrationRisk(allClients: ClientRevenue[]): number {
    if (allClients.length === 0) {
      return 0;
    }

    const totalRevenue = allClients.reduce((sum, c) => sum + c.totalRevenue, 0);
    if (totalRevenue === 0) {
      return 0;
    }

    // Calculate Herfindahl index for concentration
    let herfindahl = 0;
    for (const client of allClients) {
      const share = client.totalRevenue / totalRevenue;
      herfindahl += share * share;
    }

    // Convert to 0-100 risk score
    // Herfindahl ranges from 1/n to 1 (perfect diversity to perfect concentration)
    const minHerfindahl = 1 / allClients.length;
    const riskScore = ((herfindahl - minHerfindahl) / (1 - minHerfindahl)) * 100;

    return Math.min(100, Math.max(0, riskScore));
  }

  /**
   * Computes overall financial health score
   */
  async computeFinancialHealthScore(
    invoices: StripeInvoiceData[],
    allClientsRevenue: ClientRevenue[] = []
  ): Promise<FinancialHealthScore> {
    const paymentTimeliness = this.analyzePaymentTimeliness(invoices);
    const disputes = this.detectInvoiceDisputes(invoices);
    const trendSignal = this.analyzeContractValueTrend(invoices);
    const concentrationRisk = this.detectRevenueConcentrationRisk(
      allClientsRevenue
    );

    // Invert dispute score (high disputes = low score)
    const disputeScore = Math.max(
      0,
      100 - disputes.filter((d) => d.severity === 'high').length * 15 -
        disputes.filter((d) => d.severity === 'medium').length * 8 -
        disputes.filter((d) => d.severity === 'low').length * 3
    );

    // Invert concentration risk (high risk = low score)
    const concentrationScore = 100 - concentrationRisk;

    // Map trend to score
    let trendScore = 50; // neutral
    if (trendSignal.direction === 'increasing') {
      trendScore = 75 + trendSignal.percentageChange * 0.25;
    } else if (trendSignal.direction === 'decreasing') {
      trendScore = 50 + trendSignal.percentageChange * 0.25;
    }
    trendScore = Math.max(0, Math.min(100, trendScore));

    // Weighted average
    const weights = {
      paymentTimeliness: 0.4,
      disputes: 0.3,
      trend: 0.2,
      concentration: 0.1,
    };

    const score =
      paymentTimeliness * weights.paymentTimeliness +
      disputeScore * weights.disputes +
      trendScore * weights.trend +
      concentrationScore * weights.concentration;

    // Determine grade
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else grade = 'F';

    // Generate explanation
    const explanation = this.generateExplanation(
      score,
      paymentTimeliness,
      disputeScore,
      trendScore,
      disputes
    );

    return {
      score: Math.round(score),
      grade,
      subScores: {
        paymentTimeliness: Math.round(paymentTimeliness),
        invoiceDisputes: Math.round(disputeScore),
        revenueTrend: Math.round(trendScore),
        concentrationRisk: Math.round(concentrationScore),
      },
      signals: disputes,
      trendSignal,
      explanation,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Helper: Calculate variance of a set of numbers
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    return variance;
  }

  /**
   * Helper: Generate human-readable explanation
   */
  private generateExplanation(
    score: number,
    timeliness: number,
    disputes: number,
    trend: number,
    signals: DisputeSignal[]
  ): string {
    const parts: string[] = [];

    if (timeliness >= 90) {
      parts.push('Payment timeliness is excellent');
    } else if (timeliness >= 70) {
      parts.push('Payment timeliness is good');
    } else {
      parts.push('Payment timeliness needs improvement');
    }

    if (disputes >= 90) {
      parts.push('Very few payment disputes');
    } else if (disputes >= 70) {
      parts.push('Some payment issues detected');
    } else {
      parts.push('Multiple payment disputes require attention');
    }

    if (trend >= 75) {
      parts.push('contract value is growing');
    } else if (trend <= 40) {
      parts.push('contract value is declining');
    }

    if (signals.length > 0) {
      const highSeverity = signals.filter((s) => s.severity === 'high').length;
      if (highSeverity > 0) {
        parts.push(`${highSeverity} high-severity issues found`);
      }
    }

    return parts.join('. ') + '.';
  }
}
