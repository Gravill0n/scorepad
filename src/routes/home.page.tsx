import { Description, Header, Label, ListBox, Separator } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useGetAllGameSessions } from "@/data/queries/gameSessions";

export const Route = createFileRoute("/")({
	component: Home,
	context: ({ context }) => ({ queryClient: context.queryClient }),
});

function Home() {
	const { queryClient } = Route.useRouteContext();

	const { data: gameSessions } = useGetAllGameSessions(queryClient);

	return (
		<main>
			<h1>Board Game Counter</h1>
			<p>Track scores for any board game, anywhere.</p>
			<Separator />
			<Header>Games Sessions :</Header>
			<ListBox
				aria-label="Game sessions"
				className="w-full p-2"
				selectionMode="none"
				// onAction={(key) => alert(`Selected item: ${key}`)}
			>
				{gameSessions?.map((session) => (
					<ListBox.Item key={session.id}>
						<div className="flex flex-col">
							<Label>{session.name}</Label>
							<Description>
								{session.nbPlayers} players · {session.status}
							</Description>
						</div>
					</ListBox.Item>
				))}
			</ListBox>
		</main>
	);
}
