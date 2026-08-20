import { type Template, templateSchema } from "@/types/template";
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
 *
 * Parsed rather than cast. A cast would assert a shape TypeScript cannot see
 * inside a JSON file; parsing proves it. A malformed template throws here at
 * startup, which is the right outcome — silently dropping a game, or shipping
 * one whose `win` is misspelled, are both worse.
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
].map((template) => templateSchema.parse(template));
