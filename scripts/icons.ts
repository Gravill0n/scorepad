/**
 * Generates the app icon at the sizes the manifest and iOS need.
 *
 * The icon is `1p`'s: four ink strokes and one accent diagonal — a tally of
 * five, the one mark that reads as "keeping score" in every language on the
 * box. The geometry below is the artboard's SVG, unit for unit, and the
 * colours are `tokens.css`'s, so a change to either is a change here.
 *
 * It rasterises rather than pulling in a renderer: five round-capped segments
 * and a rounded rectangle are a distance field, and a distance field is exact
 * at any size and antialiases for free. `bun run icons`.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

/** From tokens.css. */
const PAPER = [0xf6, 0xf1, 0xe7];
const INK = [0x2b, 0x26, 0x20];
const ACCENT = [0xa8, 0x43, 0x1d];

type Segment = { x1: number; y1: number; x2: number; y2: number; w: number };

/** `1p`, on its 24 × 24 viewBox: four uprights, then the stroke across them. */
const UPRIGHTS: Segment[] = [5, 9.5, 14, 18.5].map((x) => ({
	x1: x,
	y1: 5,
	x2: x,
	y2: 19,
	w: 1.8,
}));
const DIAGONAL: Segment = { x1: 21, y1: 7, x2: 3, y2: 17, w: 2.2 };

/** Distance from a point to a segment — round caps come free from this. */
const distanceToSegment = (
	px: number,
	py: number,
	{ x1, y1, x2, y2 }: Segment,
): number => {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const lengthSquared = dx * dx + dy * dy;
	const t =
		lengthSquared === 0
			? 0
			: Math.max(
					0,
					Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared),
				);
	return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
};

/** Signed distance to a rounded rectangle, negative inside. */
const distanceToRoundedRect = (
	px: number,
	py: number,
	size: number,
	radius: number,
): number => {
	const half = size / 2;
	const qx = Math.abs(px - half) - (half - radius);
	const qy = Math.abs(py - half) - (half - radius);
	return (
		Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
		Math.min(Math.max(qx, qy), 0) -
		radius
	);
};

/** One pixel of coverage from a distance, antialiased across a single pixel. */
const coverage = (distance: number) =>
	Math.max(0, Math.min(1, 0.5 - distance));

const over = (
	dst: number[],
	src: readonly number[],
	alpha: number,
): number[] => dst.map((channel, i) => channel * (1 - alpha) + (src[i] ?? 0) * alpha);

type Options = {
	size: number;
	/** The glyph's share of the edge. 0.625 on the tile, 0.45 inside a mask. */
	glyph: number;
	/** Corner radius as a share of the edge; 0 where the platform masks it. */
	radius: number;
};

const render = ({ size, glyph, radius }: Options): Buffer => {
	const pixels = Buffer.alloc(size * size * 4);
	const box = glyph * size;
	const offset = (size - box) / 2;
	const scale = box / 24;
	const cornerRadius = radius * size;

	for (let y = 0; y < size; y += 1) {
		for (let x = 0; x < size; x += 1) {
			const px = x + 0.5;
			const py = y + 0.5;

			// The tile, then the strokes on top of it, in the artboard's order.
			const ground =
				radius === 0
					? 1
					: coverage(distanceToRoundedRect(px, py, size, cornerRadius));
			let colour = [...PAPER];
			let alpha = ground;

			const vx = (px - offset) / scale;
			const vy = (py - offset) / scale;

			for (const segment of UPRIGHTS) {
				const hit = coverage(
					(distanceToSegment(vx, vy, segment) - segment.w / 2) * scale,
				);
				if (hit > 0) {
					colour = over(colour, INK, hit);
					alpha = Math.max(alpha, hit);
				}
			}

			const across = coverage(
				(distanceToSegment(vx, vy, DIAGONAL) - DIAGONAL.w / 2) * scale,
			);
			if (across > 0) {
				colour = over(colour, ACCENT, across);
				alpha = Math.max(alpha, across);
			}

			const at = (y * size + x) * 4;
			pixels[at] = Math.round(colour[0] ?? 0);
			pixels[at + 1] = Math.round(colour[1] ?? 0);
			pixels[at + 2] = Math.round(colour[2] ?? 0);
			pixels[at + 3] = Math.round(alpha * 255);
		}
	}

	return pixels;
};

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});

const crc32 = (buffer: Buffer): number => {
	let crc = 0xffffffff;
	for (const byte of buffer)
		crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Buffer): Buffer => {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([length, body, crc]);
};

const encodePng = (pixels: Buffer, size: number): Buffer => {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(size, 0);
	header.writeUInt32BE(size, 4);
	header[8] = 8; // bit depth
	header[9] = 6; // truecolour with alpha

	// One filter byte per scanline; filter 0 (none) — the image is tiny and
	// deflate does the work.
	const raw = Buffer.alloc(size * (size * 4 + 1));
	for (let y = 0; y < size; y += 1) {
		raw[y * (size * 4 + 1)] = 0;
		pixels.copy(
			raw,
			y * (size * 4 + 1) + 1,
			y * size * 4,
			(y + 1) * size * 4,
		);
	}

	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", header),
		chunk("IDAT", deflateSync(raw, { level: 9 })),
		chunk("IEND", Buffer.alloc(0)),
	]);
};

const ICONS: (Options & { file: string })[] = [
	// The tile, drawn as `1p` draws it: --radius-tile is 22% of the edge.
	{ file: "public/icon-192.png", size: 192, glyph: 0.625, radius: 0.22 },
	{ file: "public/icon-512.png", size: 512, glyph: 0.625, radius: 0.22 },
	// Maskable: full bleed, glyph inside the safe circle the OS may crop to.
	{ file: "public/icon-maskable-512.png", size: 512, glyph: 0.45, radius: 0 },
	// iOS applies its own squircle and drops transparency, so this is square.
	{ file: "public/apple-touch-icon.png", size: 180, glyph: 0.625, radius: 0 },
	{ file: "public/favicon-32.png", size: 32, glyph: 0.7, radius: 0.22 },
];

for (const { file, ...options } of ICONS) {
	writeFileSync(file, encodePng(render(options), options.size));
	console.log(`${file}  ${options.size}×${options.size}`);
}
