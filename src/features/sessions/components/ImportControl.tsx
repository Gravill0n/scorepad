import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { m } from "@/paraglide/messages";
import {
	type ImportResult,
	InvalidBackupError,
	importBackup,
	readBackupFile,
} from "../api/backup";

const problemMessage = (reason: string) => {
	if (reason === "not-json") return m.backup_error_not_json();
	if (reason === "too-new") return m.backup_error_too_new();
	return m.backup_error_not_a_backup();
};

/**
 * One import control, used by the backup card and by the first-run footer. A
 * fresh device is exactly when somebody needs their JSON back, so the action
 * has to exist before there is a list to put a card in.
 */
export const ImportControl = ({
	className,
	label,
}: {
	className: string;
	/** The footer says "Import a backup"; the card says "Import". */
	label: string;
}) => {
	const fileInput = useRef<HTMLInputElement>(null);
	const [result, setResult] = useState<ImportResult | null>(null);
	const [problem, setProblem] = useState<string | null>(null);

	const onFile = async (file: File | undefined) => {
		if (!file) return;
		setProblem(null);
		setResult(null);
		try {
			setResult(await importBackup(await readBackupFile(file)));
		} catch (error) {
			setProblem(
				problemMessage(
					error instanceof InvalidBackupError ? error.reason : "not-a-backup",
				),
			);
		}
	};

	return (
		<>
			<button
				type="button"
				className={className}
				onClick={() => fileInput.current?.click()}
			>
				<Upload size={16} aria-hidden="true" />
				{label}
			</button>

			<input
				ref={fileInput}
				type="file"
				accept="application/json,.json"
				className="hidden"
				aria-label={label}
				onChange={(event) => {
					void onFile(event.target.files?.[0]);
					// Cleared so picking the same file again still fires: after a
					// rejected file is corrected on disk, the retry is the same
					// path, and a file input reports no change for that.
					event.target.value = "";
				}}
			/>

			{result && (
				<output className="text-meta text-ink-soft">
					{m.backup_imported({
						imported: result.imported,
						skipped: result.skipped,
					})}
					{result.rejected > 0
						? ` · ${m.backup_unreadable({ count: result.rejected })}`
						: ""}
				</output>
			)}

			{problem && (
				<p
					className="rounded-ctrl bg-alarm-bg p-2 text-meta text-alarm-ink"
					role="alert"
				>
					{problem}
				</p>
			)}
		</>
	);
};
