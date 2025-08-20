import { z } from 'zod';

// Team schema
export const teamSchema = z.object({
  id: z.number(),
  name: z.string(),
  code: z.string(), // Short code like "MAN", "LIV", etc.
  logo_url: z.string().nullable(),
  created_at: z.coerce.date()
});

export type Team = z.infer<typeof teamSchema>;

// Match schema
export const matchSchema = z.object({
  id: z.number(),
  home_team_id: z.number(),
  away_team_id: z.number(),
  match_date: z.coerce.date(),
  home_score: z.number().int().nullable(), // null if match hasn't been played
  away_score: z.number().int().nullable(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'postponed']),
  gameweek: z.number().int(),
  season: z.string(), // e.g., "2024-25"
  created_at: z.coerce.date()
});

export type Match = z.infer<typeof matchSchema>;

// AI Prediction schema
export const predictionSchema = z.object({
  id: z.number(),
  match_id: z.number(),
  predicted_outcome: z.enum(['home_win', 'draw', 'away_win']),
  confidence_percentage: z.number().min(0).max(100),
  predicted_home_score: z.number().nullable(),
  predicted_away_score: z.number().nullable(),
  reasoning: z.string().nullable(), // AI's reasoning for the prediction
  model_version: z.string(), // Track which AI model version made the prediction
  created_at: z.coerce.date()
});

export type Prediction = z.infer<typeof predictionSchema>;

// User schema for bet tracking
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  total_balance: z.number(), // Virtual currency for simulated betting
  created_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Simulated bet schema
export const betSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  prediction_id: z.number(),
  amount: z.number().positive(),
  bet_type: z.enum(['outcome', 'over_under', 'both_teams_score']),
  bet_value: z.string(), // "home_win", "over_2.5", "yes", etc.
  odds: z.number().positive(), // Simulated odds
  potential_return: z.number(),
  status: z.enum(['pending', 'won', 'lost']),
  settled_at: z.coerce.date().nullable(),
  created_at: z.coerce.date()
});

export type Bet = z.infer<typeof betSchema>;

// Input schemas for creating/updating entities

// Create team input
export const createTeamInputSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(2).max(4),
  logo_url: z.string().url().nullable()
});

export type CreateTeamInput = z.infer<typeof createTeamInputSchema>;

// Create match input
export const createMatchInputSchema = z.object({
  home_team_id: z.number(),
  away_team_id: z.number(),
  match_date: z.coerce.date(),
  gameweek: z.number().int().positive(),
  season: z.string().min(1)
});

export type CreateMatchInput = z.infer<typeof createMatchInputSchema>;

// Update match result input
export const updateMatchResultInputSchema = z.object({
  id: z.number(),
  home_score: z.number().int().nonnegative(),
  away_score: z.number().int().nonnegative(),
  status: z.enum(['completed'])
});

export type UpdateMatchResultInput = z.infer<typeof updateMatchResultInputSchema>;

// Create prediction input
export const createPredictionInputSchema = z.object({
  match_id: z.number(),
  predicted_outcome: z.enum(['home_win', 'draw', 'away_win']),
  confidence_percentage: z.number().min(0).max(100),
  predicted_home_score: z.number().nullable(),
  predicted_away_score: z.number().nullable(),
  reasoning: z.string().nullable(),
  model_version: z.string().min(1)
});

export type CreatePredictionInput = z.infer<typeof createPredictionInputSchema>;

// Create user input
export const createUserInputSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  total_balance: z.number().nonnegative().default(1000) // Default virtual balance
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

// Create bet input
export const createBetInputSchema = z.object({
  user_id: z.number(),
  prediction_id: z.number(),
  amount: z.number().positive(),
  bet_type: z.enum(['outcome', 'over_under', 'both_teams_score']),
  bet_value: z.string().min(1),
  odds: z.number().positive()
});

export type CreateBetInput = z.infer<typeof createBetInputSchema>;

// Query input schemas
export const getMatchesInputSchema = z.object({
  gameweek: z.number().int().positive().optional(),
  season: z.string().optional(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'postponed']).optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0)
});

export type GetMatchesInput = z.infer<typeof getMatchesInputSchema>;

export const getUserBetsInputSchema = z.object({
  user_id: z.number(),
  status: z.enum(['pending', 'won', 'lost']).optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0)
});

export type GetUserBetsInput = z.infer<typeof getUserBetsInputSchema>;