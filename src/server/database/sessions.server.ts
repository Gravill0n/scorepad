import { prisma } from "@/db";

export const getAllSessions = async () => {
	return await prisma.gameSession.findMany();
};
