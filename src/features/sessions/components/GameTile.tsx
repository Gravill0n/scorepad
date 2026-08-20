import { Link } from "@tanstack/react-router";
import type { Template } from "@/types/template";
import { templateMeta } from "../utils/templateMeta";
import { ModeBadge } from "./ModeBadge";
import { TileArt } from "./TileArt";

/** One game on the shelf (`1f`). The whole tile is the tap target. */
export const GameTile = ({ template }: { template: Template }) => (
	<li>
		<Link
			to="/new/players"
			search={{ template: template.id }}
			className="block overflow-hidden rounded-card border border-line bg-card"
		>
			<TileArt name={template.name} />
			<span className="flex flex-col gap-0.5 px-2.5 py-2">
				<span className="flex items-center gap-1.5">
					<span className="min-w-0 flex-1 truncate text-body leading-tight font-[var(--weight-semi)] text-ink">
						{template.name}
					</span>
					<ModeBadge mode={template.mode} />
				</span>
				<span className="truncate font-mono text-eyebrow leading-tight text-ink-soft">
					{templateMeta(template)}
				</span>
			</span>
		</Link>
	</li>
);
