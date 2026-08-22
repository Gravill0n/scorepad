import { Eyebrow } from "@/components/Eyebrow";

/** An eyebrow over the 2px section rule (`1d`, `1h`). */
export const SectionHeading = ({ children }: { children: string }) => (
	<div className="border-line-strong border-b-2 pb-1.5">
		<Eyebrow>{children}</Eyebrow>
	</div>
);
