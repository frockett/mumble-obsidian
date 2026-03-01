<script lang="ts">
	interface Props {
		startCount: number;
	}

	let { startCount }: Props = $props();

	let count = $derived(startCount);

	export function increment() {
		count += 1;
	}
</script>

<div class="number">
	<span>My number is {count}!</span>
	<button onclick={increment}>Increment</button>
</div>

<style>
	.number {
		color: red;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		height: 100%;
	}
</style>
