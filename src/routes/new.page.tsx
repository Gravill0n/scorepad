import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "@/components/BackLink";
import { ScreenHeader } from "@/components/ScreenHeader";
import { GameShelf } from "@/features/sessions/components/GameShelf";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/new")({ component: NewGame });

function NewGame() {
	return (
		<div className="flex h-dvh flex-col">
			<ScreenHeader title={m.picker_title()} leading={<BackLink to="/" />} />
			<GameShelf />
		</div>
	);
}
