import { serial, text, pgTable, timestamp, integer, numeric, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const matchStatusEnum = pgEnum('match_status', ['scheduled', 'in_progress', 'completed', 'postponed']);
export const predictionOutcomeEnum = pgEnum('prediction_outcome', ['home_win', 'draw', 'away_win']);
export const betTypeEnum = pgEnum('bet_type', ['outcome', 'over_under', 'both_teams_score']);
export const betStatusEnum = pgEnum('bet_status', ['pending', 'won', 'lost']);

// Teams table
export const teamsTable = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(), // Short code like "MAN", "LIV"
  logo_url: text('logo_url'), // Nullable by default
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Matches table
export const matchesTable = pgTable('matches', {
  id: serial('id').primaryKey(),
  home_team_id: integer('home_team_id').notNull().references(() => teamsTable.id),
  away_team_id: integer('away_team_id').notNull().references(() => teamsTable.id),
  match_date: timestamp('match_date').notNull(),
  home_score: integer('home_score'), // Nullable - null if match hasn't been played
  away_score: integer('away_score'), // Nullable - null if match hasn't been played
  status: matchStatusEnum('status').notNull().default('scheduled'),
  gameweek: integer('gameweek').notNull(),
  season: text('season').notNull(), // e.g., "2024-25"
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// AI Predictions table
export const predictionsTable = pgTable('predictions', {
  id: serial('id').primaryKey(),
  match_id: integer('match_id').notNull().references(() => matchesTable.id),
  predicted_outcome: predictionOutcomeEnum('predicted_outcome').notNull(),
  confidence_percentage: integer('confidence_percentage').notNull(), // 0-100
  predicted_home_score: integer('predicted_home_score'), // Nullable
  predicted_away_score: integer('predicted_away_score'), // Nullable
  reasoning: text('reasoning'), // AI's reasoning for the prediction
  model_version: text('model_version').notNull(), // Track which AI model version
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Users table for bet tracking
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  total_balance: numeric('total_balance', { precision: 10, scale: 2 }).notNull().default('1000.00'), // Virtual currency
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Simulated bets table
export const betsTable = pgTable('bets', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  prediction_id: integer('prediction_id').notNull().references(() => predictionsTable.id),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  bet_type: betTypeEnum('bet_type').notNull(),
  bet_value: text('bet_value').notNull(), // "home_win", "over_2.5", "yes", etc.
  odds: numeric('odds', { precision: 5, scale: 2 }).notNull(),
  potential_return: numeric('potential_return', { precision: 10, scale: 2 }).notNull(),
  status: betStatusEnum('status').notNull().default('pending'),
  settled_at: timestamp('settled_at'), // Nullable
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const teamsRelations = relations(teamsTable, ({ many }) => ({
  homeMatches: many(matchesTable, { relationName: 'homeTeam' }),
  awayMatches: many(matchesTable, { relationName: 'awayTeam' }),
}));

export const matchesRelations = relations(matchesTable, ({ one, many }) => ({
  homeTeam: one(teamsTable, {
    fields: [matchesTable.home_team_id],
    references: [teamsTable.id],
    relationName: 'homeTeam',
  }),
  awayTeam: one(teamsTable, {
    fields: [matchesTable.away_team_id],
    references: [teamsTable.id],
    relationName: 'awayTeam',
  }),
  predictions: many(predictionsTable),
}));

export const predictionsRelations = relations(predictionsTable, ({ one, many }) => ({
  match: one(matchesTable, {
    fields: [predictionsTable.match_id],
    references: [matchesTable.id],
  }),
  bets: many(betsTable),
}));

export const usersRelations = relations(usersTable, ({ many }) => ({
  bets: many(betsTable),
}));

export const betsRelations = relations(betsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [betsTable.user_id],
    references: [usersTable.id],
  }),
  prediction: one(predictionsTable, {
    fields: [betsTable.prediction_id],
    references: [predictionsTable.id],
  }),
}));

// TypeScript types for the table schemas
export type Team = typeof teamsTable.$inferSelect;
export type NewTeam = typeof teamsTable.$inferInsert;

export type Match = typeof matchesTable.$inferSelect;
export type NewMatch = typeof matchesTable.$inferInsert;

export type Prediction = typeof predictionsTable.$inferSelect;
export type NewPrediction = typeof predictionsTable.$inferInsert;

export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Bet = typeof betsTable.$inferSelect;
export type NewBet = typeof betsTable.$inferInsert;

// Export all tables for proper query building
export const tables = {
  teams: teamsTable,
  matches: matchesTable,
  predictions: predictionsTable,
  users: usersTable,
  bets: betsTable,
};