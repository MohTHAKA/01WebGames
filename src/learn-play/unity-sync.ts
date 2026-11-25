import type { ProgressStore } from './progress.ts';

/** The Unity lessons app serves its progress on the first free port from here (see LocalLessonServer.cs). */
const FIRST_PORT = 8765;
const PORT_COUNT = 10;
const TASK_ID = /^task-(\d+)$/;

let knownPort: number | null = null;

/** Marks every finished Unity lesson (`task-NN`) as completed here. Returns true when something new was marked. */
export const applyUnityProgress = (store: ProgressStore, data: unknown): boolean => {
    const completed = (data as { completed?: unknown } | null)?.completed;
    if (!Array.isArray(completed)) return false;
    let changed = false;
    for (const id of completed) {
        const match = typeof id === 'string' ? TASK_ID.exec(id) : null;
        if (!match) continue;
        const taskId = Number(match[1]);
        if (store.isTaskCompleted(taskId)) continue;
        store.save(taskId, { ...store.load(taskId), completed: true });
        changed = true;
    }
    return changed;
};

const read = async (port: number): Promise<unknown> => {
    const response = await fetch(`http://127.0.0.1:${port}/progress`, { signal: AbortSignal.timeout(800) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
};

/** Reads progress from the Unity app if it is running on this machine; quiet when it is not. */
export const syncFromUnity = async (store: ProgressStore): Promise<boolean> => {
    const ports = knownPort === null ? Array.from({ length: PORT_COUNT }, (_, i) => FIRST_PORT + i) : [knownPort];
    for (const port of ports) {
        try {
            const data = await read(port);
            knownPort = port;
            return applyUnityProgress(store, data);
        } catch {
            // nothing listening on this port
        }
    }
    knownPort = null;
    return false;
};
