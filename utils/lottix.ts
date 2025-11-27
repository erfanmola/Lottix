import { v4 } from "uuid";
import type {
	LottixWorkerMessage,
	LottixWorkerResponse,
} from "../workers/lottix.worker";
import { inflateWorker } from "./inflate";

export type LottixConfig = {
	src: string | Uint8Array;
	canvas: HTMLCanvasElement;
	renderer?: Renderer;
	autoPlay?: boolean;
	playMode?: PlayMode;
	loop?: boolean;
	count?: number;
	speed?: number;
	direction?: number;
	forceRender?: boolean;
};

export type Renderer = "sw" | "wg" | "gl";

export type PlayerState =
	| "destroyed"
	| "error"
	| "loading"
	| "paused"
	| "playing"
	| "stopped"
	| "complete"
	| "frozen";

export type PlayMode = "normal" | "bounce";

export type PlayerEvent =
	| "complete"
	| "destroyed"
	| "error"
	| "freeze"
	| "load"
	| "loop"
	| "pause"
	| "play"
	| "stop";

export type EventCallback = (...args: any[]) => void;

class LottixWorkers {
	private workers: Worker[] = [];
	private index = -1;

	private initPromise: Promise<void> | null = null;
	private initialized = false;

	public initialize(count: number): Promise<void> {
		if (this.initialized) return Promise.resolve();

		if (this.initPromise) return this.initPromise;

		this.initPromise = (async () => {
			for (let i = 0; i < count; i++) {
				const worker = new Worker(
					new URL("../workers/lottix.worker.ts", import.meta.url),
					{ type: "module" },
				);
				this.workers.push(worker);
			}

			this.initialized = true;
			this.initPromise = null;
		})();

		return this.initPromise;
	}

	public async getWorker(): Promise<Worker> {
		await this.initialize(this.workers.length || 1);

		this.index++;
		if (this.index === this.workers.length) {
			this.index = 0;
		}

		return this.workers[this.index];
	}
}

export const lottixWorkers = new LottixWorkers();

const lottixObserver = new IntersectionObserver((entries) => {
	for (const entry of entries) {
		const {
			target: { id },
		} = entry;
		lottixInstances[id]?.setObservability(entry.isIntersecting);
	}
});

const lottixInstances: { [key: string]: Lottix } = {};

class Lottix {
	private config: LottixConfig;
	private animationData: Uint8Array | undefined;
	private worker: Worker | undefined;
	private canvas: OffscreenCanvas;
	private id: string;

	public state: PlayerState = "loading";

	public frames = {
		current: 0,
		total: 0,
	};

	private listeners: Partial<Record<PlayerEvent, EventCallback[]>> = {};

	private workerMessageCallbackBinded: (
		message: MessageEvent<LottixWorkerResponse>,
	) => void;

	constructor(config: LottixConfig) {
		this.config = config;

		this.config.renderer ??= "sw";
		this.config.playMode ??= "normal";
		this.config.autoPlay ??= false;
		this.config.loop ??= false;
		this.config.speed ??= 1.0;
		this.config.direction ??= 1;

		this.id = v4();
		this.config.canvas.id = this.id;

		lottixInstances[this.id] = this;

		const { width, height } = this.config.canvas.getBoundingClientRect();

		if (width > 0) {
			this.config.canvas.width = width * window.devicePixelRatio;
		}

		if (height > 0) {
			this.config.canvas.height = height * window.devicePixelRatio;
		}

		this.canvas = this.config.canvas.transferControlToOffscreen();

		lottixObserver.observe(this.config.canvas);

		this.workerMessageCallbackBinded = this.workerMessageCallback.bind(this);

		this.init();
	}

	async init() {
		this.worker = await lottixWorkers.getWorker();
		this.worker?.addEventListener("message", this.workerMessageCallbackBinded);

		this.loadAnimation();
	}

	workerMessageCallback(message: MessageEvent<LottixWorkerResponse>) {
		const { data } = message;

		if (data.id !== this.id) return;

		switch (data.type) {
			case "event":
				this.frames = data.frames;
				this.emit(data.event);
				break;
			case "state":
				this.state = data.state;
				this.frames = data.frames;
				break;
		}
	}

	async loadAnimation() {
		if (typeof this.config.src === "string") {
			const request = await fetch(this.config.src);
			const buffer = await request.arrayBuffer();
			this.animationData = new Uint8Array(buffer);
		} else {
			this.animationData = new Uint8Array(this.config.src);
		}

		if (
			this.animationData[0] === 0x1f &&
			this.animationData[1] === 0x8b &&
			this.animationData[2] === 0x08
		) {
			this.animationData = await inflateWorker(this.animationData);
		}

		this.worker?.postMessage(
			{
				type: "init",
				id: this.id,
				config: {
					id: this.id,
					canvas: this.canvas,
					autoPlay: this.config.autoPlay,
					count: this.config.count,
					direction: this.config.direction,
					loop: this.config.loop,
					playMode: this.config.playMode,
					renderer: this.config.renderer,
					speed: this.config.speed,
					animationData: this.animationData,
				},
			} satisfies LottixWorkerMessage,
			[this.animationData.buffer, this.canvas],
		);
	}

	public play() {
		this.worker?.postMessage({
			type: "state",
			action: "play",
			id: this.id,
		} satisfies LottixWorkerMessage);
	}

	public seek(frame: number) {
		this.worker?.postMessage({
			type: "tweak",
			action: "seek",
			value: frame,
			id: this.id,
		} satisfies LottixWorkerMessage);
	}

	public playAt(frame: number) {
		this.worker?.postMessage({
			type: "tweak",
			action: "playAt",
			value: frame,
			id: this.id,
		} satisfies LottixWorkerMessage);
	}

	public pause() {
		this.worker?.postMessage({
			type: "state",
			action: "pause",
			id: this.id,
		} satisfies LottixWorkerMessage);
	}

	public stop() {
		this.worker?.postMessage({
			type: "state",
			action: "stop",
			id: this.id,
		} satisfies LottixWorkerMessage);
	}

	public setLooping(value: boolean): void {
		this.worker?.postMessage({
			type: "tweak",
			action: "looping",
			value: value,
			id: this.id,
		} satisfies LottixWorkerMessage);
	}

	public setDirection(value: number): void {
		this.worker?.postMessage({
			type: "tweak",
			action: "direction",
			value: value,
			id: this.id,
		} satisfies LottixWorkerMessage);
	}

	public setSpeed(value: number): void {
		this.worker?.postMessage({
			type: "tweak",
			action: "speed",
			value: value,
			id: this.id,
		} satisfies LottixWorkerMessage);
	}

	public on(event: PlayerEvent, callback: EventCallback): void {
		if (!this.listeners[event]) {
			this.listeners[event] = [];
		}
		this.listeners[event].push(callback);
	}

	public off(event: PlayerEvent, callback: EventCallback): void {
		const callbacks = this.listeners[event];
		if (!callbacks) return;
		this.listeners[event] = callbacks.filter((cb) => cb !== callback);
	}

	protected emit(event: PlayerEvent, ...args: any[]): void {
		const callbacks = this.listeners[event];
		if (!callbacks) return;
		for (const cb of callbacks) {
			cb(...args);
		}
	}

	public setObservability(observable: boolean) {
		this.worker?.postMessage({
			type: "observability",
			id: this.id,
			observable: observable,
		} satisfies LottixWorkerMessage);
	}

	public destroy(removeCanvas?: boolean): void {
		this.state = "destroyed";
		this.animationData = undefined;

		this.worker?.postMessage({
			type: "state",
			action: removeCanvas ? "demolish" : "destroy",
			id: this.id,
		} satisfies LottixWorkerMessage);

		this.worker?.removeEventListener(
			"message",
			this.workerMessageCallbackBinded,
		);

		lottixObserver.unobserve(this.config.canvas);

		if (removeCanvas) {
			this.config.canvas.remove();
		}

		delete lottixInstances[this.id];

		this.emit("destroyed");
	}
}

export default Lottix;
