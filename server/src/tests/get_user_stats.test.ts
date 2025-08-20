import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, betsTable, predictionsTable, matchesTable, teamsTable } from '../db/schema';
import { getUserStats } from '../handlers/get_user_stats';

describe('getUserStats', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null for non-existent user', async () => {
    const result = await getUserStats(999);
    expect(result).toBeNull();
  });

  it('should return stats for user with no bets', async () => {
    // Create a user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        total_balance: '500.00'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;
    const result = await getUserStats(userId);

    expect(result).not.toBeNull();
    expect(result!.user.id).toBe(userId);
    expect(result!.user.username).toBe('testuser');
    expect(result!.user.total_balance).toBe(500);
    expect(result!.totalBets).toBe(0);
    expect(result!.wonBets).toBe(0);
    expect(result!.lostBets).toBe(0);
    expect(result!.pendingBets).toBe(0);
    expect(result!.winRate).toBe(0);
    expect(result!.totalWinnings).toBe(0);
    expect(result!.totalLosses).toBe(0);
    expect(result!.netProfit).toBe(0);
  });

  it('should calculate comprehensive stats for user with various bets', async () => {
    // Create prerequisite data: teams, match, prediction
    const teamResults = await db.insert(teamsTable)
      .values([
        { name: 'Team A', code: 'TMA', logo_url: null },
        { name: 'Team B', code: 'TMB', logo_url: null }
      ])
      .returning()
      .execute();

    const matchResult = await db.insert(matchesTable)
      .values({
        home_team_id: teamResults[0].id,
        away_team_id: teamResults[1].id,
        match_date: new Date(),
        gameweek: 1,
        season: '2024-25'
      })
      .returning()
      .execute();

    const predictionResult = await db.insert(predictionsTable)
      .values({
        match_id: matchResult[0].id,
        predicted_outcome: 'home_win',
        confidence_percentage: 75,
        model_version: 'v1.0',
        predicted_home_score: 2,
        predicted_away_score: 1,
        reasoning: 'Test reasoning'
      })
      .returning()
      .execute();

    // Create a user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        total_balance: '1000.00'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;
    const predictionId = predictionResult[0].id;

    // Create various bets with different statuses
    await db.insert(betsTable)
      .values([
        {
          user_id: userId,
          prediction_id: predictionId,
          amount: '50.00',
          bet_type: 'outcome',
          bet_value: 'home_win',
          odds: '2.00',
          potential_return: '100.00',
          status: 'won'
        },
        {
          user_id: userId,
          prediction_id: predictionId,
          amount: '30.00',
          bet_type: 'outcome',
          bet_value: 'away_win',
          odds: '3.00',
          potential_return: '90.00',
          status: 'lost'
        },
        {
          user_id: userId,
          prediction_id: predictionId,
          amount: '20.00',
          bet_type: 'over_under',
          bet_value: 'over_2.5',
          odds: '1.80',
          potential_return: '36.00',
          status: 'won'
        },
        {
          user_id: userId,
          prediction_id: predictionId,
          amount: '40.00',
          bet_type: 'outcome',
          bet_value: 'draw',
          odds: '3.50',
          potential_return: '140.00',
          status: 'pending'
        },
        {
          user_id: userId,
          prediction_id: predictionId,
          amount: '25.00',
          bet_type: 'both_teams_score',
          bet_value: 'yes',
          odds: '2.20',
          potential_return: '55.00',
          status: 'lost'
        }
      ])
      .execute();

    const result = await getUserStats(userId);

    expect(result).not.toBeNull();
    expect(result!.user.id).toBe(userId);
    expect(result!.totalBets).toBe(5);
    expect(result!.wonBets).toBe(2);
    expect(result!.lostBets).toBe(2);
    expect(result!.pendingBets).toBe(1);

    // Win rate should be 2 won / 4 settled bets = 50%
    expect(result!.winRate).toBe(50);

    // Total winnings: (100-50) + (36-20) = 50 + 16 = 66
    expect(result!.totalWinnings).toBe(66);

    // Total losses: 30 + 25 = 55
    expect(result!.totalLosses).toBe(55);

    // Net profit: 66 - 55 = 11
    expect(result!.netProfit).toBe(11);
  });

  it('should handle edge cases correctly', async () => {
    // Create user and bet data for edge cases
    const teamResults = await db.insert(teamsTable)
      .values([
        { name: 'Team A', code: 'TMA', logo_url: null },
        { name: 'Team B', code: 'TMB', logo_url: null }
      ])
      .returning()
      .execute();

    const matchResult = await db.insert(matchesTable)
      .values({
        home_team_id: teamResults[0].id,
        away_team_id: teamResults[1].id,
        match_date: new Date(),
        gameweek: 1,
        season: '2024-25'
      })
      .returning()
      .execute();

    const predictionResult = await db.insert(predictionsTable)
      .values({
        match_id: matchResult[0].id,
        predicted_outcome: 'home_win',
        confidence_percentage: 80,
        model_version: 'v1.0',
        predicted_home_score: null,
        predicted_away_score: null,
        reasoning: null
      })
      .returning()
      .execute();

    const userResult = await db.insert(usersTable)
      .values({
        username: 'edgeuser',
        email: 'edge@example.com',
        total_balance: '100.00'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create bets with only pending status (no settled bets)
    await db.insert(betsTable)
      .values([
        {
          user_id: userId,
          prediction_id: predictionResult[0].id,
          amount: '10.00',
          bet_type: 'outcome',
          bet_value: 'home_win',
          odds: '2.00',
          potential_return: '20.00',
          status: 'pending'
        },
        {
          user_id: userId,
          prediction_id: predictionResult[0].id,
          amount: '15.00',
          bet_type: 'outcome',
          bet_value: 'draw',
          odds: '3.00',
          potential_return: '45.00',
          status: 'pending'
        }
      ])
      .execute();

    const result = await getUserStats(userId);

    expect(result).not.toBeNull();
    expect(result!.totalBets).toBe(2);
    expect(result!.wonBets).toBe(0);
    expect(result!.lostBets).toBe(0);
    expect(result!.pendingBets).toBe(2);
    expect(result!.winRate).toBe(0); // No settled bets
    expect(result!.totalWinnings).toBe(0);
    expect(result!.totalLosses).toBe(0);
    expect(result!.netProfit).toBe(0);
  });

  it('should calculate accurate win rate with decimal precision', async () => {
    // Setup prerequisite data
    const teamResults = await db.insert(teamsTable)
      .values([
        { name: 'Team A', code: 'TMA', logo_url: null },
        { name: 'Team B', code: 'TMB', logo_url: null }
      ])
      .returning()
      .execute();

    const matchResult = await db.insert(matchesTable)
      .values({
        home_team_id: teamResults[0].id,
        away_team_id: teamResults[1].id,
        match_date: new Date(),
        gameweek: 1,
        season: '2024-25'
      })
      .returning()
      .execute();

    const predictionResult = await db.insert(predictionsTable)
      .values({
        match_id: matchResult[0].id,
        predicted_outcome: 'home_win',
        confidence_percentage: 65,
        model_version: 'v1.0',
        predicted_home_score: 1,
        predicted_away_score: 0,
        reasoning: 'Statistical analysis'
      })
      .returning()
      .execute();

    const userResult = await db.insert(usersTable)
      .values({
        username: 'precisionuser',
        email: 'precision@example.com',
        total_balance: '750.00'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create 3 bets: 2 won, 1 lost (66.67% win rate)
    await db.insert(betsTable)
      .values([
        {
          user_id: userId,
          prediction_id: predictionResult[0].id,
          amount: '10.00',
          bet_type: 'outcome',
          bet_value: 'home_win',
          odds: '2.00',
          potential_return: '20.00',
          status: 'won'
        },
        {
          user_id: userId,
          prediction_id: predictionResult[0].id,
          amount: '10.00',
          bet_type: 'outcome',
          bet_value: 'home_win',
          odds: '2.00',
          potential_return: '20.00',
          status: 'won'
        },
        {
          user_id: userId,
          prediction_id: predictionResult[0].id,
          amount: '10.00',
          bet_type: 'outcome',
          bet_value: 'away_win',
          odds: '3.00',
          potential_return: '30.00',
          status: 'lost'
        }
      ])
      .execute();

    const result = await getUserStats(userId);

    expect(result).not.toBeNull();
    expect(result!.totalBets).toBe(3);
    expect(result!.wonBets).toBe(2);
    expect(result!.lostBets).toBe(1);
    
    // 2/3 = 66.666...% rounded to 66.67%
    expect(result!.winRate).toBe(66.67);
    
    // Total winnings: 2 * (20-10) = 20
    expect(result!.totalWinnings).toBe(20);
    
    // Total losses: 10
    expect(result!.totalLosses).toBe(10);
    
    // Net profit: 20 - 10 = 10
    expect(result!.netProfit).toBe(10);
  });
});