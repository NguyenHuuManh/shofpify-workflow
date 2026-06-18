/**
 * Purpose:
 * Deterministic scoring for Research Product candidates.
 *
 * Responsibilities:
 * - Estimate margin metrics from price and cost inputs
 * - Calculate weighted winning score
 * - Keep scoring weights configurable at service construction
 */

import { validate } from '@/lib/validate';
import { candidateScorePayloadSchema } from '@/schemas/research.schema';
import type {
  CandidateScoreResult,
  CandidateScoringWeights,
  ScoreCandidateInput,
} from '@/types/research.types';

const DEFAULT_WEIGHTS: CandidateScoringWeights = {
  demand: 0.2,
  trend: 0.12,
  competition: 0.1,
  margin: 0.17,
  supplier: 0.04,
  sourcing: 0.1,
  factoryCost: 0.08,
  logistics: 0.07,
  creativePotential: 0.08,
  risk: 0.04,
};

export class CandidateScoringService {
  private readonly weights: CandidateScoringWeights;

  constructor(weights: Partial<CandidateScoringWeights> = {}) {
    this.weights = this.normalizeWeights({ ...DEFAULT_WEIGHTS, ...weights });
  }

  score(input: ScoreCandidateInput): CandidateScoreResult {
    const parsed = validate(candidateScorePayloadSchema, input);
    const marginMetrics = this.calculateMargin(parsed);

    const demandScore = this.scoreOrDefault(parsed.demandScore, 50);
    const trendScore = this.scoreOrDefault(parsed.trendScore, 50);
    const competitionScore = this.scoreOrDefault(parsed.competitionScore, 50);
    const marginScore = this.scoreOrDefault(
      parsed.marginScore,
      marginMetrics.grossMarginPercent === undefined
        ? 50
        : Math.round(marginMetrics.grossMarginPercent * 1.4),
    );
    const supplierScore = this.scoreOrDefault(parsed.supplierScore, 50);
    const sourcingScore = this.scoreOrDefault(
      parsed.sourcingScore,
      parsed.supplierScore ?? 50,
    );
    const factoryCostScore = this.scoreOrDefault(
      parsed.factoryCostScore,
      marginScore,
    );
    const logisticsScore = this.scoreOrDefault(
      parsed.logisticsScore,
      parsed.sourcingScore ?? parsed.supplierScore ?? 50,
    );
    const creativePotentialScore = this.scoreOrDefault(
      parsed.creativePotentialScore,
      50,
    );
    const riskScore = this.scoreOrDefault(parsed.riskScore, 50);

    const winningScore = Math.round(
      demandScore * this.weights.demand +
        trendScore * this.weights.trend +
        competitionScore * this.weights.competition +
        marginScore * this.weights.margin +
        supplierScore * this.weights.supplier +
        sourcingScore * this.weights.sourcing +
        factoryCostScore * this.weights.factoryCost +
        logisticsScore * this.weights.logistics +
        creativePotentialScore * this.weights.creativePotential +
        (100 - riskScore) * this.weights.risk,
    );

    return {
      demandScore,
      trendScore,
      competitionScore,
      marginScore,
      supplierScore,
      sourcingScore,
      factoryCostScore,
      logisticsScore,
      creativePotentialScore,
      riskScore,
      winningScore: this.clampScore(winningScore),
      ...marginMetrics,
    };
  }

  private calculateMargin(input: ScoreCandidateInput): Pick<
    CandidateScoreResult,
    'landedCost' | 'estimatedGrossProfit' | 'grossMarginPercent' | 'breakEvenRoas'
  > {
    const price = input.recommendedPrice;
    if (!price || price <= 0) {
      return {};
    }

    const totalCost =
      input.landedCost ?? (input.estimatedCOGS ?? 0) + (input.estimatedShipping ?? 0);
    const estimatedGrossProfit = Math.round((price - totalCost) * 100) / 100;
    const grossMarginPercent =
      Math.round((estimatedGrossProfit / price) * 10000) / 100;
    const breakEvenRoas =
      estimatedGrossProfit > 0
        ? Math.round((price / estimatedGrossProfit) * 100) / 100
        : undefined;

    return {
      landedCost: input.landedCost,
      estimatedGrossProfit,
      grossMarginPercent,
      breakEvenRoas,
    };
  }

  private scoreOrDefault(value: number | undefined, fallback: number): number {
    return this.clampScore(value ?? fallback);
  }

  private clampScore(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private normalizeWeights(
    weights: CandidateScoringWeights,
  ): CandidateScoringWeights {
    const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
    return {
      demand: weights.demand / total,
      trend: weights.trend / total,
      competition: weights.competition / total,
      margin: weights.margin / total,
      supplier: weights.supplier / total,
      sourcing: weights.sourcing / total,
      factoryCost: weights.factoryCost / total,
      logistics: weights.logistics / total,
      creativePotential: weights.creativePotential / total,
      risk: weights.risk / total,
    };
  }
}

export const candidateScoringService = new CandidateScoringService();
