import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { teamsTable } from '../db/schema';
import { type CreateTeamInput } from '../schema';
import { createTeam } from '../handlers/create_team';
import { eq } from 'drizzle-orm';

// Simple test input
const testInput: CreateTeamInput = {
  name: 'Manchester United',
  code: 'MAN',
  logo_url: 'https://example.com/man-utd-logo.png'
};

const testInputWithNullLogo: CreateTeamInput = {
  name: 'Liverpool FC',
  code: 'LIV',
  logo_url: null
};

describe('createTeam', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a team with logo URL', async () => {
    const result = await createTeam(testInput);

    // Basic field validation
    expect(result.name).toEqual('Manchester United');
    expect(result.code).toEqual('MAN');
    expect(result.logo_url).toEqual('https://example.com/man-utd-logo.png');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a team with null logo URL', async () => {
    const result = await createTeam(testInputWithNullLogo);

    expect(result.name).toEqual('Liverpool FC');
    expect(result.code).toEqual('LIV');
    expect(result.logo_url).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save team to database', async () => {
    const result = await createTeam(testInput);

    // Query using proper drizzle syntax
    const teams = await db.select()
      .from(teamsTable)
      .where(eq(teamsTable.id, result.id))
      .execute();

    expect(teams).toHaveLength(1);
    expect(teams[0].name).toEqual('Manchester United');
    expect(teams[0].code).toEqual('MAN');
    expect(teams[0].logo_url).toEqual('https://example.com/man-utd-logo.png');
    expect(teams[0].created_at).toBeInstanceOf(Date);
  });

  it('should enforce unique team code constraint', async () => {
    // Create first team
    await createTeam(testInput);

    // Try to create second team with same code
    const duplicateInput: CreateTeamInput = {
      name: 'Manchester City',
      code: 'MAN', // Same code as first team
      logo_url: 'https://example.com/man-city-logo.png'
    };

    // Should throw error due to unique constraint on code
    await expect(createTeam(duplicateInput)).rejects.toThrow(/unique/i);
  });

  it('should create multiple teams with different codes', async () => {
    // Create first team
    const team1 = await createTeam(testInput);
    
    // Create second team with different code
    const team2Input: CreateTeamInput = {
      name: 'Arsenal FC',
      code: 'ARS',
      logo_url: 'https://example.com/arsenal-logo.png'
    };
    const team2 = await createTeam(team2Input);

    // Verify both teams were created with different IDs
    expect(team1.id).not.toEqual(team2.id);
    expect(team1.code).toEqual('MAN');
    expect(team2.code).toEqual('ARS');

    // Verify both exist in database
    const allTeams = await db.select()
      .from(teamsTable)
      .execute();

    expect(allTeams).toHaveLength(2);
    const teamCodes = allTeams.map(team => team.code).sort();
    expect(teamCodes).toEqual(['ARS', 'MAN']);
  });
});