import { db } from '../db';
import { matchesTable, teamsTable, predictionsTable } from '../db/schema';
import { type Match, type Prediction, type Team } from '../schema';
import { eq, asc } from 'drizzle-orm';

interface MatchWithPrediction {
    match: Match;
    homeTeam: Team;
    awayTeam: Team;
    prediction: Prediction | null;
}

export const getUpcomingMatchesWithPredictions = async (limit: number = 10): Promise<MatchWithPrediction[]> => {
    try {
        // First, get scheduled matches ordered by date
        const matches = await db.select()
            .from(matchesTable)
            .where(eq(matchesTable.status, 'scheduled'))
            .orderBy(asc(matchesTable.match_date))
            .limit(limit)
            .execute();

        if (matches.length === 0) {
            return [];
        }

        // Get all team IDs we need
        const teamIds = [...new Set(matches.flatMap(match => [match.home_team_id, match.away_team_id]))];
        
        // Fetch all teams in one query
        const teams = await db.select()
            .from(teamsTable)
            .execute();
        
        // Create a map for quick team lookup
        const teamMap = new Map(teams.map(team => [team.id, team]));

        // Get match IDs for predictions
        const matchIds = matches.map(match => match.id);
        
        // Fetch all predictions for these matches
        const predictions = await db.select()
            .from(predictionsTable)
            .execute();
        
        // Create a map for quick prediction lookup
        const predictionMap = new Map(predictions.map(pred => [pred.match_id, pred]));

        // Combine the data
        const matchesWithPredictions: MatchWithPrediction[] = matches.map(match => {
            const homeTeam = teamMap.get(match.home_team_id);
            const awayTeam = teamMap.get(match.away_team_id);
            const prediction = predictionMap.get(match.id) || null;

            if (!homeTeam || !awayTeam) {
                throw new Error(`Teams not found for match ${match.id}`);
            }

            return {
                match,
                homeTeam,
                awayTeam,
                prediction
            };
        });

        return matchesWithPredictions;
    } catch (error) {
        console.error('Failed to fetch upcoming matches with predictions:', error);
        throw error;
    }
};