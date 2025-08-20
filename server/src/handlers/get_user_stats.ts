import { db } from '../db';
import { usersTable, betsTable } from '../db/schema';
import { type User } from '../schema';
import { eq, and, count, sum, sql } from 'drizzle-orm';

interface UserStats {
    user: User;
    totalBets: number;
    wonBets: number;
    lostBets: number;
    pendingBets: number;
    winRate: number;
    totalWinnings: number;
    totalLosses: number;
    netProfit: number;
}

export const getUserStats = async (userId: number): Promise<UserStats | null> => {
    try {
        // First, check if user exists and get user data
        const userResults = await db.select()
            .from(usersTable)
            .where(eq(usersTable.id, userId))
            .execute();

        if (userResults.length === 0) {
            return null;
        }

        const user = {
            ...userResults[0],
            total_balance: parseFloat(userResults[0].total_balance)
        };

        // Get bet statistics using aggregation
        const statsResults = await db.select({
            totalBets: count(betsTable.id),
            wonBets: count(sql`CASE WHEN ${betsTable.status} = 'won' THEN 1 END`),
            lostBets: count(sql`CASE WHEN ${betsTable.status} = 'lost' THEN 1 END`),
            pendingBets: count(sql`CASE WHEN ${betsTable.status} = 'pending' THEN 1 END`),
            totalWinnings: sum(sql`CASE WHEN ${betsTable.status} = 'won' THEN ${betsTable.potential_return} - ${betsTable.amount} ELSE 0 END`),
            totalLosses: sum(sql`CASE WHEN ${betsTable.status} = 'lost' THEN ${betsTable.amount} ELSE 0 END`)
        })
        .from(betsTable)
        .where(eq(betsTable.user_id, userId))
        .execute();

        const stats = statsResults[0];

        // Convert numeric fields and handle null values
        const totalBets = stats.totalBets || 0;
        const wonBets = stats.wonBets || 0;
        const lostBets = stats.lostBets || 0;
        const pendingBets = stats.pendingBets || 0;
        const totalWinnings = stats.totalWinnings ? parseFloat(stats.totalWinnings) : 0;
        const totalLosses = stats.totalLosses ? parseFloat(stats.totalLosses) : 0;

        // Calculate derived metrics
        const settledBets = wonBets + lostBets;
        const winRate = settledBets > 0 ? (wonBets / settledBets) * 100 : 0;
        const netProfit = totalWinnings - totalLosses;

        return {
            user,
            totalBets,
            wonBets,
            lostBets,
            pendingBets,
            winRate: Math.round(winRate * 100) / 100, // Round to 2 decimal places
            totalWinnings,
            totalLosses,
            netProfit
        };
    } catch (error) {
        console.error('Get user stats failed:', error);
        throw error;
    }
};