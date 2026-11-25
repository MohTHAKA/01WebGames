import { describe, expect, it } from 'vitest';

import { gameLevelInfo } from './game-levels.ts';
import type { ProgressStore, TaskProgress } from './progress.ts';
import { unityIdFor } from './unity-bridge.ts';

const storeWith = (completed: number[]): ProgressStore => ({
    isTaskCompleted: (id) => completed.includes(id),
    load: () => ({ completed: false, trialUnits: [], workspace: null }) satisfies TaskProgress,
    save: () => undefined
});

describe('unityIdFor', () => {
    it('names a lesson the way the Unity menu does', () => {
        expect(unityIdFor(storeWith([]), 1)).toBe('task-01');
        expect(unityIdFor(storeWith([]), 48)).toBe('task-48');
    });

    it('reports a game only after its last level is completed', () => {
        const levels = gameLevelInfo.filter((l) => l.gameId === 'code-quest').map((l) => l.id);
        expect(unityIdFor(storeWith(levels.slice(0, -1)), levels[0])).toBeNull();
        expect(unityIdFor(storeWith(levels), levels[levels.length - 1])).toBe('game-code-quest');
    });

    it('ignores an unknown level id', () => {
        expect(unityIdFor(storeWith([]), 99999)).toBeNull();
    });
});
