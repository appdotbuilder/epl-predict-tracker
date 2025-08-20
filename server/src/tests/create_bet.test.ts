import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, betsTable, predictionsTable, teamsTable, matchesTable } from '../db/schema';
import { type CreateBetInput } from '../schema';
import { createBet } from '../handlers/create_bet';
import { eq } from 'drizzle-orm';

describe('createBet', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper to create prerequisite data
  const setupTestData = async () => {
    // Create teams
    const teams = await db.insert(teamsTable)
      .values([
        { name: 'Manchester United', code: 'MAN', logo_url: null },
        { name: 'Liverpool', code: 'LIV', logo_url: null }
      ])
      .returning()
      .execute();

    // Create match
    const matches = await db.insert(matchesTable)
      .values({
        home_team_id: teams[0].id,
        away_team_id: teams[1].id,
        match_date: new Date('2024-12-01'),
        gameweek: 1,
        season: '2024-25',
        status: 'scheduled'
      })
      .returning()
      .execute();

    // Create user with balance
    const users = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        total_balance: '1000.00'
      })
      .returning()
      .execute();

    // Create prediction
    const predictions = await db.insert(predictionsTable)
      .values({
        match_id: matches[0].id,
        predicted_outcome: 'home_win',
        confidence_percentage: 75,
        predicted_home_score: 2,
        predicted_away_score: 1,
        reasoning: 'Test prediction',
        model_version: 'v1.0'
      })
      .returning()
      .execute();

    return { user: users[0], prediction: predictions[0] };
  };

  const testInput: CreateBetInput = {
    user_id: 1, // Will be updated in tests
    prediction_id: 1, // Will be updated in tests
    amount: 50,
    bet_type: 'outcome',
    bet_value: 'home_win',
    odds: 2.5
  };

  it('should create a bet successfully', async () => {
    const { user, prediction } = await setupTestData();
    
    const input = {
      ...testInput,
      user_id: user.id,
      prediction_id: prediction.id
    };

    const result = await createBet(input);

    // Verify bet creation
    expect(result.user_id).toEqual(user.id);
    expect(result.prediction_id).toEqual(prediction.id);
    expect(result.amount).toEqual(50);
    expect(result.bet_type).toEqual('outcome');
    expect(result.bet_value).toEqual('home_win');
    expect(result.odds).toEqual(2.5);
    expect(result.potential_return).toEqual(125); // 50 * 2.5
    expect(result.status).toEqual('pending');
    expect(result.settled_at).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save bet to database', async () => {
    const { user, prediction } = await setupTestData();
    
    const input = {
      ...testInput,
      user_id: user.id,
      prediction_id: prediction.id
    };

    const result = await createBet(input);

    // Query bet from database
    const bets = await db.select()
      .from(betsTable)
      .where(eq(betsTable.id, result.id))
      .execute();

    expect(bets).toHaveLength(1);
    expect(bets[0].user_id).toEqual(user.id);
    expect(bets[0].prediction_id).toEqual(prediction.id);
    expect(parseFloat(bets[0].amount)).toEqual(50);
    expect(parseFloat(bets[0].odds)).toEqual(2.5);
    expect(parseFloat(bets[0].potential_return)).toEqual(125);
    expect(bets[0].status).toEqual('pending');
  });

  it('should deduct bet amount from user balance', async () => {
    const { user, prediction } = await setupTestData();
    
    const input = {
      ...testInput,
      user_id: user.id,
      prediction_id: prediction.id,
      amount: 100 // Bet 100 from initial 1000 balance
    };

    await createBet(input);

    // Check user's updated balance
    const updatedUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .execute();

    expect(parseFloat(updatedUsers[0].total_balance)).toEqual(900); // 1000 - 100
  });

  it('should calculate potential return correctly', async () => {
    const { user, prediction } = await setupTestData();
    
    const input = {
      ...testInput,
      user_id: user.id,
      prediction_id: prediction.id,
      amount: 75,
      odds: 3.2
    };

    const result = await createBet(input);

    expect(result.potential_return).toEqual(240); // 75 * 3.2
  });

  it('should throw error if user does not exist', async () => {
    const { prediction } = await setupTestData();
    
    const input = {
      ...testInput,
      user_id: 9999, // Non-existent user
      prediction_id: prediction.id
    };

    await expect(createBet(input)).rejects.toThrow(/User with id 9999 not found/);
  });

  it('should throw error if prediction does not exist', async () => {
    const { user } = await setupTestData();
    
    const input = {
      ...testInput,
      user_id: user.id,
      prediction_id: 9999 // Non-existent prediction
    };

    await expect(createBet(input)).rejects.toThrow(/Prediction with id 9999 not found/);
  });

  it('should throw error if user has insufficient balance', async () => {
    const { user, prediction } = await setupTestData();
    
    const input = {
      ...testInput,
      user_id: user.id,
      prediction_id: prediction.id,
      amount: 1500 // More than user's 1000 balance
    };

    await expect(createBet(input)).rejects.toThrow(/Insufficient balance\. Required: 1500, Available: 1000/);
  });

  it('should handle different bet types correctly', async () => {
    const { user, prediction } = await setupTestData();
    
    const input = {
      ...testInput,
      user_id: user.id,
      prediction_id: prediction.id,
      bet_type: 'over_under' as const,
      bet_value: 'over_2.5',
      odds: 1.8
    };

    const result = await createBet(input);

    expect(result.bet_type).toEqual('over_under');
    expect(result.bet_value).toEqual('over_2.5');
    expect(result.odds).toEqual(1.8);
    expect(result.potential_return).toEqual(90); // 50 * 1.8
  });

  it('should handle both_teams_score bet type', async () => {
    const { user, prediction } = await setupTestData();
    
    const input = {
      ...testInput,
      user_id: user.id,
      prediction_id: prediction.id,
      bet_type: 'both_teams_score' as const,
      bet_value: 'yes',
      odds: 1.95
    };

    const result = await createBet(input);

    expect(result.bet_type).toEqual('both_teams_score');
    expect(result.bet_value).toEqual('yes');
    expect(result.odds).toEqual(1.95);
    expect(result.potential_return).toEqual(97.5); // 50 * 1.95
  });

  it('should handle decimal amounts correctly', async () => {
    const { user, prediction } = await setupTestData();
    
    const input = {
      ...testInput,
      user_id: user.id,
      prediction_id: prediction.id,
      amount: 25.75,
      odds: 2.25
    };

    const result = await createBet(input);

    expect(result.amount).toEqual(25.75);
    expect(result.odds).toEqual(2.25);
    expect(result.potential_return).toBeCloseTo(57.9375, 2); // 25.75 * 2.25

    // Verify balance deduction
    const updatedUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .execute();

    expect(parseFloat(updatedUsers[0].total_balance)).toEqual(974.25); // 1000 - 25.75
  });
});