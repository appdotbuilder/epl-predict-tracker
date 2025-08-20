import { db } from '../db';
import { matchesTable, teamsTable } from '../db/schema';
import { type CreateMatchInput, type Match } from '../schema';
import { eq } from 'drizzle-orm';

export const createMatch = async (input: CreateMatchInput): Promise<Match> => {
  try {
    // Validate that both teams exist
    const [homeTeam, awayTeam] = await Promise.all([
      db.select()
        .from(teamsTable)
        .where(eq(teamsTable.id, input.home_team_id))
        .execute(),
      db.select()
        .from(teamsTable)
        .where(eq(teamsTable.id, input.away_team_id))
        .execute()
    ]);

    if (homeTeam.length === 0) {
      throw new Error(`Home team with id ${input.home_team_id} does not exist`);
    }

    if (awayTeam.length === 0) {
      throw new Error(`Away team with id ${input.away_team_id} does not exist`);
    }

    // Validate that home and away teams are different
    if (input.home_team_id === input.away_team_id) {
      throw new Error('A team cannot play against itself');
    }

    // Insert match record
    const result = await db.insert(matchesTable)
      .values({
        home_team_id: input.home_team_id,
        away_team_id: input.away_team_id,
        match_date: input.match_date,
        gameweek: input.gameweek,
        season: input.season,
        status: 'scheduled', // Default status for new matches
        home_score: null, // Match hasn't been played yet
        away_score: null
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Match creation failed:', error);
    throw error;
  }
};