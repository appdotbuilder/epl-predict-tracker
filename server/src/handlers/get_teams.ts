import { db } from '../db';
import { teamsTable } from '../db/schema';
import { type Team } from '../schema';
import { asc } from 'drizzle-orm';

export const getTeams = async (): Promise<Team[]> => {
  try {
    const result = await db.select()
      .from(teamsTable)
      .orderBy(asc(teamsTable.name))
      .execute();

    // Convert numeric fields back to numbers (total_balance is not present in teams)
    return result.map(team => ({
      ...team,
      // No numeric conversions needed for teams table - all fields are already correct types
    }));
  } catch (error) {
    console.error('Failed to fetch teams:', error);
    throw error;
  }
};