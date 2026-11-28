declare module "react" {
	interface CSSProperties {
		[key: `--${string}`]: number | string | null;
	}
}

export {};
