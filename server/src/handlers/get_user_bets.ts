import { db } from '../db';
import { betsTable, usersTable, predictionsTable, matchesTable, teamsTable } from '../db/schema';
import { type GetUserBetsInput, type Bet } from '../schema';
import { eq, and, desc, type SQL } from 'drizzle-orm';

export const getUserBets = async (input: GetUserBetsInput): Promise<Bet[]> => {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [
      eq(betsTable.user_id, input.user_id)
    ];

    // Add optional status filter
    if (input.status) {
      conditions.push(eq(betsTable.status, input.status));
    }

    // Build query with all clauses in proper order
    const results = await db.select({
      id: betsTable.id,
      user_id: betsTable.user_id,
      prediction_id: betsTable.prediction_id,
      amount: betsTable.amount,
      bet_type: betsTable.bet_type,
      bet_value: betsTable.bet_value,
      odds: betsTable.odds,
      potential_return: betsTable.potential_return,
      status: betsTable.status,
      settled_at: betsTable.settled_at,
      created_at: betsTable.created_at,
    })
    .from(betsTable)
    .where(and(...conditions))
    .orderBy(desc(betsTable.created_at))
    .limit(input.limit)
    .offset(input.offset)
    .execute();

    // Convert numeric fields to numbers
    return results.map(bet => ({
      ...bet,
      amount: parseFloat(bet.amount),
      odds: parseFloat(bet.odds),
      potential_return: parseFloat(bet.potential_return)
    }));
  } catch (error) {
    console.error('Get user bets failed:', error);
    throw error;
  }
};