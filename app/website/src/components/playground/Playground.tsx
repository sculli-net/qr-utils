import { useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { QR, QRError } from '@qr-util/core';
import { RenderQR } from '@qr-util/render';
import './playground.css';

/** Query parameter that holds the encoded data, so a link reopens the same code. */
const PARAM = 'data';
/** Pixel size of the preview plan (the SVG itself scales to its container). */
const PREVIEW_SIZE = 320;
const PNG_SIZE = 1024;
/** Above this many flipped modules the trace stops reading as a trace, so it is skipped. */
const MAX_TRACE = 4000;

const LANDMARK_TYPES = new Set(['finder', 'timing', 'alignment']);

type Grid = boolean[][];

interface Ready {
	kind: 'ready';
	qr: QR;
	renderer: RenderQR;
	svg: string;
	/** Dark modules as drawn, compared between renders to find what changed. */
	visible: Grid;
}

interface Empty {
	kind: 'empty';
	renderer: RenderQR;
	/** The symbol's skeleton: only finder, timing and alignment modules. */
	skeleton: string;
	visible: Grid;
}

interface Failed {
	kind: 'error';
	/** One product-voiced line naming the problem and the fix. */
	message: string;
	/** The library's own message, kept for the tooltip. */
	detail: string;
}

type Result = Ready | Empty | Failed;

const encoder = new TextEncoder();

/** One SVG path covering every listed module, in the renderer's pixel space. */
function modulePath(renderer: RenderQR, cells: Iterable<[number, number]>): string {
	const { moduleSize: m, originX, originY } = renderer.layout;
	let d = '';
	for (const [x, y] of cells) d += `M${originX + x * m} ${originY + y * m}h${m}v${m}h${-m}z`;
	return d;
}

/** Inset outlines for modules that turned light, so the trace reads as a diff. */
function moduleOutline(renderer: RenderQR, cells: Iterable<[number, number]>): { d: string; stroke: number } {
	const { moduleSize: m, originX, originY } = renderer.layout;
	const stroke = m * 0.2;
	const side = m - stroke;
	let d = '';
	for (const [x, y] of cells) d += `M${originX + x * m + stroke / 2} ${originY + y * m + stroke / 2}h${side}v${side}h${-side}z`;
	return { d, stroke };
}

function describeError(error: QRError): string {
	const match = /Data size \(bits\): (\d+);.*Available bits: (\d+) \(Version (\w+)\)/.exec(error.message);
	if (error.code === 'DATA_TOO_LARGE' && match) {
		const over = Math.ceil((Number(match[1]) - Number(match[2])) / 8);
		return `Too long: about ${over} ${over === 1 ? 'byte' : 'bytes'} over the largest code (version ${match[3]}). Shorten the text.`;
	}
	return error.message;
}

function buildEmpty(): Empty {
	const qr = new QR('');
	const renderer = new RenderQR(qr, { size: PREVIEW_SIZE });
	const types = qr.typeMatrix();
	const visible = qr.dotMatrix().map((row, y) => row.map((dark, x) => dark && LANDMARK_TYPES.has(types[y][x])));
	const cells: [number, number][] = [];
	visible.forEach((row, y) => row.forEach((dark, x) => dark && cells.push([x, y])));
	return { kind: 'empty', renderer, visible, skeleton: modulePath(renderer, cells) };
}

function build(data: string): Result {
	if (data === '') return buildEmpty();
	try {
		const qr = new QR(data);
		const renderer = new RenderQR(qr, { size: PREVIEW_SIZE });
		return { kind: 'ready', qr, renderer, svg: renderer.toSVG(), visible: qr.dotMatrix() };
	} catch (error) {
		if (error instanceof QRError) return { kind: 'error', message: describeError(error), detail: error.message };
		throw error;
	}
}

function readParam(): string {
	if (typeof window === 'undefined') return '';
	return new URLSearchParams(window.location.search).get(PARAM) ?? '';
}

function writeParam(data: string) {
	const url = new URL(window.location.href);
	if (data) url.searchParams.set(PARAM, data);
	else url.searchParams.delete(PARAM);
	if (url.href !== window.location.href) history.replaceState(history.state, '', url);
}

function prefersReducedMotion(): boolean {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type CopyState = 'idle' | 'copied' | 'failed';

export default function Playground() {
	const inputId = useId();
	const statusId = useId();
	const [data, setData] = useState('');
	const deferred = useDeferredValue(data);
	const result = useMemo(() => build(deferred), [deferred]);

	// The last result that produced a symbol stays on stage (dimmed) while the input is invalid
	const shownRef = useRef<Ready | Empty | null>(null);
	if (result.kind !== 'error') shownRef.current = result;
	const shown = shownRef.current ?? buildEmpty();

	const [trace, setTrace] = useState<{ id: number; on: string; off: string; stroke: number } | null>(null);
	const previous = useRef<Grid | null>(null);
	const [copy, setCopy] = useState<CopyState>('idle');

	useEffect(() => {
		const initial = readParam();
		if (initial) setData(initial);
	}, []);

	useEffect(() => {
		const timer = window.setTimeout(() => writeParam(deferred), 250);
		return () => window.clearTimeout(timer);
	}, [deferred]);

	// Trace the modules that flipped since the previous render. A size change redraws the
	// whole symbol, so it crossfades instead (see the key on the stage below).
	useLayoutEffect(() => {
		if (result.kind === 'error') return;
		const before = previous.current;
		previous.current = result.visible;
		if (!before || before.length !== result.visible.length || prefersReducedMotion()) return;
		const on: [number, number][] = [];
		const off: [number, number][] = [];
		result.visible.forEach((row, y) =>
			row.forEach((dark, x) => {
				if (dark !== before[y][x]) (dark ? on : off).push([x, y]);
			}),
		);
		const total = on.length + off.length;
		if (total === 0 || total > MAX_TRACE) return;
		const outline = moduleOutline(result.renderer, off);
		setTrace((last) => ({ id: (last?.id ?? 0) + 1, on: modulePath(result.renderer, on), off: outline.d, stroke: outline.stroke }));
	}, [result]);

	useEffect(() => {
		if (copy === 'idle') return;
		const timer = window.setTimeout(() => setCopy('idle'), 1600);
		return () => window.clearTimeout(timer);
	}, [copy]);

	const ready = result.kind === 'ready' ? result : null;
	// Spoken only when it changes: a new version, or an error, never every keystroke
	const announcement = result.kind === 'error' ? result.message : ready ? `Version ${ready.qr.version}, ${ready.qr.width} by ${ready.qr.height} modules` : '';
	const bytes = encoder.encode(data).length;
	const { width, height } = shown.renderer.layout;

	async function copySVG() {
		if (!ready) return;
		try {
			await navigator.clipboard.writeText(ready.svg);
			setCopy('copied');
		} catch {
			setCopy('failed');
		}
	}

	function downloadPNG() {
		if (!ready) return;
		const png = new RenderQR(ready.qr, { size: PNG_SIZE }).toPNG();
		const url = URL.createObjectURL(new Blob([png as Uint8Array<ArrayBuffer>], { type: 'image/png' }));
		const link = document.createElement('a');
		link.href = url;
		link.download = 'qr-code.png';
		link.click();
		URL.revokeObjectURL(url);
	}

	return (
		<section className="group/playground mx-auto flex w-full max-w-[24rem] flex-col gap-5" aria-label="QR code playground">
			<div className="relative aspect-square w-full" data-state={result.kind}>
				<span aria-hidden="true" className="qr-tick top-0 left-0 border-t border-l" />
				<span aria-hidden="true" className="qr-tick top-0 right-0 border-t border-r" />
				<span aria-hidden="true" className="qr-tick right-0 bottom-0 border-r border-b" />
				<span aria-hidden="true" className="qr-tick bottom-0 left-0 border-b border-l" />

				<div key={shown.kind === 'ready' ? `v${width}` : 'empty'} className="qr-stage relative h-full w-full">
					{shown.kind === 'ready' ? (
						<div
							role="img"
							aria-label={`QR code for: ${deferred}`}
							className="h-full w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
							dangerouslySetInnerHTML={{ __html: shown.svg }}
						/>
					) : (
						<svg viewBox={`0 0 ${width} ${height}`} className="block h-full w-full" role="img" aria-label="Empty QR code: only the finder, timing and alignment patterns">
							<path d={shown.skeleton} className="fill-neutral-200" shapeRendering="crispEdges" />
						</svg>
					)}
					{trace && (
						<svg key={trace.id} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="qr-trace pointer-events-none absolute inset-0 h-full w-full">
							<path d={trace.on} className="qr-trace-on" shapeRendering="crispEdges" />
							<path d={trace.off} className="qr-trace-off" strokeWidth={trace.stroke} shapeRendering="crispEdges" />
						</svg>
					)}
				</div>
			</div>

			{/* Two lines tall at all times, so a wrapped readout or an error never moves the input */}
			<div className="flex min-h-10 items-center justify-between gap-4">
				<div id={statusId} className="text-xs leading-5">
					{result.kind === 'error' ? (
						<p className="text-red-700" title={result.detail}>
							{result.message}
						</p>
					) : ready ? (
						<Readout qr={ready.qr} />
					) : (
						<p className="text-neutral-500">Nothing to encode yet</p>
					)}
				</div>
				<div className="flex shrink-0 gap-1">
					<IconButton label={copy === 'copied' ? 'Copied SVG' : copy === 'failed' ? 'Copy failed' : 'Copy SVG'} disabled={!ready} onClick={copySVG}>
						{copy === 'copied' ? <CheckIcon /> : <CopyIcon />}
					</IconButton>
					<IconButton label="Download PNG" disabled={!ready} onClick={downloadPNG}>
						<DownloadIcon />
					</IconButton>
				</div>
				<p className="sr-only" aria-live="polite">
					{announcement}
				</p>
				<p className="sr-only" aria-live="polite">
					{copy === 'copied' ? 'SVG copied to the clipboard' : copy === 'failed' ? 'Could not copy the SVG' : ''}
				</p>
			</div>

			<div className="flex flex-col gap-2">
				<div className="flex items-baseline justify-between">
					<label htmlFor={inputId} className="text-sm font-medium text-neutral-900">
						Data
					</label>
					<span className={`font-mono text-xs tabular-nums ${result.kind === 'error' ? 'text-red-700' : 'text-neutral-500'}`}>
						{bytes} {bytes === 1 ? 'byte' : 'bytes'}
					</span>
				</div>
				<textarea
					id={inputId}
					value={data}
					onChange={(event) => setData(event.target.value)}
					aria-describedby={statusId}
					aria-invalid={result.kind === 'error'}
					rows={3}
					spellCheck={false}
					autoComplete="off"
					placeholder="A URL, a message, anything"
					className="field-sizing-content max-h-64 min-h-[5.5rem] w-full resize-none rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-base leading-6 text-neutral-900 caret-amber-600 transition-[border-color,box-shadow] duration-150 placeholder:text-neutral-500 selection:bg-amber-200 hover:border-neutral-400 focus:border-neutral-900 focus:shadow-[0_0_0_3px_var(--color-amber-200)] focus:outline-none aria-invalid:border-red-600 aria-invalid:focus:shadow-[0_0_0_3px_var(--color-red-100)]"
				/>
			</div>
		</section>
	);
}

function Readout({ qr }: { qr: QR }) {
	const { usedBits, dataBits } = qr.capacity;
	const fill = `${Math.round((usedBits / dataBits) * 100)}%`;
	// Two nowrap groups, so a narrow column breaks between them and nowhere else
	return (
		<p className="flex flex-wrap gap-x-3 font-mono">
			<span className="flex gap-x-3 whitespace-nowrap">
				<Value label="version" value={String(qr.version)} />
				<Value label="ecc" value={qr.errorCorrection} />
				<Value label="mask" value={String(qr.maskPattern)} />
			</span>
			<span className="flex gap-x-3 whitespace-nowrap">
				<Value value={`${qr.width}×${qr.height}`} />
				<Value value={fill} label="full" after />
			</span>
		</p>
	);
}

/** A readout value. It flashes amber when it changes, like the modules it describes. */
function Value({ label, value, after = false }: { label?: string; value: string; after?: boolean }) {
	const text = (
		<span key={value} className="qr-value text-neutral-900 tabular-nums">
			{value}
		</span>
	);
	if (!label) return text;
	return (
		<span>
			{after ? text : <span className="text-neutral-500">{label}</span>} {after ? <span className="text-neutral-500">{label}</span> : text}
		</span>
	);
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			disabled={disabled}
			onClick={onClick}
			className="grid size-8 place-items-center rounded-md text-neutral-600 transition-colors duration-150 hover:bg-neutral-900/10 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 active:bg-neutral-900/15 disabled:pointer-events-none disabled:text-neutral-300 [&_svg]:size-4"
		>
			{children}
		</button>
	);
}

const iconProps = {
	xmlns: 'http://www.w3.org/2000/svg',
	viewBox: '0 0 24 24',
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth: 2,
	strokeLinecap: 'round',
	strokeLinejoin: 'round',
	'aria-hidden': true,
} as const;

function CopyIcon() {
	return (
		<svg {...iconProps}>
			<rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
			<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
		</svg>
	);
}

function CheckIcon() {
	return (
		<svg {...iconProps}>
			<path d="M20 6 9 17l-5-5" />
		</svg>
	);
}

function DownloadIcon() {
	return (
		<svg {...iconProps}>
			<path d="M12 15V3" />
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<path d="m7 10 5 5 5-5" />
		</svg>
	);
}
