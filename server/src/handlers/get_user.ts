import { db } from '../db';
import { usersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type User } from '../schema';

export const getUser = async (userId: number): Promise<User | null> => {
  try {
    // Query user by ID
    const result = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    // Return null if user not found
    if (result.length === 0) {
      return null;
    }

    // Convert numeric balance back to number before returning
    const user = result[0];
    return {
      ...user,
      total_balance: parseFloat(user.total_balance) // Convert string back to number
    };
  } catch (error) {
    console.error('User fetch failed:', error);
    throw error;
  }
};