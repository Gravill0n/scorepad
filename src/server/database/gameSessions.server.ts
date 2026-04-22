import { prisma } from "@/db";

export const getAllGameSessions = async () => {
	return await prisma.gameSession.findMany({ include: { players: true } });
};
