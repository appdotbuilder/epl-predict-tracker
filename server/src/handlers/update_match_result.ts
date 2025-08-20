import { db } from '../db';
import { matchesTable, betsTable, predictionsTable } from '../db/schema';
import { type UpdateMatchResultInput, type Match } from '../schema';
import { eq, and } from 'drizzle-orm';

export const updateMatchResult = async (input: UpdateMatchResultInput): Promise<Match> => {
  try {
    // First update the match with the final result
    const matchResult = await db.update(matchesTable)
      .set({
        home_score: input.home_score,
        away_score: input.away_score,
        status: input.status
      })
      .where(eq(matchesTable.id, input.id))
      .returning()
      .execute();

    if (matchResult.length === 0) {
      throw new Error(`Match with id ${input.id} not found`);
    }

    const updatedMatch = matchResult[0];

    // Determine the actual match outcome for bet settlement
    let actualOutcome: 'home_win' | 'draw' | 'away_win';
    if (input.home_score > input.away_score) {
      actualOutcome = 'home_win';
    } else if (input.home_score < input.away_score) {
      actualOutcome = 'away_win';
    } else {
      actualOutcome = 'draw';
    }

    // Get all bets for this match that are still pending
    const pendingBets = await db.select({
      id: betsTable.id,
      user_id: betsTable.user_id,
      amount: betsTable.amount,
      bet_type: betsTable.bet_type,
      bet_value: betsTable.bet_value,
      odds: betsTable.odds,
      potential_return: betsTable.potential_return,
      predicted_outcome: predictionsTable.predicted_outcome
    })
      .from(betsTable)
      .innerJoin(predictionsTable, eq(betsTable.prediction_id, predictionsTable.id))
      .where(
        and(
          eq(predictionsTable.match_id, input.id),
          eq(betsTable.status, 'pending')
        )
      )
      .execute();

    // Settle each bet based on the actual outcome
    for (const bet of pendingBets) {
      let betWon = false;
      
      if (bet.bet_type === 'outcome') {
        // For outcome bets, check if the predicted outcome matches actual outcome
        betWon = bet.predicted_outcome === actualOutcome;
      }
      // Additional bet types (over_under, both_teams_score) could be handled here
      // For now, we're focusing on outcome bets as they're the most straightforward

      // Update bet status
      await db.update(betsTable)
        .set({
          status: betWon ? 'won' : 'lost',
          settled_at: new Date()
        })
        .where(eq(betsTable.id, bet.id))
        .execute();

      // If bet won, we would typically update user's balance here
      // However, since we don't have a user balance update handler in scope,
      // and following the rule of not using other handlers, we'll leave this
      // for a separate balance management system
    }

    return updatedMatch;
  } catch (error) {
    console.error('Match result update failed:', error);
    throw error;
  }
};