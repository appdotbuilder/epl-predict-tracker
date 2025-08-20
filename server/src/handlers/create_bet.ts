import { db } from '../db';
import { betsTable, usersTable, predictionsTable } from '../db/schema';
import { type CreateBetInput, type Bet } from '../schema';
import { eq } from 'drizzle-orm';

export const createBet = async (input: CreateBetInput): Promise<Bet> => {
  try {
    // Validate that user exists and has sufficient balance
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error(`User with id ${input.user_id} not found`);
    }

    const userBalance = parseFloat(user[0].total_balance);
    if (userBalance < input.amount) {
      throw new Error(`Insufficient balance. Required: ${input.amount}, Available: ${userBalance}`);
    }

    // Validate that prediction exists
    const prediction = await db.select()
      .from(predictionsTable)
      .where(eq(predictionsTable.id, input.prediction_id))
      .execute();

    if (prediction.length === 0) {
      throw new Error(`Prediction with id ${input.prediction_id} not found`);
    }

    // Calculate potential return
    const potentialReturn = input.amount * input.odds;

    // Insert bet record
    const result = await db.insert(betsTable)
      .values({
        user_id: input.user_id,
        prediction_id: input.prediction_id,
        amount: input.amount.toString(),
        bet_type: input.bet_type,
        bet_value: input.bet_value,
        odds: input.odds.toString(),
        potential_return: potentialReturn.toString(),
        status: 'pending'
      })
      .returning()
      .execute();

    // Deduct bet amount from user's balance
    const newBalance = userBalance - input.amount;
    await db.update(usersTable)
      .set({ total_balance: newBalance.toString() })
      .where(eq(usersTable.id, input.user_id))
      .execute();

    // Convert numeric fields back to numbers before returning
    const bet = result[0];
    return {
      ...bet,
      amount: parseFloat(bet.amount),
      odds: parseFloat(bet.odds),
      potential_return: parseFloat(bet.potential_return)
    };
  } catch (error) {
    // Only log unexpected errors, not validation errors
    if (!(error instanceof Error) || 
        (!error.message.includes('not found') && !error.message.includes('Insufficient balance'))) {
      console.error('Bet creation failed:', error);
    }
    throw error;
  }
};