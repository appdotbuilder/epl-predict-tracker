import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { matchesTable, teamsTable } from '../db/schema';
import { type GetMatchesInput } from '../schema';
import { getMatches } from '../handlers/get_matches';

describe('getMatches', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test teams
  const createTestTeams = async () => {
    return await db.insert(teamsTable)
      .values([
        {
          name: 'Manchester United',
          code: 'MAN',
          logo_url: 'https://example.com/man.png'
        },
        {
          name: 'Liverpool FC',
          code: 'LIV', 
          logo_url: 'https://example.com/liv.png'
        },
        {
          name: 'Chelsea FC',
          code: 'CHE',
          logo_url: 'https://example.com/che.png'
        },
        {
          name: 'Arsenal FC',
          code: 'ARS',
          logo_url: 'https://example.com/ars.png'
        }
      ])
      .returning()
      .execute();
  };

  // Helper function to create test matches
  const createTestMatches = async (teams: any[]) => {
    const baseDate = new Date('2024-01-15T15:00:00Z');
    
    return await db.insert(matchesTable)
      .values([
        {
          home_team_id: teams[0].id,
          away_team_id: teams[1].id,
          match_date: new Date(baseDate.getTime()),
          home_score: 2,
          away_score: 1,
          status: 'completed',
          gameweek: 1,
          season: '2024-25'
        },
        {
          home_team_id: teams[2].id,
          away_team_id: teams[3].id,
          match_date: new Date(baseDate.getTime() + 24 * 60 * 60 * 1000), // +1 day
          home_score: null,
          away_score: null,
          status: 'scheduled',
          gameweek: 2,
          season: '2024-25'
        },
        {
          home_team_id: teams[1].id,
          away_team_id: teams[0].id,
          match_date: new Date(baseDate.getTime() + 48 * 60 * 60 * 1000), // +2 days
          home_score: 1,
          away_score: 1,
          status: 'completed',
          gameweek: 2,
          season: '2024-25'
        },
        {
          home_team_id: teams[3].id,
          away_team_id: teams[2].id,
          match_date: new Date(baseDate.getTime() + 72 * 60 * 60 * 1000), // +3 days
          home_score: null,
          away_score: null,
          status: 'scheduled',
          gameweek: 3,
          season: '2023-24'
        }
      ])
      .returning()
      .execute();
  };

  it('should return all matches with default parameters', async () => {
    const teams = await createTestTeams();
    const matches = await createTestMatches(teams);

    const input: GetMatchesInput = {
      limit: 50,
      offset: 0
    };

    const result = await getMatches(input);

    expect(result).toHaveLength(4);
    expect(result[0].id).toBeDefined();
    expect(result[0].home_team_id).toBeDefined();
    expect(result[0].away_team_id).toBeDefined();
    expect(result[0].match_date).toBeInstanceOf(Date);
    expect(result[0].status).toMatch(/^(scheduled|completed|in_progress|postponed)$/);
    expect(result[0].gameweek).toBeTypeOf('number');
    expect(result[0].season).toBeTypeOf('string');
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should filter matches by gameweek', async () => {
    const teams = await createTestTeams();
    await createTestMatches(teams);

    const input: GetMatchesInput = {
      gameweek: 2,
      limit: 50,
      offset: 0
    };

    const result = await getMatches(input);

    expect(result).toHaveLength(2);
    result.forEach(match => {
      expect(match.gameweek).toEqual(2);
    });
  });

  it('should filter matches by season', async () => {
    const teams = await createTestTeams();
    await createTestMatches(teams);

    const input: GetMatchesInput = {
      season: '2024-25',
      limit: 50,
      offset: 0
    };

    const result = await getMatches(input);

    expect(result).toHaveLength(3);
    result.forEach(match => {
      expect(match.season).toEqual('2024-25');
    });
  });

  it('should filter matches by status', async () => {
    const teams = await createTestTeams();
    await createTestMatches(teams);

    const input: GetMatchesInput = {
      status: 'completed',
      limit: 50,
      offset: 0
    };

    const result = await getMatches(input);

    expect(result).toHaveLength(2);
    result.forEach(match => {
      expect(match.status).toEqual('completed');
      expect(match.home_score).toBeTypeOf('number');
      expect(match.away_score).toBeTypeOf('number');
    });
  });

  it('should filter matches by multiple criteria', async () => {
    const teams = await createTestTeams();
    await createTestMatches(teams);

    const input: GetMatchesInput = {
      gameweek: 2,
      season: '2024-25',
      status: 'completed',
      limit: 50,
      offset: 0
    };

    const result = await getMatches(input);

    expect(result).toHaveLength(1);
    expect(result[0].gameweek).toEqual(2);
    expect(result[0].season).toEqual('2024-25');
    expect(result[0].status).toEqual('completed');
  });

  it('should handle pagination with limit', async () => {
    const teams = await createTestTeams();
    await createTestMatches(teams);

    const input: GetMatchesInput = {
      limit: 2,
      offset: 0
    };

    const result = await getMatches(input);

    expect(result).toHaveLength(2);
  });

  it('should handle pagination with offset', async () => {
    const teams = await createTestTeams();
    await createTestMatches(teams);

    // Get all matches first to compare
    const allMatches = await getMatches({
      limit: 50,
      offset: 0
    });

    const input: GetMatchesInput = {
      limit: 2,
      offset: 2
    };

    const result = await getMatches(input);

    expect(result).toHaveLength(2);
    // Verify offset works by comparing IDs
    expect(result[0].id).not.toEqual(allMatches[0].id);
    expect(result[0].id).not.toEqual(allMatches[1].id);
  });

  it('should return matches ordered by date descending', async () => {
    const teams = await createTestTeams();
    await createTestMatches(teams);

    const input: GetMatchesInput = {
      limit: 50,
      offset: 0
    };

    const result = await getMatches(input);

    expect(result).toHaveLength(4);
    
    // Verify descending order by date
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].match_date >= result[i + 1].match_date).toBe(true);
    }
  });

  it('should return empty array when no matches found', async () => {
    const teams = await createTestTeams();
    await createTestMatches(teams);

    const input: GetMatchesInput = {
      gameweek: 999,
      limit: 50,
      offset: 0
    };

    const result = await getMatches(input);

    expect(result).toHaveLength(0);
  });

  it('should handle null scores for scheduled matches', async () => {
    const teams = await createTestTeams();
    await createTestMatches(teams);

    const input: GetMatchesInput = {
      status: 'scheduled',
      limit: 50,
      offset: 0
    };

    const result = await getMatches(input);

    expect(result.length).toBeGreaterThan(0);
    result.forEach(match => {
      expect(match.status).toEqual('scheduled');
      expect(match.home_score).toBeNull();
      expect(match.away_score).toBeNull();
    });
  });

  it('should work with minimal input using defaults', async () => {
    const teams = await createTestTeams();
    await createTestMatches(teams);

    // Test with empty object (Zod will apply defaults)
    const input: GetMatchesInput = {
      limit: 50,
      offset: 0
    };

    const result = await getMatches(input);

    expect(result).toHaveLength(4);
    expect(Array.isArray(result)).toBe(true);
  });
});