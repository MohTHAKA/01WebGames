// One-off: fills draft (editorial) titles for tasks 8-48 in curriculum.json and flags them.
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../src/learn-play/data/curriculum.json', import.meta.url);
const data = JSON.parse(readFileSync(file, 'utf8'));

const titles = {
    8: ['Change the speed', 'غيّر السرعة'],
    9: ['Compare speeds', 'قارن السرعات'],
    10: ['Keep driving', 'القيادة المستمرة'],
    11: ['Stop before the box', 'توقف قبل الصندوق'],
    12: ['Steer right', 'انعطف يمينًا'],
    13: ['A sharper curve', 'منعطف أحد'],
    14: ['Steer left', 'انعطف يسارًا'],
    15: ['Spin in place', 'الدوران في المكان'],
    16: ['Quarter turn with rotations', 'ربع دورة بالدورات'],
    17: ['Quarter turn with degrees', 'ربع دورة بالدرجات'],
    18: ['Turn left 90 degrees', 'انعطف يسارًا 90 درجة'],
    19: ['Speed and steering', 'السرعة والتوجيه'],
    20: ['Two wheel speeds', 'سرعتا العجلتين'],
    21: ['Keep steering', 'توجيه مستمر'],
    22: ['Drive, turn, drive', 'قُد ثم در ثم قُد'],
    23: ['Around the obstacle', 'حول العائق'],
    24: ['Drive a square', 'ارسم مربعًا'],
    25: ['The left motor', 'المحرك الأيسر'],
    26: ['The right motor', 'المحرك الأيمن'],
    27: ['Motor rotations', 'دورات المحرك'],
    28: ['Motor degrees', 'درجات المحرك'],
    29: ['Motor seconds', 'ثواني المحرك'],
    30: ['Both motors together', 'المحركان معًا'],
    31: ['Reverse a motor', 'عكس المحرك'],
    32: ['Reverse out with motors', 'الرجوع بالمحركات'],
    33: ['Set the motor speed', 'اضبط سرعة المحرك'],
    34: ['Full speed', 'أقصى سرعة'],
    35: ['Run and stop a motor', 'شغّل المحرك وأوقفه'],
    36: ['Speed and time', 'السرعة والزمن'],
    37: ['Speed or power?', 'السرعة أم الطاقة؟'],
    38: ['Slow and precise', 'بطيء ودقيق'],
    39: ['Fast and continuous', 'سريع ومستمر'],
    40: ['Pivot on the right wheel', 'الدوران حول العجلة اليمنى'],
    41: ['Pivot on the left wheel', 'الدوران حول العجلة اليسرى'],
    42: ['The right gate', 'البوابة اليمنى'],
    43: ['The left gate', 'البوابة اليسرى'],
    44: ['Precise motor control', 'تحكم دقيق بالمحرك'],
    45: ['Raise the arm', 'ارفع الذراع'],
    46: ['Lower the arm', 'اخفض الذراع'],
    47: ['Arm speed control', 'التحكم بسرعة الذراع'],
    48: ['Final challenge', 'التحدي النهائي']
};

for (const task of data.tasks) {
    if (task.id >= 8) {
        const [en, ar] = titles[task.id];
        task.titleEn = en;
        task.titleAr = ar;
        task.draft = true;
    }
}
data._note =
    'PARTIAL SOURCE. The original curriculum PDF was not available. Unit headings/ranges and Unit 1 task titles come from the implementation brief. Tasks flagged "draft": true have EDITORIAL titles written from the unit descriptions and must be replaced by the original Arabic text.';
writeFileSync(file, JSON.stringify(data, null, 4) + '\n');
console.log('ok');
