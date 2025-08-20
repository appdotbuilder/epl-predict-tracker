import { db } from '../db';
import { predictionsTable, matchesTable } from '../db/schema';
import { type Prediction } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getPredictions = async (matchId?: number): Promise<Prediction[]> => {
  try {
    // Build base query with join
    const baseQuery = db.select({
      id: predictionsTable.id,
      match_id: predictionsTable.match_id,
      predicted_outcome: predictionsTable.predicted_outcome,
      confidence_percentage: predictionsTable.confidence_percentage,
      predicted_home_score: predictionsTable.predicted_home_score,
      predicted_away_score: predictionsTable.predicted_away_score,
      reasoning: predictionsTable.reasoning,
      model_version: predictionsTable.model_version,
      created_at: predictionsTable.created_at,
      match_date: matchesTable.match_date
    })
    .from(predictionsTable)
    .innerJoin(matchesTable, eq(predictionsTable.match_id, matchesTable.id));

    // Build final query with conditional filter and ordering
    const finalQuery = matchId !== undefined
      ? baseQuery.where(eq(predictionsTable.match_id, matchId)).orderBy(desc(matchesTable.match_date))
      : baseQuery.orderBy(desc(matchesTable.match_date));

    const results = await finalQuery.execute();

    // Transform results to match Prediction schema (remove match_date)
    return results.map(result => ({
      id: result.id,
      match_id: result.match_id,
      predicted_outcome: result.predicted_outcome,
      confidence_percentage: result.confidence_percentage,
      predicted_home_score: result.predicted_home_score,
      predicted_away_score: result.predicted_away_score,
      reasoning: result.reasoning,
      model_version: result.model_version,
      created_at: result.created_at
    }));
  } catch (error) {
    console.error('Failed to fetch predictions:', error);
    throw error;
  }
};