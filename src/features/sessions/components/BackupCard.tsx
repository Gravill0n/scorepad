import { Download } from "lucide-react";
import { Eyebrow } from "@/components/Eyebrow";
import { useSettings } from "@/hooks/useSettings";
import { m } from "@/paraglide/messages";
import { relativeTime } from "@/utils/relativeTime";
import { exportBackup } from "../api/backup";
import { ImportControl } from "./ImportControl";

/** The stamp turns advisory past a fortnight, per the spec. */
const STALE_AFTER_DAYS = 14;

const isStale = (iso: string | null | undefined, now: Date) =>
	!iso || now.getTime() - Date.parse(iso) > STALE_AFTER_DAYS * 86_400_000;

const ACTION =
	"flex h-[var(--h-tap)] flex-1 items-center justify-center gap-1.5 rounded-ctrl text-body font-[var(--weight-medium)]";

/**
 * Backup lives in the list, not behind a settings screen (`1d`). It is the only
 * backup this app has, and there is no settings screen to hide it in.
 */
export const BackupCard = ({
	sessionCount,
	lastExportedAt,
	onExported,
}: {
	sessionCount: number;
	lastExportedAt: string | null | undefined;
	onExported: (iso: string) => void;
}) => {
	const { locale } = useSettings();
	const now = new Date();
	const stale = isStale(lastExportedAt, now);

	return (
		<div className="mt-6 rounded-card border border-line bg-card p-3.5">
			<div className="flex items-baseline gap-2">
				<div className="flex-1">
					<Eyebrow>{m.backup_eyebrow()}</Eyebrow>
				</div>
				<span
					className={`font-mono text-eyebrow uppercase ${
						stale ? "text-advisory" : "text-accent"
					}`}
				>
					{relativeTime(lastExportedAt, now, locale)}
				</span>
			</div>

			<p className="mt-1.5 text-meta leading-normal text-ink text-pretty">
				{m.backup_summary({ count: sessionCount })}
			</p>

			<div className="mt-3 flex gap-2">
				<button
					type="button"
					className={`${ACTION} border border-accent text-accent`}
					onClick={() => {
						void exportBackup().then((backup) => onExported(backup.exportedAt));
					}}
				>
					<Download size={16} aria-hidden="true" />
					{m.backup_export()}
				</button>

				<ImportControl
					className={`${ACTION} border border-line text-ink`}
					label={m.backup_import()}
				/>
			</div>
		</div>
	);
};
