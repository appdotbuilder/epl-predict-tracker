import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { getUser } from '../handlers/get_user';
import { eq } from 'drizzle-orm';

describe('getUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user when found', async () => {
    // Create test user
    const insertResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        total_balance: '1000.50'
      })
      .returning()
      .execute();

    const insertedUser = insertResult[0];
    
    // Get user by ID
    const result = await getUser(insertedUser.id);

    // Verify user data
    expect(result).toBeDefined();
    expect(result!.id).toEqual(insertedUser.id);
    expect(result!.username).toEqual('testuser');
    expect(result!.email).toEqual('test@example.com');
    expect(result!.total_balance).toEqual(1000.50);
    expect(typeof result!.total_balance).toBe('number'); // Verify numeric conversion
    expect(result!.created_at).toBeInstanceOf(Date);
  });

  it('should return null when user not found', async () => {
    // Try to get non-existent user
    const result = await getUser(999);

    expect(result).toBeNull();
  });

  it('should handle user with default balance correctly', async () => {
    // Create user without specifying balance (should use default)
    const insertResult = await db.insert(usersTable)
      .values({
        username: 'defaultuser',
        email: 'default@example.com'
        // total_balance will use default value from schema
      })
      .returning()
      .execute();

    const insertedUser = insertResult[0];
    
    // Get user by ID
    const result = await getUser(insertedUser.id);

    // Verify default balance is applied and converted correctly
    expect(result).toBeDefined();
    expect(result!.total_balance).toEqual(1000.00); // Default from schema
    expect(typeof result!.total_balance).toBe('number');
  });

  it('should handle user with zero balance correctly', async () => {
    // Create user with zero balance
    const insertResult = await db.insert(usersTable)
      .values({
        username: 'zerouser',
        email: 'zero@example.com',
        total_balance: '0.00'
      })
      .returning()
      .execute();

    const insertedUser = insertResult[0];
    
    // Get user by ID
    const result = await getUser(insertedUser.id);

    // Verify zero balance is handled correctly
    expect(result).toBeDefined();
    expect(result!.total_balance).toEqual(0);
    expect(typeof result!.total_balance).toBe('number');
  });

  it('should handle user with decimal balance correctly', async () => {
    // Create user with precise decimal balance
    const insertResult = await db.insert(usersTable)
      .values({
        username: 'decimaluser',
        email: 'decimal@example.com',
        total_balance: '123.45'
      })
      .returning()
      .execute();

    const insertedUser = insertResult[0];
    
    // Get user by ID
    const result = await getUser(insertedUser.id);

    // Verify decimal balance is preserved
    expect(result).toBeDefined();
    expect(result!.total_balance).toEqual(123.45);
    expect(typeof result!.total_balance).toBe('number');
  });

  it('should verify user exists in database after retrieval', async () => {
    // Create test user
    const insertResult = await db.insert(usersTable)
      .values({
        username: 'verifyuser',
        email: 'verify@example.com',
        total_balance: '500.75'
      })
      .returning()
      .execute();

    const insertedUser = insertResult[0];
    
    // Get user via handler
    const result = await getUser(insertedUser.id);

    // Verify user exists in database with correct data
    const dbUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, insertedUser.id))
      .execute();

    expect(dbUsers).toHaveLength(1);
    expect(dbUsers[0].username).toEqual('verifyuser');
    expect(dbUsers[0].email).toEqual('verify@example.com');
    expect(parseFloat(dbUsers[0].total_balance)).toEqual(500.75);
    
    // Compare handler result with database content
    expect(result!.username).toEqual(dbUsers[0].username);
    expect(result!.email).toEqual(dbUsers[0].email);
    expect(result!.total_balance).toEqual(parseFloat(dbUsers[0].total_balance));
  });
});