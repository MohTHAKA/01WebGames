import data from './data/curriculum.json';

export type Lang = 'en' | 'ar';

export interface Unit {
    id: number;
    firstTask: number;
    lastTask: number;
    titleEn: string;
    titleAr: string;
    objectiveEn: string;
    objectiveAr: string;
}

export interface Task {
    id: number;
    unitId: number;
    /** null while the original text has not been transcribed. */
    titleAr: string | null;
    titleEn: string | null;
    /** True when the title is an editorial draft, not text from the original curriculum. */
    draft?: boolean;
}

export const units: readonly Unit[] = data.units;
export const tasks: readonly Task[] = data.tasks;

export const getUnit = (id: number): Unit | undefined => units.find((u) => u.id === id);
export const getTask = (id: number): Task | undefined => tasks.find((t) => t.id === id);
export const tasksOfUnit = (unitId: number): Task[] => tasks.filter((t) => t.unitId === unitId);

export const unitTitle = (u: Unit, lang: Lang): string => (lang === 'ar' ? u.titleAr : u.titleEn);
export const unitObjective = (u: Unit, lang: Lang): string => (lang === 'ar' ? u.objectiveAr : u.objectiveEn);

/** Returns the task title for the language, or null when the source text is still missing. */
export const taskTitle = (t: Task, lang: Lang): string | null => (lang === 'ar' ? t.titleAr : t.titleEn);
