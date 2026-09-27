<script lang="ts">
	import { BEATS, SHAPES, type RpsShape, type RpsVariant } from '$lib/rps';
	import RpsIcon from './RpsIcon.svelte';

	let { variant, onclose }: { variant: RpsVariant; onclose: () => void } = $props();

	const W = 320;
	const H = 300;
	const R = 40;

	// Node positions (in the 320×300 box) — the same arrangement as the picker.
	const POS: Record<RpsVariant, Partial<Record<RpsShape, [number, number]>>> = {
		classic: { paper: [70, 70], scissors: [250, 70], rock: [160, 230] },
		spock: {
			scissors: [160, 48],
			paper: [276, 132],
			rock: [232, 252],
			lizard: [88, 252],
			spock: [44, 132]
		}
	};

	// One arrow per "X beats Y", trimmed so it runs edge-to-edge between discs.
	const arrows = $derived(
		SHAPES[variant].flatMap((from) =>
			BEATS[from]
				.filter((to) => POS[variant][to])
				.map((to) => {
					const [x1, y1] = POS[variant][from]!;
					const [x2, y2] = POS[variant][to]!;
					const len = Math.hypot(x2 - x1, y2 - y1);
					const ux = (x2 - x1) / len;
					const uy = (y2 - y1) / len;
					const pad = R + 8;
					return {
						key: `${from}-${to}`,
						x1: x1 + ux * pad,
						y1: y1 + uy * pad,
						x2: x2 - ux * pad,
						y2: y2 - uy * pad
					};
				})
		)
	);

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window {onkeydown} />

<div
	class="fixed inset-0 z-50 grid place-items-center bg-black/50 max-sm:bg-white"
	role="presentation"
	onclick={(e) => e.target === e.currentTarget && onclose()}
>
	<div
		role="dialog"
		aria-modal="true"
		aria-labelledby="rps-rules-title"
		class="relative flex w-[400px] flex-col rounded-lg bg-white p-8 max-sm:h-full max-sm:w-full max-sm:items-center max-sm:justify-between max-sm:rounded-none max-sm:py-20"
		style="font-family:var(--font-rps)"
	>
		<h2
			id="rps-rules-title"
			class="text-[32px] leading-none font-bold uppercase"
			style="color:var(--color-rps-ink)"
		>
			Rules
		</h2>

		<svg
			viewBox="0 0 {W} {H}"
			class="mt-8 w-full max-w-[320px]"
			role="img"
			aria-label="Which shape beats which"
		>
			<defs>
				<marker
					id="rps-arrow"
					viewBox="0 0 10 10"
					refX="8"
					refY="5"
					markerWidth="6"
					markerHeight="6"
					orient="auto-start-reverse"
				>
					<path
						d="M0 0 L10 5 L0 10"
						fill="none"
						stroke="var(--color-rps-disc-shade)"
						stroke-width="2"
					/>
				</marker>
			</defs>
			{#each arrows as a (a.key)}
				<line
					x1={a.x1}
					y1={a.y1}
					x2={a.x2}
					y2={a.y2}
					stroke="var(--color-rps-disc-shade)"
					stroke-width="2.5"
					marker-end="url(#rps-arrow)"
				/>
			{/each}
			{#each SHAPES[variant] as shape (shape)}
				{@const [cx, cy] = POS[variant][shape]!}
				<circle {cx} {cy} r={R} fill="var(--color-rps-disc-shade)" />
				<circle {cx} {cy} r={R - 9} fill="var(--color-rps-disc)" />
				<g style="color:var(--color-rps-ink);opacity:0.55">
					<RpsIcon {shape} size={34} x={cx - 17} y={cy - 17} />
				</g>
			{/each}
		</svg>

		<p
			class="mt-4 text-center text-sm font-semibold tracking-wide uppercase"
			style="color:var(--color-rps-disc-shade)"
		>
			Each arrow points at what it beats
		</p>

		<button
			type="button"
			onclick={onclose}
			aria-label="Close rules"
			class="absolute top-8 right-8 cursor-pointer text-3xl leading-none opacity-40 transition hover:opacity-100 max-sm:static max-sm:mt-8"
			style="color:var(--color-rps-ink)">✕</button
		>
	</div>
</div>
