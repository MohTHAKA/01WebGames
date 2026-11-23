import { describe, expect, it } from 'vitest';

import { parseRoute } from './app.ts';
import { getTask, tasks, tasksOfUnit, units } from './curriculum.ts';

const EXPECTED_COUNTS = [7, 4, 7, 6, 8, 7, 9];

describe('curriculum integrity', () => {
    it('has 7 units and 48 tasks', () => {
        expect(units).toHaveLength(7);
        expect(tasks).toHaveLength(48);
    });

    it('uses task ids 1..48 exactly once', () => {
        expect(tasks.map((x) => x.id)).toEqual(Array.from({ length: 48 }, (_, i) => i + 1));
    });

    it('maps unit ranges and counts correctly', () => {
        units.forEach((u, i) => {
            const own = tasksOfUnit(u.id);
            expect(own).toHaveLength(EXPECTED_COUNTS[i]);
            expect(own[0].id).toBe(u.firstTask);
            expect(own[own.length - 1].id).toBe(u.lastTask);
        });
    });

    it('has both language headings for every unit', () => {
        for (const u of units) {
            expect(u.titleEn.length).toBeGreaterThan(0);
            expect(u.titleAr.length).toBeGreaterThan(0);
        }
    });

    it('has Arabic and English titles for Unit 1 tasks', () => {
        for (let id = 1; id <= 7; id++) {
            expect(getTask(id)?.titleAr).toBeTruthy();
            expect(getTask(id)?.titleEn).toBeTruthy();
        }
    });
});

describe('routing', () => {
    it('parses known routes', () => {
        expect(parseRoute('')).toEqual({ name: 'home' });
        expect(parseRoute('#/unit/3')).toEqual({ name: 'unit', id: 3 });
        expect(parseRoute('#/task/48')).toEqual({ name: 'task', id: 48 });
    });

    it('rejects unknown routes', () => {
        expect(parseRoute('#/unit/8')).toEqual({ name: 'notfound' });
        expect(parseRoute('#/task/49')).toEqual({ name: 'notfound' });
        expect(parseRoute('#/nope')).toEqual({ name: 'notfound' });
    });
});
