import type { Lang } from './curriculum.ts';

const strings = {
    en: {
        pageTitle: 'Learn & Play',
        intro: 'Learn to program the ZERO1 robot step by step, then put your skills to work in coding games.',
        learningPath: 'Learning Path',
        codingGames: 'Coding Games',
        tasks: 'tasks',
        exploreUnit: 'Explore Unit',
        notStarted: 'Not started',
        inProgress: 'In progress',
        completed: 'Completed',
        draft: 'Draft title',
        draftNote: 'The title and mission text are an editorial draft until the original curriculum text is added.',
        doneCount: 'done',
        nextUnit: 'Next unit',
        unit: 'Unit',
        task: 'Task',
        home: 'Home',
        events: 'Events',
        challenges: 'Challenges',
        support: 'Support',
        mainNav: 'Main navigation',
        breadcrumb: 'Breadcrumb',
        language: 'العربية',
        languageLabel: 'Switch language to Arabic',
        comingSoon: 'Coming Soon',
        concept: 'Concept',
        sourcePending: 'Original task text not yet added',
        openTask: 'Open task',
        missionSoon: 'This mission is not available yet.',
        loadingMission: 'Loading mission…',
        missionError: 'The mission could not be loaded.',
        backToUnit: 'Back to unit',
        notFound: 'Page not found',
        backHome: 'Back to Learn & Play',
        logoAlt: 'ZERO1 logo (placeholder)',
        gamesNote: 'Games use the same block editor and robot as the Learning Path. More games are on the way.',
        play: 'Play',
        playable: 'Playable',
        levels: 'levels',
        level: 'Level',
        backToGame: 'Back to game'
    },
    ar: {
        pageTitle: 'تعلّم والعب',
        intro: 'تعلّم برمجة روبوت ZERO1 خطوة بخطوة، ثم استخدم مهاراتك في ألعاب البرمجة.',
        learningPath: 'مسار التعلّم',
        codingGames: 'ألعاب البرمجة',
        tasks: 'مهام',
        exploreUnit: 'استكشف الوحدة',
        notStarted: 'لم تبدأ',
        inProgress: 'قيد التقدّم',
        completed: 'مكتملة',
        draft: 'عنوان مسوّدة',
        draftNote: 'العنوان ونص المهمة مسوّدة تحريرية إلى أن يُضاف نص المنهج الأصلي.',
        doneCount: 'منجزة',
        nextUnit: 'الوحدة التالية',
        unit: 'الوحدة',
        task: 'المهمة',
        home: 'الرئيسية',
        events: 'الفعاليات',
        challenges: 'التحديات',
        support: 'الدعم',
        mainNav: 'التنقل الرئيسي',
        breadcrumb: 'مسار التنقل',
        language: 'English',
        languageLabel: 'التبديل إلى الإنجليزية',
        comingSoon: 'قريبًا',
        concept: 'فكرة',
        sourcePending: 'نص المهمة الأصلي لم يُضف بعد',
        openTask: 'افتح المهمة',
        missionSoon: 'هذه المهمة غير متاحة بعد.',
        loadingMission: 'جارٍ تحميل المهمة…',
        missionError: 'تعذّر تحميل المهمة.',
        backToUnit: 'العودة إلى الوحدة',
        notFound: 'الصفحة غير موجودة',
        backHome: 'العودة إلى تعلّم والعب',
        logoAlt: 'شعار ZERO1 (مؤقت)',
        gamesNote: 'تستخدم الألعاب محرر الكتل والروبوت نفسيهما في مسار التعلّم. المزيد من الألعاب قادم.',
        play: 'العب',
        playable: 'متاحة',
        levels: 'مستويات',
        level: 'المستوى',
        backToGame: 'العودة إلى اللعبة'
    }
} as const;

export type StringKey = keyof (typeof strings)['en'];

const STORAGE_KEY = 'zero1.lang';

export const loadLang = (): Lang => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'en' || saved === 'ar') return saved;
    } catch {
        // storage unavailable: fall through
    }
    return navigator.language.toLowerCase().startsWith('ar') ? 'ar' : 'en';
};

export const saveLang = (lang: Lang): void => {
    try {
        localStorage.setItem(STORAGE_KEY, lang);
    } catch {
        // ignore
    }
};

export const t = (lang: Lang, key: StringKey): string => strings[lang][key];

export const applyLang = (lang: Lang): void => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = `ZERO1 | ${t(lang, 'pageTitle')}`;
};
