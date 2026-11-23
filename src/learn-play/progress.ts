export type UnitStatus = 'not-started' | 'in-progress' | 'completed';

export interface TaskProgress {
    completed: boolean;
    /** Trial keys (units or speed bands) already satisfied in a sub-trial mission. */
    trialUnits: string[];
    /** Blockly serialization state, or null. */
    workspace: unknown;
}

/** Replaceable progress interface. No ZERO1 progress API was found, so only a local store exists. */
export interface ProgressStore {
    isTaskCompleted(taskId: number): boolean;
    load(taskId: number): TaskProgress;
    save(taskId: number, progress: TaskProgress): void;
}

const STORAGE_KEY = 'zero1.learnplay.progress.v1';
const TRIAL_KEYS: readonly string[] = ['rotations', 'seconds', 'degrees', 'slow', 'fast'];

const empty = (): TaskProgress => ({ completed: false, trialUnits: [], workspace: null });

export class LocalProgressStore implements ProgressStore {
    private data: Record<string, TaskProgress> = {};

    constructor() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed: unknown = raw ? JSON.parse(raw) : {};
            if (typeof parsed === 'object' && parsed !== null) {
                for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
                    this.data[k] = this.sanitize(v);
                }
            }
        } catch {
            // corrupt or unavailable storage: start empty
        }
    }

    private sanitize(v: unknown): TaskProgress {
        const o = typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
        const units = Array.isArray(o.trialUnits)
            ? (o.trialUnits.filter((u) => typeof u === 'string' && TRIAL_KEYS.includes(u)) as string[])
            : [];
        return { completed: o.completed === true, trialUnits: units, workspace: o.workspace ?? null };
    }

    isTaskCompleted(taskId: number): boolean {
        return this.data[String(taskId)]?.completed === true;
    }

    load(taskId: number): TaskProgress {
        const p = this.data[String(taskId)];
        return p ? { ...p, trialUnits: [...p.trialUnits] } : empty();
    }

    save(taskId: number, progress: TaskProgress): void {
        this.data[String(taskId)] = progress;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        } catch {
            // storage full or unavailable: progress stays in memory for this session
        }
    }
}

export const unitStatus = (store: ProgressStore, taskIds: number[]): UnitStatus => {
    const done = taskIds.filter((id) => store.isTaskCompleted(id)).length;
    if (done === 0) return 'not-started';
    return done === taskIds.length ? 'completed' : 'in-progress';
};
