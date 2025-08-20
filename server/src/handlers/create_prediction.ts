import { db } from '../db';
import { predictionsTable, matchesTable } from '../db/schema';
import { type CreatePredictionInput, type Prediction } from '../schema';
import { eq } from 'drizzle-orm';

export const createPrediction = async (input: CreatePredictionInput): Promise<Prediction> => {
  try {
    // First, validate that the match exists and hasn't been completed yet
    const existingMatch = await db.select()
      .from(matchesTable)
      .where(eq(matchesTable.id, input.match_id))
      .limit(1)
      .execute();

    if (existingMatch.length === 0) {
      throw new Error(`Match with ID ${input.match_id} not found`);
    }

    const match = existingMatch[0];
    if (match.status === 'completed') {
      throw new Error(`Cannot create prediction for completed match ${input.match_id}`);
    }

    // Insert the prediction record
    const result = await db.insert(predictionsTable)
      .values({
        match_id: input.match_id,
        predicted_outcome: input.predicted_outcome,
        confidence_percentage: input.confidence_percentage,
        predicted_home_score: input.predicted_home_score,
        predicted_away_score: input.predicted_away_score,
        reasoning: input.reasoning,
        model_version: input.model_version
      })
      .returning()
      .execute();

    const prediction = result[0];
    return prediction;
  } catch (error) {
    console.error('Prediction creation failed:', error);
    throw error;
  }
};