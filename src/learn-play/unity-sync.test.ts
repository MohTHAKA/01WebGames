import { describe, expect, it } from 'vitest';

import type { ProgressStore, TaskProgress } from './progress.ts';
import { applyUnityProgress } from './unity-sync.ts';

const memoryStore = (): ProgressStore => {
    const data = new Map<number, TaskProgress>();
    return {
        isTaskCompleted: (id) => data.get(id)?.completed === true,
        load: (id) => data.get(id) ?? { completed: false, trialUnits: [], workspace: null },
        save: (id, progress) => void data.set(id, progress)
    };
};

describe('applyUnityProgress', () => {
    it('marks finished Unity lessons as completed and reports the change', () => {
        const store = memoryStore();
        expect(applyUnityProgress(store, { completed: ['task-01', 'task-03', 'game-code-quest'] })).toBe(true);
        expect(store.isTaskCompleted(1)).toBe(true);
        expect(store.isTaskCompleted(2)).toBe(false);
        expect(store.isTaskCompleted(3)).toBe(true);
    });

    it('reports no change when everything is already marked', () => {
        const store = memoryStore();
        applyUnityProgress(store, { completed: ['task-02'] });
        expect(applyUnityProgress(store, { completed: ['task-02'] })).toBe(false);
    });

    it('ignores malformed data', () => {
        const store = memoryStore();
        expect(applyUnityProgress(store, null)).toBe(false);
        expect(applyUnityProgress(store, { completed: 'task-01' })).toBe(false);
        expect(applyUnityProgress(store, { completed: [1, null, 'task-x'] })).toBe(false);
    });
});
