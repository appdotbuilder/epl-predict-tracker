import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';

// Test inputs
const testInput: CreateUserInput = {
  username: 'testuser',
  email: 'testuser@example.com',
  total_balance: 1500
};

const minimalInput: CreateUserInput = {
  username: 'minimal',
  email: 'minimal@example.com',
  total_balance: 1000 // Zod default will be applied
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user with all fields', async () => {
    const result = await createUser(testInput);

    // Basic field validation
    expect(result.username).toEqual('testuser');
    expect(result.email).toEqual('testuser@example.com');
    expect(result.total_balance).toEqual(1500);
    expect(typeof result.total_balance).toBe('number'); // Verify numeric conversion
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a user with default balance', async () => {
    const result = await createUser(minimalInput);

    expect(result.username).toEqual('minimal');
    expect(result.email).toEqual('minimal@example.com');
    expect(result.total_balance).toEqual(1000);
    expect(typeof result.total_balance).toBe('number');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save user to database', async () => {
    const result = await createUser(testInput);

    // Query using proper drizzle syntax
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].username).toEqual('testuser');
    expect(users[0].email).toEqual('testuser@example.com');
    expect(parseFloat(users[0].total_balance)).toEqual(1500);
    expect(users[0].created_at).toBeInstanceOf(Date);
  });

  it('should enforce unique username constraint', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create user with same username but different email
    const duplicateUsernameInput: CreateUserInput = {
      username: 'testuser', // Same username
      email: 'different@example.com', // Different email
      total_balance: 2000
    };

    await expect(createUser(duplicateUsernameInput))
      .rejects.toThrow(/duplicate key value violates unique constraint/i);
  });

  it('should enforce unique email constraint', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create user with same email but different username
    const duplicateEmailInput: CreateUserInput = {
      username: 'differentuser', // Different username
      email: 'testuser@example.com', // Same email
      total_balance: 2000
    };

    await expect(createUser(duplicateEmailInput))
      .rejects.toThrow(/duplicate key value violates unique constraint/i);
  });

  it('should handle zero balance correctly', async () => {
    const zeroBalanceInput: CreateUserInput = {
      username: 'zerouser',
      email: 'zero@example.com',
      total_balance: 0
    };

    const result = await createUser(zeroBalanceInput);

    expect(result.total_balance).toEqual(0);
    expect(typeof result.total_balance).toBe('number');
  });

  it('should handle large balance amounts', async () => {
    const largeBalanceInput: CreateUserInput = {
      username: 'richuser',
      email: 'rich@example.com',
      total_balance: 99999.99
    };

    const result = await createUser(largeBalanceInput);

    expect(result.total_balance).toEqual(99999.99);
    expect(typeof result.total_balance).toBe('number');

    // Verify precision is maintained in database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(parseFloat(users[0].total_balance)).toEqual(99999.99);
  });

  it('should create multiple users successfully', async () => {
    const user1Input: CreateUserInput = {
      username: 'user1',
      email: 'user1@example.com',
      total_balance: 1000
    };

    const user2Input: CreateUserInput = {
      username: 'user2',
      email: 'user2@example.com',
      total_balance: 2000
    };

    const user1 = await createUser(user1Input);
    const user2 = await createUser(user2Input);

    expect(user1.id).not.toEqual(user2.id);
    expect(user1.username).toEqual('user1');
    expect(user2.username).toEqual('user2');
    expect(user1.total_balance).toEqual(1000);
    expect(user2.total_balance).toEqual(2000);

    // Verify both users exist in database
    const allUsers = await db.select().from(usersTable).execute();
    expect(allUsers).toHaveLength(2);
  });
});