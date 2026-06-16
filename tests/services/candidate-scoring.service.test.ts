/**
 * Purpose:
 * Unit tests for CandidateScoringService.
 */

import { describe, expect, it } from 'vitest';
import { CandidateScoringService } from '@/services/candidate-scoring.service';

describe('CandidateScoringService', () => {
  it('should calculate margin metrics and weighted winning score', () => {
    const service = new CandidateScoringService();

    const result = service.score({
      recommendedPrice: 100,
      estimatedCOGS: 35,
      estimatedShipping: 10,
      demandScore: 80,
      trendScore: 70,
      competitionScore: 60,
      supplierScore: 75,
      creativePotentialScore: 85,
      riskScore: 30,
    });

    expect(result.estimatedGrossProfit).toBe(55);
    expect(result.grossMarginPercent).toBe(55);
    expect(result.breakEvenRoas).toBe(1.82);
    expect(result.marginScore).toBe(77);
    expect(result.winningScore).toBeGreaterThan(70);
  });

  it('should clamp scores into the 0 to 100 range', () => {
    const service = new CandidateScoringService();

    const result = service.score({
      demandScore: 100,
      trendScore: 100,
      competitionScore: 100,
      marginScore: 100,
      supplierScore: 100,
      creativePotentialScore: 100,
      riskScore: 0,
    });

    expect(result.winningScore).toBe(100);
  });
});
