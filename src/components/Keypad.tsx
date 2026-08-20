import { Delete } from "lucide-react";
import { m } from "@/paraglide/messages";
import {
	backspace,
	type KeypadValue,
	pressDigit,
	toggleSign,
} from "@/utils/keypadValue";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

const KEY =
	"flex h-[var(--h-key)] items-center justify-center rounded-ctrl border border-line";

/**
 * The app's only number entry (`1j`, `2c`). **Never an `<input>`**: the system
 * keyboard has unpredictable height, no room for ± or a hand-over button, and
 * no way to say whose number is being typed — which is the whole pass-the-phone
 * affordance.
 *
 * The keys write to state through the pure rules in `utils/keypadValue`, so
 * "empty is not zero" is decided in one tested place rather than here.
 */
export const Keypad = ({
	value,
	onChange,
}: {
	value: KeypadValue;
	onChange: (next: KeypadValue) => void;
}) => (
	<div className="grid grid-cols-3 gap-2">
		{DIGITS.map((digit) => (
			<button
				key={digit}
				type="button"
				onClick={() => onChange(pressDigit(value, digit))}
				className={`${KEY} num bg-card text-cell font-[var(--weight-medium)] text-ink`}
			>
				{digit}
			</button>
		))}

		<button
			type="button"
			onClick={() => onChange(toggleSign(value))}
			aria-label={m.keypad_sign()}
			className={`${KEY} bg-paper-dim text-cell font-[var(--weight-medium)] text-ink-soft`}
		>
			±
		</button>

		<button
			type="button"
			onClick={() => onChange(pressDigit(value, "0"))}
			className={`${KEY} num bg-card text-cell font-[var(--weight-medium)] text-ink`}
		>
			0
		</button>

		<button
			type="button"
			onClick={() => onChange(backspace(value))}
			aria-label={m.keypad_backspace()}
			className={`${KEY} bg-paper-dim text-ink-soft`}
		>
			<Delete size={22} aria-hidden="true" />
		</button>
	</div>
);
