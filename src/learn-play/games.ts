/** Game catalog. Games with playable: true have levels in game-levels.ts; the rest are concept cards. */
export interface GameConcept {
    id: string;
    nameEn: string;
    nameAr: string;
    descEn: string;
    descAr: string;
    playable?: boolean;
}

export const gameConcepts: readonly GameConcept[] = [
    {
        id: 'code-quest',
        nameEn: 'Code Quest',
        nameAr: 'مغامرة الكود',
        descEn: 'Solve directional robot-programming puzzles.',
        descAr: 'حلّ ألغاز برمجة حركة الروبوت.',
        playable: true
    },
    {
        id: 'robo-logistics',
        nameEn: 'Robo Logistics',
        nameAr: 'لوجستيات الروبوت',
        descEn: 'Move cargo to targets with motor and arm operations.',
        descAr: 'انقل البضائع إلى أهدافها باستخدام المحركات والذراع.',
        playable: true
    },
    {
        id: 'logic-maze',
        nameEn: 'Logic Maze',
        nameAr: 'متاهة المنطق',
        descEn: 'Program your way through a maze.',
        descAr: 'برمج طريقك عبر المتاهة.',
        playable: true
    },
    {
        id: 'sensor-rush',
        nameEn: 'Sensor Rush',
        nameAr: 'سباق الحساسات',
        descEn: 'Use the distance sensor to stop exactly where you need to.',
        descAr: 'استخدم حساس المسافة لتتوقف في المكان المطلوب بدقة.',
        playable: true
    },
    {
        id: 'pattern-builder',
        nameEn: 'Pattern Builder',
        nameAr: 'بناء الأنماط',
        descEn: 'Build repeatable path patterns with the repeat block.',
        descAr: 'ابنِ أنماط مسارات قابلة للتكرار بكتلة التكرار.',
        playable: true
    },
    {
        id: 'robot-arena',
        nameEn: 'Robot Arena',
        nameAr: 'ساحة الروبوت',
        descEn: 'Skill challenges: beat the clock, squeeze through gaps and work the arm.',
        descAr: 'تحديات المهارة: تفوّق على الوقت ومرّ عبر الفتحات الضيقة واستخدم الذراع.',
        playable: true
    }
];
