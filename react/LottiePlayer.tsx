import "./LottiePlayer.scss";
import { type ReactNode, useEffect, useRef, useState } from "react";
import Lottix from "../utils/lottix";

export type LottiePlayerProps = {
	src?: string;
	data?: string;
	speed?: number;
	autoplay?: boolean;
	loop?: boolean;
	fallback?: ReactNode;
	playOnClick?: boolean;
	outline?: string;
};

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
}: LottiePlayerProps) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	const [loaded, setLoaded] = useState(false);
	const lottixRef = useRef<Lottix | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;

		const timer = setTimeout(() => {
			if (!canvas) return;

			const lottix = new Lottix({
				canvas,
				src: data
					? new TextEncoder().encode(data)
					: (LottiePlayerFileCache[src!] ?? src!),
				autoPlay: autoplay,
				loop,
				renderer: "sw",
				speed,
			});

			lottixRef.current = lottix;

			lottix.on("load", () => setLoaded(true));

			if (!(playOnClick || loop)) {
				lottix.on("complete", () => {
					if (!lottix) return;
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
	}, [src, autoplay, loop, playOnClick, speed]);

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
		>
			{!loaded &&
				fallback &&
				!((src ?? "") in LottiePlayerFileCache) &&
				fallback}

			{!loaded && <Outline />}

			<canvas
				ref={canvasRef}
				style={{ visibility: loaded ? "visible" : "hidden" }}
			/>
		</div>
	);
};

export default LottiePlayer;
