import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, teamsTable, matchesTable, predictionsTable, betsTable } from '../db/schema';
import { type GetUserBetsInput } from '../schema';
import { getUserBets } from '../handlers/get_user_bets';
import { eq } from 'drizzle-orm';

// Test input with all fields
const testInput: GetUserBetsInput = {
  user_id: 1,
  status: undefined,
  limit: 50,
  offset: 0
};

describe('getUserBets', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user bets ordered by created_at descending', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        total_balance: '1000.00'
      })
      .returning()
      .execute();

    const homeTeam = await db.insert(teamsTable)
      .values({
        name: 'Manchester United',
        code: 'MUN',
        logo_url: 'https://example.com/mu.png'
      })
      .returning()
      .execute();

    const awayTeam = await db.insert(teamsTable)
      .values({
        name: 'Liverpool',
        code: 'LIV',
        logo_url: 'https://example.com/liv.png'
      })
      .returning()
      .execute();

    const match = await db.insert(matchesTable)
      .values({
        home_team_id: homeTeam[0].id,
        away_team_id: awayTeam[0].id,
        match_date: new Date('2024-01-15T15:00:00Z'),
        gameweek: 20,
        season: '2023-24',
        status: 'scheduled'
      })
      .returning()
      .execute();

    const prediction = await db.insert(predictionsTable)
      .values({
        match_id: match[0].id,
        predicted_outcome: 'home_win',
        confidence_percentage: 75,
        predicted_home_score: 2,
        predicted_away_score: 1,
        reasoning: 'Home team advantage',
        model_version: 'v1.0'
      })
      .returning()
      .execute();

    // Create bets with different timestamps
    const bet1 = await db.insert(betsTable)
      .values({
        user_id: user[0].id,
        prediction_id: prediction[0].id,
        amount: '50.00',
        bet_type: 'outcome',
        bet_value: 'home_win',
        odds: '2.50',
        potential_return: '125.00',
        status: 'pending'
      })
      .returning()
      .execute();

    // Wait a moment and create second bet
    await new Promise(resolve => setTimeout(resolve, 10));

    const bet2 = await db.insert(betsTable)
      .values({
        user_id: user[0].id,
        prediction_id: prediction[0].id,
        amount: '25.00',
        bet_type: 'outcome',
        bet_value: 'away_win',
        odds: '3.00',
        potential_return: '75.00',
        status: 'won'
      })
      .returning()
      .execute();

    const result = await getUserBets(testInput);

    // Should return 2 bets
    expect(result).toHaveLength(2);

    // Should be ordered by created_at descending (newest first)
    expect(result[0].id).toBe(bet2[0].id);
    expect(result[1].id).toBe(bet1[0].id);
    expect(result[0].created_at >= result[1].created_at).toBe(true);

    // Verify numeric conversions
    expect(typeof result[0].amount).toBe('number');
    expect(typeof result[0].odds).toBe('number');
    expect(typeof result[0].potential_return).toBe('number');
    expect(result[0].amount).toBe(25);
    expect(result[0].odds).toBe(3);
    expect(result[0].potential_return).toBe(75);

    // Verify all fields are present
    expect(result[0].user_id).toBe(user[0].id);
    expect(result[0].prediction_id).toBe(prediction[0].id);
    expect(result[0].bet_type).toBe('outcome');
    expect(result[0].bet_value).toBe('away_win');
    expect(result[0].status).toBe('won');
  });

  it('should filter by status when provided', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        total_balance: '1000.00'
      })
      .returning()
      .execute();

    const homeTeam = await db.insert(teamsTable)
      .values({
        name: 'Arsenal',
        code: 'ARS',
        logo_url: null
      })
      .returning()
      .execute();

    const awayTeam = await db.insert(teamsTable)
      .values({
        name: 'Chelsea',
        code: 'CHE',
        logo_url: null
      })
      .returning()
      .execute();

    const match = await db.insert(matchesTable)
      .values({
        home_team_id: homeTeam[0].id,
        away_team_id: awayTeam[0].id,
        match_date: new Date('2024-01-20T15:00:00Z'),
        gameweek: 21,
        season: '2023-24',
        status: 'scheduled'
      })
      .returning()
      .execute();

    const prediction = await db.insert(predictionsTable)
      .values({
        match_id: match[0].id,
        predicted_outcome: 'draw',
        confidence_percentage: 60,
        predicted_home_score: null,
        predicted_away_score: null,
        reasoning: null,
        model_version: 'v1.1'
      })
      .returning()
      .execute();

    // Create bets with different statuses
    await db.insert(betsTable)
      .values([
        {
          user_id: user[0].id,
          prediction_id: prediction[0].id,
          amount: '30.00',
          bet_type: 'outcome',
          bet_value: 'draw',
          odds: '3.20',
          potential_return: '96.00',
          status: 'pending'
        },
        {
          user_id: user[0].id,
          prediction_id: prediction[0].id,
          amount: '40.00',
          bet_type: 'outcome',
          bet_value: 'home_win',
          odds: '2.10',
          potential_return: '84.00',
          status: 'won'
        },
        {
          user_id: user[0].id,
          prediction_id: prediction[0].id,
          amount: '20.00',
          bet_type: 'outcome',
          bet_value: 'away_win',
          odds: '4.00',
          potential_return: '80.00',
          status: 'lost'
        }
      ])
      .execute();

    // Filter by pending status
    const pendingBets = await getUserBets({
      ...testInput,
      status: 'pending'
    });

    expect(pendingBets).toHaveLength(1);
    expect(pendingBets[0].status).toBe('pending');
    expect(pendingBets[0].amount).toBe(30);

    // Filter by won status
    const wonBets = await getUserBets({
      ...testInput,
      status: 'won'
    });

    expect(wonBets).toHaveLength(1);
    expect(wonBets[0].status).toBe('won');
    expect(wonBets[0].amount).toBe(40);
  });

  it('should handle pagination correctly', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        total_balance: '1000.00'
      })
      .returning()
      .execute();

    const homeTeam = await db.insert(teamsTable)
      .values({
        name: 'Tottenham',
        code: 'TOT',
        logo_url: null
      })
      .returning()
      .execute();

    const awayTeam = await db.insert(teamsTable)
      .values({
        name: 'West Ham',
        code: 'WHU',
        logo_url: null
      })
      .returning()
      .execute();

    const match = await db.insert(matchesTable)
      .values({
        home_team_id: homeTeam[0].id,
        away_team_id: awayTeam[0].id,
        match_date: new Date('2024-01-25T15:00:00Z'),
        gameweek: 22,
        season: '2023-24',
        status: 'scheduled'
      })
      .returning()
      .execute();

    const prediction = await db.insert(predictionsTable)
      .values({
        match_id: match[0].id,
        predicted_outcome: 'home_win',
        confidence_percentage: 80,
        predicted_home_score: 3,
        predicted_away_score: 1,
        reasoning: 'Strong home form',
        model_version: 'v1.2'
      })
      .returning()
      .execute();

    // Create 5 bets
    const betData = Array.from({ length: 5 }, (_, i) => ({
      user_id: user[0].id,
      prediction_id: prediction[0].id,
      amount: `${10 + i * 5}.00`,
      bet_type: 'outcome' as const,
      bet_value: 'home_win',
      odds: `${2.0 + i * 0.1}`,
      potential_return: `${20 + i * 10}.00`,
      status: 'pending' as const
    }));

    await db.insert(betsTable)
      .values(betData)
      .execute();

    // Test first page (limit 2)
    const firstPage = await getUserBets({
      ...testInput,
      limit: 2,
      offset: 0
    });

    expect(firstPage).toHaveLength(2);

    // Test second page (limit 2, offset 2)
    const secondPage = await getUserBets({
      ...testInput,
      limit: 2,
      offset: 2
    });

    expect(secondPage).toHaveLength(2);

    // Ensure no overlap between pages
    const firstPageIds = firstPage.map(bet => bet.id);
    const secondPageIds = secondPage.map(bet => bet.id);
    expect(firstPageIds.every(id => !secondPageIds.includes(id))).toBe(true);
  });

  it('should return empty array for user with no bets', async () => {
    // Create user but no bets
    const user = await db.insert(usersTable)
      .values({
        username: 'nobets',
        email: 'nobets@example.com',
        total_balance: '500.00'
      })
      .returning()
      .execute();

    const result = await getUserBets({
      ...testInput,
      user_id: user[0].id
    });

    expect(result).toHaveLength(0);
  });

  it('should return empty array for non-existent user', async () => {
    const result = await getUserBets({
      ...testInput,
      user_id: 999
    });

    expect(result).toHaveLength(0);
  });

  it('should save bets to database correctly', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable)
      .values({
        username: 'dbtest',
        email: 'dbtest@example.com',
        total_balance: '2000.00'
      })
      .returning()
      .execute();

    const homeTeam = await db.insert(teamsTable)
      .values({
        name: 'Newcastle',
        code: 'NEW',
        logo_url: null
      })
      .returning()
      .execute();

    const awayTeam = await db.insert(teamsTable)
      .values({
        name: 'Brighton',
        code: 'BHA',
        logo_url: null
      })
      .returning()
      .execute();

    const match = await db.insert(matchesTable)
      .values({
        home_team_id: homeTeam[0].id,
        away_team_id: awayTeam[0].id,
        match_date: new Date('2024-02-01T15:00:00Z'),
        gameweek: 23,
        season: '2023-24',
        status: 'scheduled'
      })
      .returning()
      .execute();

    const prediction = await db.insert(predictionsTable)
      .values({
        match_id: match[0].id,
        predicted_outcome: 'away_win',
        confidence_percentage: 65,
        predicted_home_score: 1,
        predicted_away_score: 2,
        reasoning: 'Away team in good form',
        model_version: 'v2.0'
      })
      .returning()
      .execute();

    const insertedBet = await db.insert(betsTable)
      .values({
        user_id: user[0].id,
        prediction_id: prediction[0].id,
        amount: '100.00',
        bet_type: 'outcome',
        bet_value: 'away_win',
        odds: '3.50',
        potential_return: '350.00',
        status: 'pending'
      })
      .returning()
      .execute();

    const result = await getUserBets({
      ...testInput,
      user_id: user[0].id
    });

    expect(result).toHaveLength(1);

    // Verify data matches what's in database
    const dbBet = await db.select()
      .from(betsTable)
      .where(eq(betsTable.id, insertedBet[0].id))
      .execute();

    expect(dbBet).toHaveLength(1);
    expect(result[0].id).toBe(dbBet[0].id);
    expect(result[0].user_id).toBe(dbBet[0].user_id);
    expect(result[0].prediction_id).toBe(dbBet[0].prediction_id);
    expect(parseFloat(dbBet[0].amount)).toBe(100);
    expect(parseFloat(dbBet[0].odds)).toBe(3.50);
    expect(parseFloat(dbBet[0].potential_return)).toBe(350);
  });
});