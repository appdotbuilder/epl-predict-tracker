import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { teamsTable } from '../db/schema';
import { type CreateTeamInput } from '../schema';
import { getTeams } from '../handlers/get_teams';

// Test data
const testTeams: CreateTeamInput[] = [
  {
    name: 'Manchester United',
    code: 'MUN',
    logo_url: 'https://example.com/man-utd-logo.png'
  },
  {
    name: 'Arsenal',
    code: 'ARS',
    logo_url: 'https://example.com/arsenal-logo.png'
  },
  {
    name: 'Liverpool',
    code: 'LIV',
    logo_url: null
  }
];

describe('getTeams', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no teams exist', async () => {
    const result = await getTeams();

    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return all teams', async () => {
    // Insert test teams
    await db.insert(teamsTable)
      .values(testTeams)
      .execute();

    const result = await getTeams();

    expect(result).toHaveLength(3);
    
    // Verify all teams are returned with correct fields
    expect(result[0].name).toBeDefined();
    expect(result[0].code).toBeDefined();
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should return teams ordered by name alphabetically', async () => {
    // Insert test teams
    await db.insert(teamsTable)
      .values(testTeams)
      .execute();

    const result = await getTeams();

    // Should be ordered: Arsenal, Liverpool, Manchester United
    expect(result[0].name).toEqual('Arsenal');
    expect(result[0].code).toEqual('ARS');
    
    expect(result[1].name).toEqual('Liverpool');
    expect(result[1].code).toEqual('LIV');
    expect(result[1].logo_url).toBeNull();
    
    expect(result[2].name).toEqual('Manchester United');
    expect(result[2].code).toEqual('MUN');
    expect(result[2].logo_url).toEqual('https://example.com/man-utd-logo.png');
  });

  it('should handle teams with null logo_url correctly', async () => {
    // Insert team with null logo_url
    await db.insert(teamsTable)
      .values([{
        name: 'Chelsea',
        code: 'CHE',
        logo_url: null
      }])
      .execute();

    const result = await getTeams();

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Chelsea');
    expect(result[0].code).toEqual('CHE');
    expect(result[0].logo_url).toBeNull();
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should return teams with correct data types', async () => {
    // Insert a single team
    await db.insert(teamsTable)
      .values([testTeams[0]])
      .execute();

    const result = await getTeams();

    expect(result).toHaveLength(1);
    const team = result[0];
    
    // Verify correct types
    expect(typeof team.id).toBe('number');
    expect(typeof team.name).toBe('string');
    expect(typeof team.code).toBe('string');
    expect(team.logo_url === null || typeof team.logo_url === 'string').toBe(true);
    expect(team.created_at).toBeInstanceOf(Date);
  });

  it('should maintain consistent ordering with multiple fetches', async () => {
    // Insert teams in different order
    const unorderedTeams = [testTeams[2], testTeams[0], testTeams[1]]; // Liverpool, Man Utd, Arsenal
    
    await db.insert(teamsTable)
      .values(unorderedTeams)
      .execute();

    // Fetch multiple times to ensure consistent ordering
    const result1 = await getTeams();
    const result2 = await getTeams();

    expect(result1).toHaveLength(3);
    expect(result2).toHaveLength(3);
    
    // Both results should have same order: Arsenal, Liverpool, Manchester United
    expect(result1.map(t => t.name)).toEqual(result2.map(t => t.name));
    expect(result1[0].name).toEqual('Arsenal');
    expect(result1[1].name).toEqual('Liverpool');
    expect(result1[2].name).toEqual('Manchester United');
  });
});