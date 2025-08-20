import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { teamsTable, matchesTable, predictionsTable, usersTable, betsTable } from '../db/schema';
import { settleBets } from '../handlers/settle_bets';
import { eq } from 'drizzle-orm';

describe('settleBets', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should settle bets for a completed match with home team win', async () => {
    // Create teams
    const homeTeam = await db.insert(teamsTable)
      .values({ name: 'Manchester United', code: 'MAN', logo_url: null })
      .returning()
      .execute();

    const awayTeam = await db.insert(teamsTable)
      .values({ name: 'Liverpool', code: 'LIV', logo_url: null })
      .returning()
      .execute();

    // Create completed match (home team wins 2-1)
    const match = await db.insert(matchesTable)
      .values({
        home_team_id: homeTeam[0].id,
        away_team_id: awayTeam[0].id,
        match_date: new Date(),
        home_score: 2,
        away_score: 1,
        status: 'completed',
        gameweek: 10,
        season: '2024-25'
      })
      .returning()
      .execute();

    // Create predictions
    const correctPrediction = await db.insert(predictionsTable)
      .values({
        match_id: match[0].id,
        predicted_outcome: 'home_win',
        confidence_percentage: 75,
        predicted_home_score: 2,
        predicted_away_score: 1,
        reasoning: 'Home advantage',
        model_version: 'v1.0'
      })
      .returning()
      .execute();

    const incorrectPrediction = await db.insert(predictionsTable)
      .values({
        match_id: match[0].id,
        predicted_outcome: 'away_win',
        confidence_percentage: 60,
        predicted_home_score: 1,
        predicted_away_score: 2,
        reasoning: 'Away form',
        model_version: 'v1.0'
      })
      .returning()
      .execute();

    // Create users
    const user1 = await db.insert(usersTable)
      .values({
        username: 'bettor1',
        email: 'bettor1@example.com',
        total_balance: '1000.00'
      })
      .returning()
      .execute();

    const user2 = await db.insert(usersTable)
      .values({
        username: 'bettor2',
        email: 'bettor2@example.com',
        total_balance: '1000.00'
      })
      .returning()
      .execute();

    // Create bets
    const winningBet = await db.insert(betsTable)
      .values({
        user_id: user1[0].id,
        prediction_id: correctPrediction[0].id,
        amount: '100.00',
        bet_type: 'outcome',
        bet_value: 'home_win',
        odds: '2.50',
        potential_return: '250.00',
        status: 'pending'
      })
      .returning()
      .execute();

    const losingBet = await db.insert(betsTable)
      .values({
        user_id: user2[0].id,
        prediction_id: incorrectPrediction[0].id,
        amount: '50.00',
        bet_type: 'outcome',
        bet_value: 'away_win',
        odds: '3.00',
        potential_return: '150.00',
        status: 'pending'
      })
      .returning()
      .execute();

    // Settle bets
    const settledBets = await settleBets(match[0].id);

    // Should return both settled bets
    expect(settledBets).toHaveLength(2);

    // Check winning bet
    const settledWinningBet = settledBets.find(bet => bet.id === winningBet[0].id);
    expect(settledWinningBet).toBeDefined();
    expect(settledWinningBet!.status).toEqual('won');
    expect(settledWinningBet!.settled_at).toBeInstanceOf(Date);
    expect(settledWinningBet!.amount).toEqual(100);
    expect(settledWinningBet!.potential_return).toEqual(250);

    // Check losing bet
    const settledLosingBet = settledBets.find(bet => bet.id === losingBet[0].id);
    expect(settledLosingBet).toBeDefined();
    expect(settledLosingBet!.status).toEqual('lost');
    expect(settledLosingBet!.settled_at).toBeInstanceOf(Date);

    // Verify bets are updated in database
    const updatedWinningBet = await db.select()
      .from(betsTable)
      .where(eq(betsTable.id, winningBet[0].id))
      .execute();
    expect(updatedWinningBet[0].status).toEqual('won');

    const updatedLosingBet = await db.select()
      .from(betsTable)
      .where(eq(betsTable.id, losingBet[0].id))
      .execute();
    expect(updatedLosingBet[0].status).toEqual('lost');

    // Verify user balances are updated
    const updatedUser1 = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, user1[0].id))
      .execute();
    expect(parseFloat(updatedUser1[0].total_balance)).toEqual(1250); // 1000 + 250 winnings

    const updatedUser2 = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, user2[0].id))
      .execute();
    expect(parseFloat(updatedUser2[0].total_balance)).toEqual(1000); // No change for losing bet
  });

  it('should handle draw outcomes correctly', async () => {
    // Create teams
    const homeTeam = await db.insert(teamsTable)
      .values({ name: 'Arsenal', code: 'ARS', logo_url: null })
      .returning()
      .execute();

    const awayTeam = await db.insert(teamsTable)
      .values({ name: 'Chelsea', code: 'CHE', logo_url: null })
      .returning()
      .execute();

    // Create completed match (draw 1-1)
    const match = await db.insert(matchesTable)
      .values({
        home_team_id: homeTeam[0].id,
        away_team_id: awayTeam[0].id,
        match_date: new Date(),
        home_score: 1,
        away_score: 1,
        status: 'completed',
        gameweek: 15,
        season: '2024-25'
      })
      .returning()
      .execute();

    // Create prediction for draw
    const drawPrediction = await db.insert(predictionsTable)
      .values({
        match_id: match[0].id,
        predicted_outcome: 'draw',
        confidence_percentage: 65,
        predicted_home_score: 1,
        predicted_away_score: 1,
        reasoning: 'Even teams',
        model_version: 'v1.0'
      })
      .returning()
      .execute();

    // Create user
    const user = await db.insert(usersTable)
      .values({
        username: 'drawbettor',
        email: 'drawbettor@example.com',
        total_balance: '500.00'
      })
      .returning()
      .execute();

    // Create winning draw bet
    await db.insert(betsTable)
      .values({
        user_id: user[0].id,
        prediction_id: drawPrediction[0].id,
        amount: '50.00',
        bet_type: 'outcome',
        bet_value: 'draw',
        odds: '3.20',
        potential_return: '160.00',
        status: 'pending'
      })
      .returning()
      .execute();

    // Settle bets
    const settledBets = await settleBets(match[0].id);

    expect(settledBets).toHaveLength(1);
    expect(settledBets[0].status).toEqual('won');

    // Verify user balance updated
    const updatedUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, user[0].id))
      .execute();
    expect(parseFloat(updatedUser[0].total_balance)).toEqual(660); // 500 + 160 winnings
  });

  it('should return empty array when no pending bets exist', async () => {
    // Create teams
    const homeTeam = await db.insert(teamsTable)
      .values({ name: 'Tottenham', code: 'TOT', logo_url: null })
      .returning()
      .execute();

    const awayTeam = await db.insert(teamsTable)
      .values({ name: 'West Ham', code: 'WHU', logo_url: null })
      .returning()
      .execute();

    // Create completed match
    const match = await db.insert(matchesTable)
      .values({
        home_team_id: homeTeam[0].id,
        away_team_id: awayTeam[0].id,
        match_date: new Date(),
        home_score: 3,
        away_score: 0,
        status: 'completed',
        gameweek: 20,
        season: '2024-25'
      })
      .returning()
      .execute();

    // Settle bets (no pending bets exist)
    const settledBets = await settleBets(match[0].id);

    expect(settledBets).toHaveLength(0);
  });

  it('should throw error for non-existent match', async () => {
    await expect(settleBets(99999)).rejects.toThrow(/match not found/i);
  });

  it('should throw error for incomplete match', async () => {
    // Create teams
    const homeTeam = await db.insert(teamsTable)
      .values({ name: 'Brighton', code: 'BRI', logo_url: null })
      .returning()
      .execute();

    const awayTeam = await db.insert(teamsTable)
      .values({ name: 'Newcastle', code: 'NEW', logo_url: null })
      .returning()
      .execute();

    // Create scheduled match (not completed)
    const match = await db.insert(matchesTable)
      .values({
        home_team_id: homeTeam[0].id,
        away_team_id: awayTeam[0].id,
        match_date: new Date(),
        home_score: null,
        away_score: null,
        status: 'scheduled',
        gameweek: 25,
        season: '2024-25'
      })
      .returning()
      .execute();

    await expect(settleBets(match[0].id)).rejects.toThrow(/not completed or scores are missing/i);
  });

  it('should handle multiple users with multiple winning bets', async () => {
    // Create teams
    const homeTeam = await db.insert(teamsTable)
      .values({ name: 'Manchester City', code: 'MCI', logo_url: null })
      .returning()
      .execute();

    const awayTeam = await db.insert(teamsTable)
      .values({ name: 'Aston Villa', code: 'AVL', logo_url: null })
      .returning()
      .execute();

    // Create completed match (away team wins 0-2)
    const match = await db.insert(matchesTable)
      .values({
        home_team_id: homeTeam[0].id,
        away_team_id: awayTeam[0].id,
        match_date: new Date(),
        home_score: 0,
        away_score: 2,
        status: 'completed',
        gameweek: 30,
        season: '2024-25'
      })
      .returning()
      .execute();

    // Create correct prediction
    const correctPrediction = await db.insert(predictionsTable)
      .values({
        match_id: match[0].id,
        predicted_outcome: 'away_win',
        confidence_percentage: 80,
        predicted_home_score: 0,
        predicted_away_score: 2,
        reasoning: 'Away team in form',
        model_version: 'v1.0'
      })
      .returning()
      .execute();

    // Create multiple users
    const user1 = await db.insert(usersTable)
      .values({
        username: 'winner1',
        email: 'winner1@example.com',
        total_balance: '800.00'
      })
      .returning()
      .execute();

    const user2 = await db.insert(usersTable)
      .values({
        username: 'winner2',
        email: 'winner2@example.com',
        total_balance: '1200.00'
      })
      .returning()
      .execute();

    // Create multiple winning bets from same prediction
    await db.insert(betsTable)
      .values({
        user_id: user1[0].id,
        prediction_id: correctPrediction[0].id,
        amount: '75.00',
        bet_type: 'outcome',
        bet_value: 'away_win',
        odds: '4.00',
        potential_return: '300.00',
        status: 'pending'
      })
      .returning()
      .execute();

    await db.insert(betsTable)
      .values({
        user_id: user2[0].id,
        prediction_id: correctPrediction[0].id,
        amount: '25.00',
        bet_type: 'outcome',
        bet_value: 'away_win',
        odds: '4.00',
        potential_return: '100.00',
        status: 'pending'
      })
      .returning()
      .execute();

    // Settle bets
    const settledBets = await settleBets(match[0].id);

    expect(settledBets).toHaveLength(2);
    expect(settledBets.every(bet => bet.status === 'won')).toBe(true);

    // Verify both user balances updated correctly
    const updatedUser1 = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, user1[0].id))
      .execute();
    expect(parseFloat(updatedUser1[0].total_balance)).toEqual(1100); // 800 + 300

    const updatedUser2 = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, user2[0].id))
      .execute();
    expect(parseFloat(updatedUser2[0].total_balance)).toEqual(1300); // 1200 + 100
  });
});