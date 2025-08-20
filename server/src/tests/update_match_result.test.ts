import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  teamsTable, 
  matchesTable, 
  usersTable, 
  predictionsTable, 
  betsTable 
} from '../db/schema';
import { type UpdateMatchResultInput } from '../schema';
import { updateMatchResult } from '../handlers/update_match_result';
import { eq, and } from 'drizzle-orm';

describe('updateMatchResult', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let homeTeamId: number;
  let awayTeamId: number;
  let matchId: number;
  let userId: number;
  let predictionId: number;

  const setupTestData = async () => {
    // Create teams
    const teams = await db.insert(teamsTable)
      .values([
        { name: 'Home Team', code: 'HOM', logo_url: null },
        { name: 'Away Team', code: 'AWY', logo_url: null }
      ])
      .returning()
      .execute();
    
    homeTeamId = teams[0].id;
    awayTeamId = teams[1].id;

    // Create match
    const matches = await db.insert(matchesTable)
      .values({
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        match_date: new Date('2024-01-15'),
        home_score: null,
        away_score: null,
        status: 'scheduled',
        gameweek: 20,
        season: '2023-24'
      })
      .returning()
      .execute();
    
    matchId = matches[0].id;

    // Create user
    const users = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        total_balance: '1000.00'
      })
      .returning()
      .execute();
    
    userId = users[0].id;

    // Create prediction
    const predictions = await db.insert(predictionsTable)
      .values({
        match_id: matchId,
        predicted_outcome: 'home_win',
        confidence_percentage: 75,
        predicted_home_score: 2,
        predicted_away_score: 1,
        reasoning: 'Home team has better form',
        model_version: 'v1.0'
      })
      .returning()
      .execute();
    
    predictionId = predictions[0].id;
  };

  const testInput: UpdateMatchResultInput = {
    id: 0, // Will be set in tests
    home_score: 2,
    away_score: 1,
    status: 'completed'
  };

  it('should update match result successfully', async () => {
    await setupTestData();
    
    const input = { ...testInput, id: matchId };
    const result = await updateMatchResult(input);

    expect(result.id).toEqual(matchId);
    expect(result.home_score).toEqual(2);
    expect(result.away_score).toEqual(1);
    expect(result.status).toEqual('completed');
    expect(result.home_team_id).toEqual(homeTeamId);
    expect(result.away_team_id).toEqual(awayTeamId);
  });

  it('should save updated match to database', async () => {
    await setupTestData();
    
    const input = { ...testInput, id: matchId };
    await updateMatchResult(input);

    const matches = await db.select()
      .from(matchesTable)
      .where(eq(matchesTable.id, matchId))
      .execute();

    expect(matches).toHaveLength(1);
    expect(matches[0].home_score).toEqual(2);
    expect(matches[0].away_score).toEqual(1);
    expect(matches[0].status).toEqual('completed');
  });

  it('should settle winning bets correctly', async () => {
    await setupTestData();

    // Create a bet that should win (home_win prediction, home team wins 2-1)
    await db.insert(betsTable)
      .values({
        user_id: userId,
        prediction_id: predictionId,
        amount: '50.00',
        bet_type: 'outcome',
        bet_value: 'home_win',
        odds: '2.00',
        potential_return: '100.00',
        status: 'pending'
      })
      .execute();

    const input = { ...testInput, id: matchId };
    await updateMatchResult(input);

    // Check that bet was marked as won
    const bets = await db.select()
      .from(betsTable)
      .where(eq(betsTable.user_id, userId))
      .execute();

    expect(bets).toHaveLength(1);
    expect(bets[0].status).toEqual('won');
    expect(bets[0].settled_at).toBeInstanceOf(Date);
  });

  it('should settle losing bets correctly', async () => {
    await setupTestData();

    // Create prediction for away win
    const awayWinPrediction = await db.insert(predictionsTable)
      .values({
        match_id: matchId,
        predicted_outcome: 'away_win',
        confidence_percentage: 60,
        predicted_home_score: 0,
        predicted_away_score: 2,
        reasoning: 'Away team has key players back',
        model_version: 'v1.0'
      })
      .returning()
      .execute();

    // Create a bet that should lose (away_win prediction, home team wins 2-1)
    await db.insert(betsTable)
      .values({
        user_id: userId,
        prediction_id: awayWinPrediction[0].id,
        amount: '25.00',
        bet_type: 'outcome',
        bet_value: 'away_win',
        odds: '3.00',
        potential_return: '75.00',
        status: 'pending'
      })
      .execute();

    const input = { ...testInput, id: matchId };
    await updateMatchResult(input);

    // Check that bet was marked as lost
    const bets = await db.select()
      .from(betsTable)
      .where(eq(betsTable.prediction_id, awayWinPrediction[0].id))
      .execute();

    expect(bets).toHaveLength(1);
    expect(bets[0].status).toEqual('lost');
    expect(bets[0].settled_at).toBeInstanceOf(Date);
  });

  it('should handle draw results correctly', async () => {
    await setupTestData();

    // Create prediction for draw
    const drawPrediction = await db.insert(predictionsTable)
      .values({
        match_id: matchId,
        predicted_outcome: 'draw',
        confidence_percentage: 40,
        predicted_home_score: 1,
        predicted_away_score: 1,
        reasoning: 'Both teams are evenly matched',
        model_version: 'v1.0'
      })
      .returning()
      .execute();

    // Create a bet on draw
    await db.insert(betsTable)
      .values({
        user_id: userId,
        prediction_id: drawPrediction[0].id,
        amount: '30.00',
        bet_type: 'outcome',
        bet_value: 'draw',
        odds: '3.50',
        potential_return: '105.00',
        status: 'pending'
      })
      .execute();

    // Update match with draw result
    const drawInput = { id: matchId, home_score: 1, away_score: 1, status: 'completed' as const };
    await updateMatchResult(drawInput);

    // Check that bet was marked as won
    const bets = await db.select()
      .from(betsTable)
      .where(eq(betsTable.prediction_id, drawPrediction[0].id))
      .execute();

    expect(bets).toHaveLength(1);
    expect(bets[0].status).toEqual('won');
  });

  it('should handle multiple bets on same match', async () => {
    await setupTestData();

    // Create additional prediction and bets
    const drawPrediction = await db.insert(predictionsTable)
      .values({
        match_id: matchId,
        predicted_outcome: 'draw',
        confidence_percentage: 30,
        predicted_home_score: 1,
        predicted_away_score: 1,
        reasoning: 'Defensive match expected',
        model_version: 'v1.0'
      })
      .returning()
      .execute();

    // Create multiple bets - one winning, one losing
    await db.insert(betsTable)
      .values([
        {
          user_id: userId,
          prediction_id: predictionId, // home_win prediction
          amount: '40.00',
          bet_type: 'outcome',
          bet_value: 'home_win',
          odds: '1.80',
          potential_return: '72.00',
          status: 'pending'
        },
        {
          user_id: userId,
          prediction_id: drawPrediction[0].id, // draw prediction
          amount: '20.00',
          bet_type: 'outcome',
          bet_value: 'draw',
          odds: '3.20',
          potential_return: '64.00',
          status: 'pending'
        }
      ])
      .execute();

    const input = { ...testInput, id: matchId };
    await updateMatchResult(input);

    // Check all bets were settled
    const bets = await db.select()
      .from(betsTable)
      .where(eq(betsTable.user_id, userId))
      .execute();

    expect(bets).toHaveLength(2);
    
    // Winning bet (home_win)
    const winningBet = bets.find(bet => bet.prediction_id === predictionId);
    expect(winningBet?.status).toEqual('won');
    expect(winningBet?.settled_at).toBeInstanceOf(Date);

    // Losing bet (draw)
    const losingBet = bets.find(bet => bet.prediction_id === drawPrediction[0].id);
    expect(losingBet?.status).toEqual('lost');
    expect(losingBet?.settled_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent match', async () => {
    const input = { ...testInput, id: 99999 };
    
    await expect(updateMatchResult(input)).rejects.toThrow(/Match with id 99999 not found/i);
  });

  it('should only settle pending bets', async () => {
    await setupTestData();

    // Create a bet that's already settled
    await db.insert(betsTable)
      .values({
        user_id: userId,
        prediction_id: predictionId,
        amount: '50.00',
        bet_type: 'outcome',
        bet_value: 'home_win',
        odds: '2.00',
        potential_return: '100.00',
        status: 'won', // Already settled
        settled_at: new Date('2024-01-10')
      })
      .execute();

    const originalSettledAt = new Date('2024-01-10');

    const input = { ...testInput, id: matchId };
    await updateMatchResult(input);

    // Check that already settled bet wasn't changed
    const bets = await db.select()
      .from(betsTable)
      .where(eq(betsTable.user_id, userId))
      .execute();

    expect(bets).toHaveLength(1);
    expect(bets[0].status).toEqual('won');
    expect(bets[0].settled_at?.getTime()).toEqual(originalSettledAt.getTime());
  });
});