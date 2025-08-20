import { db } from '../db';
import { betsTable, matchesTable, predictionsTable, usersTable } from '../db/schema';
import { type Bet } from '../schema';
import { eq, and, sql } from 'drizzle-orm';

export const settleBets = async (matchId: number): Promise<Bet[]> => {
  try {
    // Get the completed match to verify it has scores
    const matches = await db.select()
      .from(matchesTable)
      .where(eq(matchesTable.id, matchId))
      .execute();

    if (matches.length === 0) {
      throw new Error('Match not found');
    }

    const match = matches[0];
    
    // Ensure match is completed and has scores
    if (match.status !== 'completed' || match.home_score === null || match.away_score === null) {
      throw new Error('Match is not completed or scores are missing');
    }

    // Determine actual match outcome
    const actualOutcome = match.home_score > match.away_score ? 'home_win' :
                         match.away_score > match.home_score ? 'away_win' : 'draw';

    // Get all pending bets for this match with their predictions
    const betResults = await db.select({
      bet_id: betsTable.id,
      bet_user_id: betsTable.user_id,
      bet_amount: betsTable.amount,
      bet_type: betsTable.bet_type,
      bet_value: betsTable.bet_value,
      bet_odds: betsTable.odds,
      bet_potential_return: betsTable.potential_return,
      prediction_outcome: predictionsTable.predicted_outcome
    })
    .from(betsTable)
    .innerJoin(predictionsTable, eq(betsTable.prediction_id, predictionsTable.id))
    .where(and(
      eq(predictionsTable.match_id, matchId),
      eq(betsTable.status, 'pending')
    ))
    .execute();

    if (betResults.length === 0) {
      return [];
    }

    const settledBets: Bet[] = [];
    const userBalanceUpdates = new Map<number, number>();

    // Process each bet
    for (const betResult of betResults) {
      let isWinner = false;

      // Determine if bet won based on bet type
      if (betResult.bet_type === 'outcome') {
        // For outcome bets, check if predicted outcome matches actual outcome
        isWinner = betResult.prediction_outcome === actualOutcome;
      }
      // Note: Other bet types (over_under, both_teams_score) would need additional logic
      // For now, focusing on outcome bets as they're the most straightforward

      const newStatus = isWinner ? 'won' : 'lost';
      const winAmount = isWinner ? parseFloat(betResult.bet_potential_return) : 0;

      // Update bet status
      const updatedBetResults = await db.update(betsTable)
        .set({
          status: newStatus,
          settled_at: new Date()
        })
        .where(eq(betsTable.id, betResult.bet_id))
        .returning()
        .execute();

      if (updatedBetResults.length > 0) {
        const updatedBet = updatedBetResults[0];
        settledBets.push({
          ...updatedBet,
          amount: parseFloat(updatedBet.amount),
          odds: parseFloat(updatedBet.odds),
          potential_return: parseFloat(updatedBet.potential_return)
        });

        // Track balance updates for winners
        if (isWinner && winAmount > 0) {
          const currentUpdate = userBalanceUpdates.get(betResult.bet_user_id) || 0;
          userBalanceUpdates.set(betResult.bet_user_id, currentUpdate + winAmount);
        }
      }
    }

    // Update user balances for winners
    for (const [userId, winAmount] of userBalanceUpdates) {
      await db.update(usersTable)
        .set({
          total_balance: sql`${usersTable.total_balance} + ${winAmount.toString()}`
        })
        .where(eq(usersTable.id, userId))
        .execute();
    }

    return settledBets;
  } catch (error) {
    console.error('Bet settlement failed:', error);
    throw error;
  }
};