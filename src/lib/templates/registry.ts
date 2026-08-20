import type { Template } from "@/types/template";
import sevenWonders from "./7-wonders.json";
import azul from "./azul.json";
import catan from "./catan.json";
import splendor from "./splendor.json";
import ticketToRide from "./ticket-to-ride.json";
import wingspan from "./wingspan.json";

/**
 * The ordered list the shelf renders. Imported directly rather than through a
 * barrel or a glob, so the bundler sees every template statically and nothing
 * is fetched at runtime.
 */
export const templates: Template[] = [
	catan,
	splendor,
	wingspan,
	azul,
	ticketToRide,
	sevenWonders,
] as Template[];
