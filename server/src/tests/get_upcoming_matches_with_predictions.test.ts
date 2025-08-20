import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { teamsTable, matchesTable, predictionsTable } from '../db/schema';
import { type CreateTeamInput, type CreateMatchInput, type CreatePredictionInput } from '../schema';
import { getUpcomingMatchesWithPredictions } from '../handlers/get_upcoming_matches_with_predictions';

describe('getUpcomingMatchesWithPredictions', () => {
    beforeEach(createDB);
    afterEach(resetDB);

    it('should return empty array when no matches exist', async () => {
        const result = await getUpcomingMatchesWithPredictions();
        expect(result).toEqual([]);
    });

    it('should return scheduled matches with team details and predictions', async () => {
        // Create test teams
        const homeTeam = await db.insert(teamsTable)
            .values({
                name: 'Manchester United',
                code: 'MAN',
                logo_url: 'https://example.com/man.png'
            })
            .returning()
            .execute();

        const awayTeam = await db.insert(teamsTable)
            .values({
                name: 'Liverpool',
                code: 'LIV',
                logo_url: 'https://example.com/liv.png'
            })
            .returning()
            .execute();

        // Create a scheduled match
        const match = await db.insert(matchesTable)
            .values({
                home_team_id: homeTeam[0].id,
                away_team_id: awayTeam[0].id,
                match_date: new Date('2024-12-01T15:00:00Z'),
                gameweek: 15,
                season: '2024-25',
                status: 'scheduled'
            })
            .returning()
            .execute();

        // Create a prediction for the match
        const prediction = await db.insert(predictionsTable)
            .values({
                match_id: match[0].id,
                predicted_outcome: 'home_win',
                confidence_percentage: 75,
                predicted_home_score: 2,
                predicted_away_score: 1,
                reasoning: 'Home team has better recent form',
                model_version: 'v1.0'
            })
            .returning()
            .execute();

        const result = await getUpcomingMatchesWithPredictions();

        expect(result).toHaveLength(1);
        
        const matchResult = result[0];
        expect(matchResult.match.id).toEqual(match[0].id);
        expect(matchResult.match.status).toEqual('scheduled');
        expect(matchResult.match.gameweek).toEqual(15);
        
        expect(matchResult.homeTeam.id).toEqual(homeTeam[0].id);
        expect(matchResult.homeTeam.name).toEqual('Manchester United');
        expect(matchResult.homeTeam.code).toEqual('MAN');
        
        expect(matchResult.awayTeam.id).toEqual(awayTeam[0].id);
        expect(matchResult.awayTeam.name).toEqual('Liverpool');
        expect(matchResult.awayTeam.code).toEqual('LIV');
        
        expect(matchResult.prediction).not.toBeNull();
        expect(matchResult.prediction!.id).toEqual(prediction[0].id);
        expect(matchResult.prediction!.predicted_outcome).toEqual('home_win');
        expect(matchResult.prediction!.confidence_percentage).toEqual(75);
    });

    it('should return matches without predictions when no predictions exist', async () => {
        // Create test teams
        const homeTeam = await db.insert(teamsTable)
            .values({
                name: 'Arsenal',
                code: 'ARS',
                logo_url: null
            })
            .returning()
            .execute();

        const awayTeam = await db.insert(teamsTable)
            .values({
                name: 'Chelsea',
                code: 'CHE',
                logo_url: null
            })
            .returning()
            .execute();

        // Create a scheduled match without prediction
        const match = await db.insert(matchesTable)
            .values({
                home_team_id: homeTeam[0].id,
                away_team_id: awayTeam[0].id,
                match_date: new Date('2024-12-02T17:30:00Z'),
                gameweek: 16,
                season: '2024-25',
                status: 'scheduled'
            })
            .returning()
            .execute();

        const result = await getUpcomingMatchesWithPredictions();

        expect(result).toHaveLength(1);
        
        const matchResult = result[0];
        expect(matchResult.match.id).toEqual(match[0].id);
        expect(matchResult.homeTeam.name).toEqual('Arsenal');
        expect(matchResult.awayTeam.name).toEqual('Chelsea');
        expect(matchResult.prediction).toBeNull();
    });

    it('should only return scheduled matches, not completed ones', async () => {
        // Create test teams
        const team1 = await db.insert(teamsTable)
            .values({
                name: 'Team 1',
                code: 'T1',
                logo_url: null
            })
            .returning()
            .execute();

        const team2 = await db.insert(teamsTable)
            .values({
                name: 'Team 2',
                code: 'T2',
                logo_url: null
            })
            .returning()
            .execute();

        // Create a scheduled match
        await db.insert(matchesTable)
            .values({
                home_team_id: team1[0].id,
                away_team_id: team2[0].id,
                match_date: new Date('2024-12-01T15:00:00Z'),
                gameweek: 15,
                season: '2024-25',
                status: 'scheduled'
            })
            .returning()
            .execute();

        // Create a completed match (should not be returned)
        await db.insert(matchesTable)
            .values({
                home_team_id: team2[0].id,
                away_team_id: team1[0].id,
                match_date: new Date('2024-11-30T15:00:00Z'),
                home_score: 2,
                away_score: 1,
                gameweek: 14,
                season: '2024-25',
                status: 'completed'
            })
            .returning()
            .execute();

        const result = await getUpcomingMatchesWithPredictions();

        expect(result).toHaveLength(1);
        expect(result[0].match.status).toEqual('scheduled');
    });

    it('should order matches by match_date ascending', async () => {
        // Create test teams
        const team1 = await db.insert(teamsTable)
            .values({
                name: 'Team 1',
                code: 'T1',
                logo_url: null
            })
            .returning()
            .execute();

        const team2 = await db.insert(teamsTable)
            .values({
                name: 'Team 2',
                code: 'T2',
                logo_url: null
            })
            .returning()
            .execute();

        // Create matches in reverse chronological order
        const laterMatch = await db.insert(matchesTable)
            .values({
                home_team_id: team1[0].id,
                away_team_id: team2[0].id,
                match_date: new Date('2024-12-05T15:00:00Z'),
                gameweek: 17,
                season: '2024-25',
                status: 'scheduled'
            })
            .returning()
            .execute();

        const earlierMatch = await db.insert(matchesTable)
            .values({
                home_team_id: team2[0].id,
                away_team_id: team1[0].id,
                match_date: new Date('2024-12-01T15:00:00Z'),
                gameweek: 15,
                season: '2024-25',
                status: 'scheduled'
            })
            .returning()
            .execute();

        const result = await getUpcomingMatchesWithPredictions();

        expect(result).toHaveLength(2);
        // Earlier match should come first
        expect(result[0].match.id).toEqual(earlierMatch[0].id);
        expect(result[0].match.gameweek).toEqual(15);
        expect(result[1].match.id).toEqual(laterMatch[0].id);
        expect(result[1].match.gameweek).toEqual(17);
    });

    it('should respect the limit parameter', async () => {
        // Create test teams
        const team1 = await db.insert(teamsTable)
            .values({
                name: 'Team 1',
                code: 'T1',
                logo_url: null
            })
            .returning()
            .execute();

        const team2 = await db.insert(teamsTable)
            .values({
                name: 'Team 2',
                code: 'T2',
                logo_url: null
            })
            .returning()
            .execute();

        // Create 3 scheduled matches
        for (let i = 1; i <= 3; i++) {
            await db.insert(matchesTable)
                .values({
                    home_team_id: team1[0].id,
                    away_team_id: team2[0].id,
                    match_date: new Date(`2024-12-0${i}T15:00:00Z`),
                    gameweek: 14 + i,
                    season: '2024-25',
                    status: 'scheduled'
                })
                .returning()
                .execute();
        }

        // Test with limit of 2
        const result = await getUpcomingMatchesWithPredictions(2);

        expect(result).toHaveLength(2);
        expect(result[0].match.gameweek).toEqual(15); // First match
        expect(result[1].match.gameweek).toEqual(16); // Second match
    });

    it('should handle multiple matches with different prediction states', async () => {
        // Create test teams
        const team1 = await db.insert(teamsTable)
            .values({
                name: 'Team 1',
                code: 'T1',
                logo_url: null
            })
            .returning()
            .execute();

        const team2 = await db.insert(teamsTable)
            .values({
                name: 'Team 2',
                code: 'T2',
                logo_url: null
            })
            .returning()
            .execute();

        // Create two matches
        const match1 = await db.insert(matchesTable)
            .values({
                home_team_id: team1[0].id,
                away_team_id: team2[0].id,
                match_date: new Date('2024-12-01T15:00:00Z'),
                gameweek: 15,
                season: '2024-25',
                status: 'scheduled'
            })
            .returning()
            .execute();

        const match2 = await db.insert(matchesTable)
            .values({
                home_team_id: team2[0].id,
                away_team_id: team1[0].id,
                match_date: new Date('2024-12-02T15:00:00Z'),
                gameweek: 16,
                season: '2024-25',
                status: 'scheduled'
            })
            .returning()
            .execute();

        // Create prediction only for first match
        await db.insert(predictionsTable)
            .values({
                match_id: match1[0].id,
                predicted_outcome: 'draw',
                confidence_percentage: 60,
                predicted_home_score: null,
                predicted_away_score: null,
                reasoning: null,
                model_version: 'v1.0'
            })
            .returning()
            .execute();

        const result = await getUpcomingMatchesWithPredictions();

        expect(result).toHaveLength(2);
        expect(result[0].prediction).not.toBeNull();
        expect(result[0].prediction!.predicted_outcome).toEqual('draw');
        expect(result[1].prediction).toBeNull();
    });
});