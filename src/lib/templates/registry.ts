import type { Template } from "@/types/template";
import sevenWonders from "./7-wonders.json";
import azul from "./azul.json";
import belote from "./belote.json";
import blackLady from "./black-lady.json";
import catan from "./catan.json";
import counter from "./counter.json";
import splendor from "./splendor.json";
import ticketToRide from "./ticket-to-ride.json";
import uno from "./uno.json";
import whist from "./whist.json";
import wingspan from "./wingspan.json";

/**
 * The ordered list the shelf renders: board games, then card games, then the
 * counter. Imported directly rather than through a barrel or a glob, so the
 * bundler sees every template statically and nothing is fetched at runtime.
 */
export const templates: Template[] = [
	catan,
	splendor,
	wingspan,
	azul,
	ticketToRide,
	sevenWonders,
	uno,
	belote,
	whist,
	blackLady,
	counter,
] as Template[];
