import { v4 } from "uuid";
import type {
	InflateWorkerMessage,
	InflateWorkerResponse,
} from "../workers/inflate.worker";

const worker = new Worker(
	new URL("../workers/inflate.worker.ts", import.meta.url),
	{
		type: "module",
	},
);

export const inflateWorker = (buffer: Uint8Array) =>
	new Promise<Uint8Array>((resolve) => {
		const id = v4();

		const listener = (event: MessageEvent<InflateWorkerResponse>) => {
			if (event.data.id !== id) return;
			worker.removeEventListener("message", listener);
			resolve(event.data.buffer);
		};

		worker.addEventListener("message", listener);

		worker.postMessage({ id, buffer } satisfies InflateWorkerMessage, [
			buffer.buffer,
		]);
	});
