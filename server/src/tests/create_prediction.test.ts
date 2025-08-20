import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { predictionsTable, matchesTable, teamsTable } from '../db/schema';
import { type CreatePredictionInput } from '../schema';
import { createPrediction } from '../handlers/create_prediction';
import { eq } from 'drizzle-orm';

// Test input for creating prediction
const testPredictionInput: CreatePredictionInput = {
  match_id: 1,
  predicted_outcome: 'home_win',
  confidence_percentage: 75,
  predicted_home_score: 2,
  predicted_away_score: 1,
  reasoning: 'Home team has strong recent form and home advantage',
  model_version: 'v1.0.0'
};

describe('createPrediction', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a prediction for a valid match', async () => {
    // Create prerequisite data - teams first
    const teamResults = await db.insert(teamsTable)
      .values([
        { name: 'Manchester United', code: 'MAN', logo_url: null },
        { name: 'Liverpool', code: 'LIV', logo_url: null }
      ])
      .returning()
      .execute();

    // Create a match
    const matchResults = await db.insert(matchesTable)
      .values({
        home_team_id: teamResults[0].id,
        away_team_id: teamResults[1].id,
        match_date: new Date('2024-01-15'),
        gameweek: 20,
        season: '2023-24',
        status: 'scheduled'
      })
      .returning()
      .execute();

    // Update input with actual match ID
    const input = { ...testPredictionInput, match_id: matchResults[0].id };

    const result = await createPrediction(input);

    // Validate basic fields
    expect(result.match_id).toEqual(matchResults[0].id);
    expect(result.predicted_outcome).toEqual('home_win');
    expect(result.confidence_percentage).toEqual(75);
    expect(result.predicted_home_score).toEqual(2);
    expect(result.predicted_away_score).toEqual(1);
    expect(result.reasoning).toEqual('Home team has strong recent form and home advantage');
    expect(result.model_version).toEqual('v1.0.0');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save prediction to database', async () => {
    // Create prerequisite data
    const teamResults = await db.insert(teamsTable)
      .values([
        { name: 'Arsenal', code: 'ARS', logo_url: null },
        { name: 'Chelsea', code: 'CHE', logo_url: null }
      ])
      .returning()
      .execute();

    const matchResults = await db.insert(matchesTable)
      .values({
        home_team_id: teamResults[0].id,
        away_team_id: teamResults[1].id,
        match_date: new Date('2024-02-10'),
        gameweek: 25,
        season: '2023-24',
        status: 'scheduled'
      })
      .returning()
      .execute();

    const input = { ...testPredictionInput, match_id: matchResults[0].id };
    const result = await createPrediction(input);

    // Query the database to verify the prediction was saved
    const predictions = await db.select()
      .from(predictionsTable)
      .where(eq(predictionsTable.id, result.id))
      .execute();

    expect(predictions).toHaveLength(1);
    expect(predictions[0].match_id).toEqual(matchResults[0].id);
    expect(predictions[0].predicted_outcome).toEqual('home_win');
    expect(predictions[0].confidence_percentage).toEqual(75);
    expect(predictions[0].reasoning).toEqual('Home team has strong recent form and home advantage');
    expect(predictions[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle nullable prediction scores', async () => {
    // Create prerequisite data
    const teamResults = await db.insert(teamsTable)
      .values([
        { name: 'Tottenham', code: 'TOT', logo_url: null },
        { name: 'Newcastle', code: 'NEW', logo_url: null }
      ])
      .returning()
      .execute();

    const matchResults = await db.insert(matchesTable)
      .values({
        home_team_id: teamResults[0].id,
        away_team_id: teamResults[1].id,
        match_date: new Date('2024-03-05'),
        gameweek: 28,
        season: '2023-24',
        status: 'scheduled'
      })
      .returning()
      .execute();

    // Test with null predicted scores
    const inputWithNullScores: CreatePredictionInput = {
      ...testPredictionInput,
      match_id: matchResults[0].id,
      predicted_home_score: null,
      predicted_away_score: null,
      reasoning: null
    };

    const result = await createPrediction(inputWithNullScores);

    expect(result.predicted_home_score).toBeNull();
    expect(result.predicted_away_score).toBeNull();
    expect(result.reasoning).toBeNull();
    expect(result.predicted_outcome).toEqual('home_win');
  });

  it('should throw error when match does not exist', async () => {
    const inputWithInvalidMatch = { ...testPredictionInput, match_id: 999 };

    await expect(createPrediction(inputWithInvalidMatch))
      .rejects
      .toThrow(/Match with ID 999 not found/i);
  });

  it('should throw error when match is already completed', async () => {
    // Create prerequisite data
    const teamResults = await db.insert(teamsTable)
      .values([
        { name: 'West Ham', code: 'WHU', logo_url: null },
        { name: 'Brighton', code: 'BHA', logo_url: null }
      ])
      .returning()
      .execute();

    // Create a completed match
    const matchResults = await db.insert(matchesTable)
      .values({
        home_team_id: teamResults[0].id,
        away_team_id: teamResults[1].id,
        match_date: new Date('2024-01-01'),
        gameweek: 18,
        season: '2023-24',
        status: 'completed',
        home_score: 2,
        away_score: 1
      })
      .returning()
      .execute();

    const input = { ...testPredictionInput, match_id: matchResults[0].id };

    await expect(createPrediction(input))
      .rejects
      .toThrow(/Cannot create prediction for completed match/i);
  });

  it('should allow predictions for in_progress matches', async () => {
    // Create prerequisite data
    const teamResults = await db.insert(teamsTable)
      .values([
        { name: 'Everton', code: 'EVE', logo_url: null },
        { name: 'Aston Villa', code: 'AVL', logo_url: null }
      ])
      .returning()
      .execute();

    // Create an in-progress match
    const matchResults = await db.insert(matchesTable)
      .values({
        home_team_id: teamResults[0].id,
        away_team_id: teamResults[1].id,
        match_date: new Date('2024-01-20'),
        gameweek: 21,
        season: '2023-24',
        status: 'in_progress'
      })
      .returning()
      .execute();

    const input = { ...testPredictionInput, match_id: matchResults[0].id };
    const result = await createPrediction(input);

    expect(result.match_id).toEqual(matchResults[0].id);
    expect(result.predicted_outcome).toEqual('home_win');
    expect(result.id).toBeDefined();
  });

  it('should create predictions with different outcomes', async () => {
    // Create prerequisite data
    const teamResults = await db.insert(teamsTable)
      .values([
        { name: 'Crystal Palace', code: 'CRY', logo_url: null },
        { name: 'Brentford', code: 'BRE', logo_url: null }
      ])
      .returning()
      .execute();

    const matchResults = await db.insert(matchesTable)
      .values({
        home_team_id: teamResults[0].id,
        away_team_id: teamResults[1].id,
        match_date: new Date('2024-02-25'),
        gameweek: 26,
        season: '2023-24',
        status: 'scheduled'
      })
      .returning()
      .execute();

    // Test draw prediction
    const drawPrediction: CreatePredictionInput = {
      ...testPredictionInput,
      match_id: matchResults[0].id,
      predicted_outcome: 'draw',
      confidence_percentage: 45,
      predicted_home_score: 1,
      predicted_away_score: 1,
      reasoning: 'Evenly matched teams with similar recent form'
    };

    const result = await createPrediction(drawPrediction);

    expect(result.predicted_outcome).toEqual('draw');
    expect(result.confidence_percentage).toEqual(45);
    expect(result.predicted_home_score).toEqual(1);
    expect(result.predicted_away_score).toEqual(1);
  });
});