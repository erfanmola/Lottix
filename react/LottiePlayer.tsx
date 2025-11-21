import "./LottiePlayer.scss";
import { type ReactNode, useEffect, useRef, useState } from "react";
import Lottix, { lottixWorkers } from "../utils/lottix";

interface LottiePlayerProps extends React.HTMLAttributes<HTMLDivElement> {
	src?: string;
	data?: string;
	speed?: number;
	autoplay?: boolean;
	loop?: boolean;
	fallback?: ReactNode;
	playOnClick?: boolean;
	outline?: string;
	preserveState?: boolean;
	lottixRefCallback?: (lottix: Lottix) => void;
}

export const LottiePlayerFileCache: { [key: string]: Uint8Array } = {};

const LottiePlayer = ({
	src,
	data,
	speed,
	autoplay,
	loop,
	fallback,
	playOnClick,
	outline,
	preserveState,
	lottixRefCallback,
	...others
}: LottiePlayerProps) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	const [loaded, setLoaded] = useState(false);
	const lottixRef = useRef<Lottix | null>(null);

	useEffect(() => {
		lottixWorkers.initialize(1);
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current;

		const timer = setTimeout(() => {
			if (!canvas) return;

			const lottix = new Lottix({
				canvas,
				src: data
					? new TextEncoder().encode(
							typeof data === "string" ? data : JSON.stringify(data),
						)
					: (LottiePlayerFileCache[src!] ?? src!),
				autoPlay: autoplay,
				loop,
				renderer: "sw",
				speed,
			});

			lottixRefCallback?.(lottix);

			lottixRef.current = lottix;

			lottix.on("load", () => setLoaded(true));

			if (!(playOnClick || loop)) {
				lottix.on("complete", () => {
					if (!lottix || preserveState) return;
					lottix.destroy();
				});
			}
		});

		return () => {
			clearTimeout(timer);
			const instance = lottixRef.current;
			if (instance && instance.state !== "destroyed") {
				instance.destroy(true);
			}
			lottixRef.current = null;
		};
	}, []);

	const onClickLottieAnimation = () => {
		const lottix = lottixRef.current;
		if (!(playOnClick && lottix)) return;
		if (lottix.state === "complete") lottix.play();
	};

	const Outline = () => {
		if (!outline) return null;
		return (
			<div
				className="shimmer"
				style={{
					maskImage: `url("data:image/svg+xml;base64,${btoa(outline)}")`,
				}}
			/>
		);
	};

	return (
		<div
			ref={containerRef}
			className="lottie-animation"
			onClick={onClickLottieAnimation}
			{...others}
		>
			{!loaded &&
				fallback &&
				!((src ?? "") in LottiePlayerFileCache) &&
				fallback}

			{!loaded && <Outline />}

			<canvas
				key={src ?? data ?? "default"}
				ref={canvasRef}
				style={{ visibility: loaded ? "visible" : "hidden" }}
			/>
		</div>
	);
};

export default LottiePlayer;
