import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { teamsTable, matchesTable, predictionsTable } from '../db/schema';
import { getPredictions } from '../handlers/get_predictions';

describe('getPredictions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no predictions exist', async () => {
    const result = await getPredictions();
    expect(result).toEqual([]);
  });

  it('should return all predictions ordered by match date descending', async () => {
    // Create test teams
    const teams = await db.insert(teamsTable)
      .values([
        { name: 'Team A', code: 'TA', logo_url: null },
        { name: 'Team B', code: 'TB', logo_url: null },
        { name: 'Team C', code: 'TC', logo_url: null },
        { name: 'Team D', code: 'TD', logo_url: null }
      ])
      .returning()
      .execute();

    // Create matches with different dates
    const matches = await db.insert(matchesTable)
      .values([
        {
          home_team_id: teams[0].id,
          away_team_id: teams[1].id,
          match_date: new Date('2024-01-15T15:00:00Z'),
          gameweek: 1,
          season: '2024-25'
        },
        {
          home_team_id: teams[2].id,
          away_team_id: teams[3].id,
          match_date: new Date('2024-01-20T15:00:00Z'),
          gameweek: 2,
          season: '2024-25'
        }
      ])
      .returning()
      .execute();

    // Create predictions
    const predictions = await db.insert(predictionsTable)
      .values([
        {
          match_id: matches[0].id,
          predicted_outcome: 'home_win',
          confidence_percentage: 75,
          predicted_home_score: 2,
          predicted_away_score: 1,
          reasoning: 'Strong home advantage',
          model_version: 'v1.0'
        },
        {
          match_id: matches[1].id,
          predicted_outcome: 'draw',
          confidence_percentage: 60,
          predicted_home_score: 1,
          predicted_away_score: 1,
          reasoning: 'Evenly matched teams',
          model_version: 'v1.0'
        }
      ])
      .returning()
      .execute();

    const result = await getPredictions();

    // Should return 2 predictions
    expect(result).toHaveLength(2);

    // Should be ordered by match date descending (most recent first)
    expect(result[0].match_id).toEqual(matches[1].id); // Jan 20 match first
    expect(result[1].match_id).toEqual(matches[0].id); // Jan 15 match second

    // Verify prediction data structure
    expect(result[0]).toEqual({
      id: predictions[1].id,
      match_id: matches[1].id,
      predicted_outcome: 'draw',
      confidence_percentage: 60,
      predicted_home_score: 1,
      predicted_away_score: 1,
      reasoning: 'Evenly matched teams',
      model_version: 'v1.0',
      created_at: expect.any(Date)
    });
  });

  it('should filter predictions by match ID when provided', async () => {
    // Create test teams
    const teams = await db.insert(teamsTable)
      .values([
        { name: 'Team A', code: 'TA', logo_url: null },
        { name: 'Team B', code: 'TB', logo_url: null },
        { name: 'Team C', code: 'TC', logo_url: null },
        { name: 'Team D', code: 'TD', logo_url: null }
      ])
      .returning()
      .execute();

    // Create matches
    const matches = await db.insert(matchesTable)
      .values([
        {
          home_team_id: teams[0].id,
          away_team_id: teams[1].id,
          match_date: new Date('2024-01-15T15:00:00Z'),
          gameweek: 1,
          season: '2024-25'
        },
        {
          home_team_id: teams[2].id,
          away_team_id: teams[3].id,
          match_date: new Date('2024-01-20T15:00:00Z'),
          gameweek: 2,
          season: '2024-25'
        }
      ])
      .returning()
      .execute();

    // Create predictions for both matches
    await db.insert(predictionsTable)
      .values([
        {
          match_id: matches[0].id,
          predicted_outcome: 'home_win',
          confidence_percentage: 75,
          predicted_home_score: 2,
          predicted_away_score: 1,
          reasoning: 'Strong home advantage',
          model_version: 'v1.0'
        },
        {
          match_id: matches[1].id,
          predicted_outcome: 'draw',
          confidence_percentage: 60,
          predicted_home_score: null,
          predicted_away_score: null,
          reasoning: null,
          model_version: 'v1.1'
        }
      ])
      .returning()
      .execute();

    // Get predictions for specific match
    const result = await getPredictions(matches[0].id);

    // Should return only 1 prediction
    expect(result).toHaveLength(1);
    expect(result[0].match_id).toEqual(matches[0].id);
    expect(result[0].predicted_outcome).toEqual('home_win');
    expect(result[0].confidence_percentage).toEqual(75);
  });

  it('should return empty array for non-existent match ID', async () => {
    // Create test teams and match with prediction
    const teams = await db.insert(teamsTable)
      .values([
        { name: 'Team A', code: 'TA', logo_url: null },
        { name: 'Team B', code: 'TB', logo_url: null }
      ])
      .returning()
      .execute();

    const matches = await db.insert(matchesTable)
      .values([{
        home_team_id: teams[0].id,
        away_team_id: teams[1].id,
        match_date: new Date('2024-01-15T15:00:00Z'),
        gameweek: 1,
        season: '2024-25'
      }])
      .returning()
      .execute();

    await db.insert(predictionsTable)
      .values([{
        match_id: matches[0].id,
        predicted_outcome: 'home_win',
        confidence_percentage: 75,
        predicted_home_score: 2,
        predicted_away_score: 1,
        reasoning: 'Strong home advantage',
        model_version: 'v1.0'
      }])
      .execute();

    // Query with non-existent match ID
    const result = await getPredictions(99999);
    expect(result).toEqual([]);
  });

  it('should handle predictions with null values correctly', async () => {
    // Create test teams
    const teams = await db.insert(teamsTable)
      .values([
        { name: 'Team A', code: 'TA', logo_url: null },
        { name: 'Team B', code: 'TB', logo_url: null }
      ])
      .returning()
      .execute();

    // Create match
    const matches = await db.insert(matchesTable)
      .values([{
        home_team_id: teams[0].id,
        away_team_id: teams[1].id,
        match_date: new Date('2024-01-15T15:00:00Z'),
        gameweek: 1,
        season: '2024-25'
      }])
      .returning()
      .execute();

    // Create prediction with null values
    const predictions = await db.insert(predictionsTable)
      .values([{
        match_id: matches[0].id,
        predicted_outcome: 'away_win',
        confidence_percentage: 55,
        predicted_home_score: null,
        predicted_away_score: null,
        reasoning: null,
        model_version: 'v2.0'
      }])
      .returning()
      .execute();

    const result = await getPredictions();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: predictions[0].id,
      match_id: matches[0].id,
      predicted_outcome: 'away_win',
      confidence_percentage: 55,
      predicted_home_score: null,
      predicted_away_score: null,
      reasoning: null,
      model_version: 'v2.0',
      created_at: expect.any(Date)
    });
  });

  it('should handle multiple predictions for the same match', async () => {
    // Create test teams
    const teams = await db.insert(teamsTable)
      .values([
        { name: 'Team A', code: 'TA', logo_url: null },
        { name: 'Team B', code: 'TB', logo_url: null }
      ])
      .returning()
      .execute();

    // Create match
    const matches = await db.insert(matchesTable)
      .values([{
        home_team_id: teams[0].id,
        away_team_id: teams[1].id,
        match_date: new Date('2024-01-15T15:00:00Z'),
        gameweek: 1,
        season: '2024-25'
      }])
      .returning()
      .execute();

    // Create multiple predictions for same match
    await db.insert(predictionsTable)
      .values([
        {
          match_id: matches[0].id,
          predicted_outcome: 'home_win',
          confidence_percentage: 75,
          predicted_home_score: 2,
          predicted_away_score: 1,
          reasoning: 'Model v1 prediction',
          model_version: 'v1.0'
        },
        {
          match_id: matches[0].id,
          predicted_outcome: 'draw',
          confidence_percentage: 65,
          predicted_home_score: 1,
          predicted_away_score: 1,
          reasoning: 'Model v2 prediction',
          model_version: 'v2.0'
        }
      ])
      .execute();

    const result = await getPredictions(matches[0].id);

    // Should return both predictions for the match
    expect(result).toHaveLength(2);
    expect(result.every(p => p.match_id === matches[0].id)).toBe(true);
    
    // Verify different model versions
    const modelVersions = result.map(p => p.model_version).sort();
    expect(modelVersions).toEqual(['v1.0', 'v2.0']);
  });
});