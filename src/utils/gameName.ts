import { templates } from "@/lib/templates/registry";

/**
 * A session stores `templateId`, not the game's display name — the name is the
 * template's, and a session that outlives a renamed template should follow it.
 * Falls back to the id, so a session created by a template that no longer
 * ships still says something rather than nothing.
 */
export const gameName = (templateId: string): string =>
	templates.find((template) => template.id === templateId)?.name ?? templateId;
