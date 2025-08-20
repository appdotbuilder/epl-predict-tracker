import { db } from '../db';
import { matchesTable, teamsTable } from '../db/schema';
import { type GetMatchesInput, type Match } from '../schema';
import { eq, and, desc, type SQL } from 'drizzle-orm';

export const getMatches = async (input: GetMatchesInput): Promise<Match[]> => {
  try {
    // Build the base query
    let query = db.select({
      id: matchesTable.id,
      home_team_id: matchesTable.home_team_id,
      away_team_id: matchesTable.away_team_id,
      match_date: matchesTable.match_date,
      home_score: matchesTable.home_score,
      away_score: matchesTable.away_score,
      status: matchesTable.status,
      gameweek: matchesTable.gameweek,
      season: matchesTable.season,
      created_at: matchesTable.created_at
    })
    .from(matchesTable);

    // Build conditions array for optional filters
    const conditions: SQL<unknown>[] = [];

    if (input.gameweek !== undefined) {
      conditions.push(eq(matchesTable.gameweek, input.gameweek));
    }

    if (input.season !== undefined) {
      conditions.push(eq(matchesTable.season, input.season));
    }

    if (input.status !== undefined) {
      conditions.push(eq(matchesTable.status, input.status));
    }

    // Apply all query modifiers in one chain
    const finalQuery = conditions.length > 0
      ? query
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(desc(matchesTable.match_date))
          .limit(input.limit)
          .offset(input.offset)
      : query
          .orderBy(desc(matchesTable.match_date))
          .limit(input.limit)
          .offset(input.offset);

    const results = await finalQuery.execute();

    // Return matches - no numeric conversion needed as all fields are integers/timestamps
    return results;
  } catch (error) {
    console.error('Get matches failed:', error);
    throw error;
  }
};