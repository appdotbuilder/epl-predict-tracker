import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createTeamInputSchema,
  createMatchInputSchema,
  updateMatchResultInputSchema,
  createPredictionInputSchema,
  createUserInputSchema,
  createBetInputSchema,
  getMatchesInputSchema,
  getUserBetsInputSchema
} from './schema';

// Import handlers
import { createTeam } from './handlers/create_team';
import { getTeams } from './handlers/get_teams';
import { createMatch } from './handlers/create_match';
import { getMatches } from './handlers/get_matches';
import { updateMatchResult } from './handlers/update_match_result';
import { createPrediction } from './handlers/create_prediction';
import { getPredictions } from './handlers/get_predictions';
import { createUser } from './handlers/create_user';
import { getUser } from './handlers/get_user';
import { createBet } from './handlers/create_bet';
import { getUserBets } from './handlers/get_user_bets';
import { settleBets } from './handlers/settle_bets';
import { getUserStats } from './handlers/get_user_stats';
import { getUpcomingMatchesWithPredictions } from './handlers/get_upcoming_matches_with_predictions';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Team operations
  createTeam: publicProcedure
    .input(createTeamInputSchema)
    .mutation(({ input }) => createTeam(input)),

  getTeams: publicProcedure
    .query(() => getTeams()),

  // Match operations
  createMatch: publicProcedure
    .input(createMatchInputSchema)
    .mutation(({ input }) => createMatch(input)),

  getMatches: publicProcedure
    .input(getMatchesInputSchema)
    .query(({ input }) => getMatches(input)),

  updateMatchResult: publicProcedure
    .input(updateMatchResultInputSchema)
    .mutation(({ input }) => updateMatchResult(input)),

  // Main application endpoint - upcoming matches with predictions
  getUpcomingMatchesWithPredictions: publicProcedure
    .input(z.object({ limit: z.number().int().positive().default(10) }))
    .query(({ input }) => getUpcomingMatchesWithPredictions(input.limit)),

  // Prediction operations
  createPrediction: publicProcedure
    .input(createPredictionInputSchema)
    .mutation(({ input }) => createPrediction(input)),

  getPredictions: publicProcedure
    .input(z.object({ matchId: z.number().optional() }))
    .query(({ input }) => getPredictions(input.matchId)),

  // User operations
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),

  getUser: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getUser(input.userId)),

  getUserStats: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getUserStats(input.userId)),

  // Betting operations
  createBet: publicProcedure
    .input(createBetInputSchema)
    .mutation(({ input }) => createBet(input)),

  getUserBets: publicProcedure
    .input(getUserBetsInputSchema)
    .query(({ input }) => getUserBets(input)),

  // Administrative operations
  settleBets: publicProcedure
    .input(z.object({ matchId: z.number() }))
    .mutation(({ input }) => settleBets(input.matchId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`EPL Predictions TRPC server listening at port: ${port}`);
}

start();