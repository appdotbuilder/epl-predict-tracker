import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { matchesTable, teamsTable } from '../db/schema';
import { type CreateMatchInput } from '../schema';
import { createMatch } from '../handlers/create_match';
import { eq } from 'drizzle-orm';

describe('createMatch', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let homeTeamId: number;
  let awayTeamId: number;

  beforeEach(async () => {
    // Create test teams before each test
    const teams = await db.insert(teamsTable)
      .values([
        {
          name: 'Manchester United',
          code: 'MAN',
          logo_url: 'https://example.com/man.png'
        },
        {
          name: 'Liverpool',
          code: 'LIV',
          logo_url: 'https://example.com/liv.png'
        }
      ])
      .returning()
      .execute();

    homeTeamId = teams[0].id;
    awayTeamId = teams[1].id;
  });

  const testInput: CreateMatchInput = {
    home_team_id: 1, // Will be updated in tests
    away_team_id: 2, // Will be updated in tests
    match_date: new Date('2024-12-25T15:00:00Z'),
    gameweek: 15,
    season: '2024-25'
  };

  it('should create a match successfully', async () => {
    const input = { ...testInput, home_team_id: homeTeamId, away_team_id: awayTeamId };
    const result = await createMatch(input);

    // Verify basic fields
    expect(result.id).toBeDefined();
    expect(result.home_team_id).toEqual(homeTeamId);
    expect(result.away_team_id).toEqual(awayTeamId);
    expect(result.match_date).toEqual(input.match_date);
    expect(result.gameweek).toEqual(15);
    expect(result.season).toEqual('2024-25');
    expect(result.status).toEqual('scheduled');
    expect(result.home_score).toBeNull();
    expect(result.away_score).toBeNull();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save match to database', async () => {
    const input = { ...testInput, home_team_id: homeTeamId, away_team_id: awayTeamId };
    const result = await createMatch(input);

    const matches = await db.select()
      .from(matchesTable)
      .where(eq(matchesTable.id, result.id))
      .execute();

    expect(matches).toHaveLength(1);
    const savedMatch = matches[0];
    expect(savedMatch.home_team_id).toEqual(homeTeamId);
    expect(savedMatch.away_team_id).toEqual(awayTeamId);
    expect(savedMatch.gameweek).toEqual(15);
    expect(savedMatch.season).toEqual('2024-25');
    expect(savedMatch.status).toEqual('scheduled');
    expect(savedMatch.home_score).toBeNull();
    expect(savedMatch.away_score).toBeNull();
    expect(savedMatch.created_at).toBeInstanceOf(Date);
  });

  it('should throw error when home team does not exist', async () => {
    const input = { ...testInput, home_team_id: 999, away_team_id: awayTeamId };
    
    await expect(createMatch(input)).rejects.toThrow(/home team with id 999 does not exist/i);
  });

  it('should throw error when away team does not exist', async () => {
    const input = { ...testInput, home_team_id: homeTeamId, away_team_id: 999 };
    
    await expect(createMatch(input)).rejects.toThrow(/away team with id 999 does not exist/i);
  });

  it('should throw error when home and away teams are the same', async () => {
    const input = { ...testInput, home_team_id: homeTeamId, away_team_id: homeTeamId };
    
    await expect(createMatch(input)).rejects.toThrow(/team cannot play against itself/i);
  });

  it('should handle different gameweeks and seasons correctly', async () => {
    const input1 = { 
      ...testInput, 
      home_team_id: homeTeamId, 
      away_team_id: awayTeamId,
      gameweek: 1,
      season: '2023-24'
    };
    const input2 = { 
      ...testInput, 
      home_team_id: awayTeamId, 
      away_team_id: homeTeamId,
      gameweek: 38,
      season: '2024-25'
    };

    const [result1, result2] = await Promise.all([
      createMatch(input1),
      createMatch(input2)
    ]);

    expect(result1.gameweek).toEqual(1);
    expect(result1.season).toEqual('2023-24');
    expect(result2.gameweek).toEqual(38);
    expect(result2.season).toEqual('2024-25');

    // Verify both are saved in database
    const matches = await db.select().from(matchesTable).execute();
    expect(matches).toHaveLength(2);
  });

  it('should handle match dates correctly', async () => {
    const futureDate = new Date('2025-01-01T20:00:00Z');
    const input = { 
      ...testInput, 
      home_team_id: homeTeamId, 
      away_team_id: awayTeamId,
      match_date: futureDate
    };

    const result = await createMatch(input);

    expect(result.match_date).toEqual(futureDate);

    // Verify in database
    const matches = await db.select()
      .from(matchesTable)
      .where(eq(matchesTable.id, result.id))
      .execute();

    expect(matches[0].match_date).toEqual(futureDate);
  });
});