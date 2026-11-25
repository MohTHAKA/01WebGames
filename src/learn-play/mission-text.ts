import type { Lang } from './curriculum.ts';

export interface MissionText {
    instructions: { en: string; ar: string };
    hints: { en: string[]; ar: string[] };
}

type Pair = [en: string, ar: string];

const t = (instruction: Pair, hint1: Pair, hint2: Pair): MissionText => ({
    instructions: { en: instruction[0], ar: instruction[1] },
    hints: { en: [hint1[0], hint2[0]], ar: [hint1[1], hint2[1]] }
});

/**
 * Instructions and hints for every mission. Unit 1 follows the implementation brief; the rest is
 * editorial text (EN + AR) that must be reviewed against the original curriculum wording.
 */
export const missionText: Record<number, MissionText> = {
    1: t(
        [
            'Explore the move block. Try different directions, amounts and units, then press Run.',
            'استكشف كتلة الحركة. جرّب اتجاهات وقيمًا ووحدات مختلفة ثم اضغط تشغيل.'
        ],
        ['Snap a move block under "when program starts".', 'ضع كتلة الحركة أسفل "عند بدء البرنامج".'],
        ['Change the unit between rotations, seconds and degrees.', 'غيّر الوحدة بين الدورات والثواني والدرجات.']
    ),
    2: t(
        ['Drive the robot to the flag. Use rotations as the unit.', 'قُد الروبوت إلى العلم. استخدم الدورات كوحدة.'],
        ['Only the rotations unit counts here.', 'وحدة الدورات فقط هي المقبولة هنا.'],
        ['The flag is about 4 wheel rotations ahead.', 'العلم يبعد نحو 4 دورات للعجلة.']
    ),
    3: t(
        [
            'Drive through the tunnel to the exit. Use seconds as the unit.',
            'مرّ عبر النفق إلى المخرج. استخدم الثواني كوحدة.'
        ],
        ['Only the seconds unit counts here.', 'وحدة الثواني فقط هي المقبولة هنا.'],
        [
            'Drive straight; at the default speed the trip takes about 8 seconds.',
            'قُد بخط مستقيم؛ بالسرعة الافتراضية تستغرق الرحلة نحو 8 ثوانٍ.'
        ]
    ),
    4: t(
        [
            'Stop close to the box without touching it. Use degrees as the unit.',
            'توقف قرب الصندوق دون أن تلمسه. استخدم الدرجات كوحدة.'
        ],
        ['Only the degrees unit counts here.', 'وحدة الدرجات فقط هي المقبولة هنا.'],
        ['One rotation is 360 degrees. Aim for about 1900 degrees.', 'الدورة الواحدة 360 درجة. استهدف نحو 1900 درجة.']
    ),
    5: t(
        [
            'Reach the flag three times: once with rotations, once with seconds and once with degrees. Each run uses one unit.',
            'صل إلى العلم ثلاث مرات: مرة بالدورات ومرة بالثواني ومرة بالدرجات. كل تشغيل يستخدم وحدة واحدة.'
        ],
        [
            'Use one unit per run, then change the block and run again.',
            'استخدم وحدة واحدة في كل تشغيل ثم غيّر الكتلة وشغّل مجددًا.'
        ],
        [
            'The same distance is about 4 rotations, 4 seconds or 1440 degrees.',
            'المسافة نفسها تساوي نحو 4 دورات أو 4 ثوانٍ أو 1440 درجة.'
        ]
    ),
    6: t(
        [
            'The robot is in a dead end. Reverse out to the exit without turning.',
            'الروبوت في طريق مسدود. ارجع للخلف حتى المخرج دون أن تدور.'
        ],
        ['Set the direction of the move block to backward.', 'اضبط اتجاه كتلة الحركة إلى الخلف.'],
        ['The exit is about 5.7 rotations behind the robot.', 'المخرج يبعد نحو 5.7 دورة خلف الروبوت.']
    ),
    7: t(
        [
            'Go to the box, then come back to the starting spot. Use more than one move block.',
            'اذهب إلى الصندوق ثم عد إلى نقطة البداية. استخدم أكثر من كتلة حركة.'
        ],
        ['Drive forward to the box first.', 'قُد للأمام نحو الصندوق أولًا.'],
        ['Then move backward the same amount to return.', 'ثم تحرك للخلف بالمقدار نفسه للعودة.']
    ),

    8: t(
        [
            'Change the robot speed with the speed block, then drive it to the flag.',
            'غيّر سرعة الروبوت بكتلة السرعة ثم قُده إلى العلم.'
        ],
        [
            'Put "set speed" before the move block and pick a value other than 50.',
            'ضع كتلة "اضبط السرعة" قبل كتلة الحركة واختر قيمة غير 50.'
        ],
        [
            'Rotations measure distance, so the flag is still 4 rotations away at any speed.',
            'الدورات تقيس المسافة، لذا يبقى العلم على بعد 4 دورات مهما كانت السرعة.'
        ]
    ),
    9: t(
        [
            'Reach the flag twice: once slowly (30 or less) and once fast (70 or more).',
            'صل إلى العلم مرتين: مرة ببطء (30 أو أقل) ومرة بسرعة (70 أو أكثر).'
        ],
        [
            'Change the speed value between runs. The simulation clock shows the difference.',
            'غيّر قيمة السرعة بين التشغيلين. ساعة المحاكاة تُظهر الفرق.'
        ],
        ['Both runs still need 4 rotations to reach the flag.', 'يحتاج كلا التشغيلين إلى 4 دورات للوصول إلى العلم.']
    ),
    10: t(
        ['Start driving, wait, then stop exactly on the flag.', 'ابدأ القيادة ثم انتظر ثم توقف تمامًا عند العلم.'],
        [
            'Use "start moving", "wait" and "stop" in that order.',
            'استخدم "ابدأ الحركة" ثم "انتظر" ثم "توقف" بهذا الترتيب.'
        ],
        ['At the default speed the flag is about 4 seconds away.', 'بالسرعة الافتراضية يبعد العلم نحو 4 ثوانٍ.']
    ),
    11: t(
        [
            'Stop in front of the box without touching it, using start, wait and stop.',
            'توقف أمام الصندوق دون لمسه باستخدام ابدأ وانتظر وتوقف.'
        ],
        ['Start moving, wait, then stop before the box.', 'ابدأ الحركة ثم انتظر ثم توقف قبل الصندوق.'],
        [
            'The stopping spot is about 5.2 seconds ahead at the default speed.',
            'نقطة التوقف على بعد نحو 5.2 ثانية بالسرعة الافتراضية.'
        ]
    ),

    12: t(
        ['Turn the robot a little to the right, then drive forward to the flag.', 'أدر الروبوت قليلًا نحو اليمين ثم تحرك للأمام حتى العلم.'],
        [
            'Use "steer" to turn in place (positive turns right), then "move forward".',
            'استخدم كتلة "توجيه" للدوران في المكان (الموجب يمينًا) ثم كتلة "تحرك" للأمام.'
        ],
        ['Try steering 100 for 0.15 rotations, then move forward 2.5 rotations.', 'جرّب توجيه 100 لمدة 0.15 دورة ثم تحرك للأمام 2.5 دورة.']
    ),
    13: t(
        ['Turn further to the right, then drive forward to the flag.', 'أدر الروبوت أكثر نحو اليمين ثم تحرك للأمام حتى العلم.'],
        ['A longer turn points the robot further around before you drive.', 'كلما طالت مدة الدوران زادت زاوية دوران الروبوت قبل أن تتحرك.'],
        ['Try steering 100 for 0.3 rotations, then move forward 2 rotations.', 'جرّب توجيه 100 لمدة 0.3 دورة ثم تحرك للأمام دورتين.']
    ),
    14: t(
        ['Turn the robot a little to the left, then drive forward to the flag.', 'أدر الروبوت قليلًا نحو اليسار ثم تحرك للأمام حتى العلم.'],
        ['Negative steering values turn left.', 'قيم التوجيه السالبة تعني اليسار.'],
        ['Try steering -100 for 0.15 rotations, then move forward 2.5 rotations.', 'جرّب توجيه -100 لمدة 0.15 دورة ثم تحرك للأمام 2.5 دورة.']
    ),
    15: t(
        ['Spin the robot in place until it faces the opposite way.', 'أدر الروبوت في مكانه حتى يواجه الاتجاه المعاكس.'],
        ['Steering 100 spins the robot in place.', 'التوجيه 100 يجعل الروبوت يدور في مكانه.'],
        ['Half a turn (180 degrees) takes 1 rotation.', 'نصف دورة (180 درجة) تحتاج إلى دورة واحدة.']
    ),
    16: t(
        [
            'Turn the robot a quarter turn to the right in place. Use rotations.',
            'أدر الروبوت ربع دورة إلى اليمين في مكانه. استخدم الدورات.'
        ],
        ['Spin in place with steering 100.', 'أدر في المكان بتوجيه 100.'],
        ['A quarter turn (90 degrees) is exactly 0.5 rotations.', 'ربع الدورة (90 درجة) يساوي 0.5 دورة تمامًا.']
    ),
    17: t(
        [
            'Turn a quarter turn to the right in place. Use degrees.',
            'أدر ربع دورة إلى اليمين في مكانه. استخدم الدرجات.'
        ],
        ['Only the degrees unit counts here.', 'وحدة الدرجات فقط هي المقبولة هنا.'],
        [
            'The wheel must turn 180 degrees for the robot to turn 90 degrees.',
            'يجب أن تدور العجلة 180 درجة ليدور الروبوت 90 درجة.'
        ]
    ),
    18: t(
        ['Turn the robot 90 degrees to the left in place.', 'أدر الروبوت 90 درجة إلى اليسار في مكانه.'],
        ['Negative steering turns left.', 'التوجيه السالب يدور لليسار.'],
        ['Use steering -100 for 0.5 rotations.', 'استخدم التوجيه -100 لمدة 0.5 دورة.']
    ),

    19: t(
        [
            'Change the speed, then turn right and drive to the flag.',
            'غيّر السرعة ثم أدر الروبوت يمينًا وتحرك حتى العلم.'
        ],
        ['Set a speed other than 50 before the steer block.', 'اضبط سرعة غير 50 قبل كتلة التوجيه.'],
        ['Try speed 80, steering 100 for 0.2 rotations, then move forward 1.5 rotations.', 'جرّب سرعة 80 وتوجيه 100 لمدة 0.2 دورة ثم تحرك للأمام 1.5 دورة.']
    ),
    20: t(
        ['Give each wheel its own speed to curve onto the flag.', 'أعطِ كل عجلة سرعتها الخاصة لتنعطف نحو العلم.'],
        [
            'Use the "wheels for" block. The faster wheel is on the outside of the curve.',
            'استخدم كتلة "العجلتان لمدة". العجلة الأسرع تكون على الجانب الخارجي للمنحنى.'
        ],
        ['Try left 60 and right 30 for 2 rotations.', 'جرّب يسار 60 ويمين 30 لمدة دورتين.']
    ),
    21: t(
        [
            'Keep steering to the left, wait, then stop on the flag.',
            'استمر بالتوجيه نحو اليسار ثم انتظر ثم توقف عند العلم.'
        ],
        ['Use "start steering", "wait" and "stop".', 'استخدم "ابدأ التوجيه" ثم "انتظر" ثم "توقف".'],
        ['Try steering -20 and wait 2 seconds.', 'جرّب توجيه -20 والانتظار ثانيتين.']
    ),
    22: t(
        [
            'Drive forward, turn right, then drive to the flag facing right.',
            'قُد للأمام ثم انعطف يمينًا ثم قُد إلى العلم وأنت تواجه اليمين.'
        ],
        ['Three blocks: move, spin in place, move.', 'ثلاث كتل: حركة ثم دوران في المكان ثم حركة.'],
        [
            'Move 2 rotations, steer 100 for 0.5 rotations, move 2 rotations.',
            'تحرك دورتين، ثم توجيه 100 لمدة 0.5 دورة، ثم تحرك دورتين.'
        ]
    ),
    23: t(
        ['Go around the obstacle and reach the flag on the far side.', 'دُر حول العائق وصل إلى العلم في الجانب البعيد.'],
        [
            'Turn right, pass the obstacle, then turn left and drive past it.',
            'انعطف يمينًا وتجاوز العائق ثم انعطف يسارًا وتابع.'
        ],
        [
            'Every 90-degree spin in place is 0.5 rotations of steering 100.',
            'كل دوران 90 درجة في المكان يساوي 0.5 دورة بتوجيه 100.'
        ]
    ),
    24: t(
        [
            'Drive a square: visit each green corner in order and come back to the start facing the same way.',
            'قُد في مربع: مرّ بكل ركن بالترتيب وعد إلى البداية بالاتجاه نفسه.'
        ],
        ['Each side is the same move followed by a right turn.', 'كل ضلع هو الحركة نفسها يليها انعطاف يمين.'],
        [
            'Repeat 4 times: move 2 rotations, steer 100 for 0.5 rotations.',
            'كرر 4 مرات: تحرك دورتين ثم توجيه 100 لمدة 0.5 دورة.'
        ]
    ),

    25: t(
        [
            'Run only the left motor so the robot pivots to face right.',
            'شغّل المحرك الأيسر فقط ليدور الروبوت نحو اليمين.'
        ],
        [
            'Use the motor block and choose the left motor. Rotate it 1 rotation.',
            'استخدم كتلة المحرك واختر المحرك الأيسر. أدره دورة واحدة.'
        ],
        [
            'One wheel turning alone pivots the robot: 1 rotation is 90 degrees.',
            'عجلة واحدة تدور وحدها تدير الروبوت: دورة واحدة تساوي 90 درجة.'
        ]
    ),
    26: t(
        [
            'Run only the right motor so the robot pivots to face left.',
            'شغّل المحرك الأيمن فقط ليدور الروبوت نحو اليسار.'
        ],
        ['Choose the right motor.', 'اختر المحرك الأيمن.'],
        ['1 rotation of one wheel pivots the robot 90 degrees.', 'دورة واحدة لعجلة واحدة تدير الروبوت 90 درجة.']
    ),
    27: t(
        [
            'Turn the robot around (180 degrees) using only the left motor and rotations.',
            'أدر الروبوت 180 درجة باستخدام المحرك الأيسر والدورات فقط.'
        ],
        ['Only the rotations unit counts here.', 'وحدة الدورات فقط هي المقبولة هنا.'],
        ['1 rotation is 90 degrees, so you need 2.', 'الدورة الواحدة تساوي 90 درجة، فتحتاج دورتين.']
    ),
    28: t(
        [
            'Turn the robot 45 degrees using only the left motor and degrees.',
            'أدر الروبوت 45 درجة باستخدام المحرك الأيسر والدرجات فقط.'
        ],
        ['Only the degrees unit counts here.', 'وحدة الدرجات فقط هي المقبولة هنا.'],
        ['The wheel must turn 180 degrees for 45 degrees of robot turn.', 'يجب أن تدور العجلة 180 درجة لتدور 45 درجة.']
    ),
    29: t(
        [
            'Turn the robot to face 135 degrees using only the left motor and seconds.',
            'أدر الروبوت إلى 135 درجة باستخدام المحرك الأيسر والثواني فقط.'
        ],
        ['Only the seconds unit counts here.', 'وحدة الثواني فقط هي المقبولة هنا.'],
        [
            'At the default motor speed, 1 second turns the robot 135 degrees.',
            'بسرعة المحرك الافتراضية تدير الثانية الواحدة الروبوت 135 درجة.'
        ]
    ),
    30: t(
        [
            'Start both motors, wait, then stop them so the robot ends on the flag.',
            'شغّل المحركين ثم انتظر ثم أوقفهما ليصل الروبوت إلى العلم.'
        ],
        [
            'Start the left motor, then the right motor, then wait and stop all.',
            'شغّل المحرك الأيسر ثم الأيمن ثم انتظر وأوقف الكل.'
        ],
        [
            'At the default motor speed the flag is about 2.6 seconds away.',
            'بسرعة المحرك الافتراضية يبعد العلم نحو 2.6 ثانية.'
        ]
    ),
    31: t(
        [
            'Reverse the left motor so the robot pivots the other way and faces left.',
            'اعكس المحرك الأيسر ليدور الروبوت في الاتجاه الآخر ويواجه اليسار.'
        ],
        ['Set the motor direction to backward.', 'اضبط اتجاه المحرك إلى الخلف.'],
        ['1 rotation backward is a 90 degree turn to the left.', 'دورة واحدة للخلف تدير الروبوت 90 درجة إلى اليسار.']
    ),
    32: t(
        [
            'Back out of the dead end using both motors in reverse. Do not turn.',
            'ارجع للخلف خارج الطريق المسدود بتشغيل المحركين عكسيًا. لا تدر.'
        ],
        ['Start both motors backward, wait, then stop.', 'شغّل المحركين للخلف ثم انتظر ثم أوقف.'],
        ['The exit is about 3.8 seconds behind the robot.', 'المخرج يبعد نحو 3.8 ثانية خلف الروبوت.']
    ),

    33: t(
        [
            'Set the left motor speed to something other than 75, then turn the robot a quarter turn.',
            'اضبط سرعة المحرك الأيسر على قيمة غير 75 ثم أدر الروبوت ربع دورة.'
        ],
        ['Use "set motor speed" before the motor block.', 'استخدم "اضبط سرعة المحرك" قبل كتلة المحرك.'],
        [
            'A quarter turn needs 1 rotation of one wheel, at any speed.',
            'ربع الدورة يحتاج دورة واحدة لعجلة واحدة مهما كانت السرعة.'
        ]
    ),
    34: t(
        [
            'Run the left motor at a different speed for 1 second so the robot turns around (180 degrees).',
            'شغّل المحرك الأيسر بسرعة مختلفة لمدة ثانية ليدور الروبوت 180 درجة.'
        ],
        ['Use the seconds unit.', 'استخدم وحدة الثواني.'],
        ['At 100% the left wheel makes 2 rotations in 1 second.', 'عند 100% تدور العجلة دورتين في ثانية واحدة.']
    ),
    35: t(
        [
            'Start the left motor, wait a short time, then stop it to turn about 95 degrees.',
            'شغّل المحرك الأيسر ثم انتظر قليلًا ثم أوقفه ليدور نحو 95 درجة.'
        ],
        ['Use start, wait and stop for the left motor.', 'استخدم البدء والانتظار والإيقاف للمحرك الأيسر.'],
        [
            'At the default motor speed, 0.7 seconds is about 95 degrees.',
            'بسرعة المحرك الافتراضية تعطي 0.7 ثانية نحو 95 درجة.'
        ]
    ),
    36: t(
        [
            'Use speed 50 or less and the seconds unit to turn the robot around (180 degrees).',
            'استخدم سرعة 50 أو أقل ووحدة الثواني لتدير الروبوت 180 درجة.'
        ],
        ['Set the left motor speed to 50.', 'اضبط سرعة المحرك الأيسر على 50.'],
        ['At 50% the left wheel needs 2 seconds for 180 degrees.', 'عند 50% تحتاج العجلة إلى ثانيتين لدوران 180 درجة.']
    ),
    37: t(
        [
            'Turn a quarter turn twice: once slowly (30 or less) and once fast (70 or more).',
            'أدر ربع دورة مرتين: مرة ببطء (30 أو أقل) ومرة بسرعة (70 أو أكثر).'
        ],
        ['Change the motor speed between runs.', 'غيّر سرعة المحرك بين التشغيلين.'],
        ['Both runs use 1 rotation. Only the time changes.', 'كلا التشغيلين يستخدمان دورة واحدة. الزمن فقط يتغير.']
    ),
    38: t(
        [
            'Turn the robot slowly and precisely to face left using the right motor (30 or less).',
            'أدر الروبوت ببطء ودقة ليواجه اليسار بالمحرك الأيمن (30 أو أقل).'
        ],
        ['Set the right motor speed to 30 or lower.', 'اضبط سرعة المحرك الأيمن على 30 أو أقل.'],
        ['1 rotation of the right wheel turns the robot 90 degrees.', 'دورة واحدة للعجلة اليمنى تدير الروبوت 90 درجة.']
    ),
    39: t(
        [
            'Set both motors to a new speed, run them together and stop on the flag.',
            'اضبط المحركين على سرعة جديدة وشغّلهما معًا وتوقف عند العلم.'
        ],
        [
            'Set speed for left and right, start both, wait, stop all.',
            'اضبط سرعة اليسار واليمين ثم شغّل الاثنين وانتظر وأوقف الكل.'
        ],
        ['At 100% the flag is about 2 seconds away.', 'عند 100% يبعد العلم نحو ثانيتين.']
    ),

    40: t(
        [
            'Pivot on the right wheel with one motor, then drive forward to the flag.',
            'در حول العجلة اليمنى بمحرك واحد ثم قُد للأمام إلى العلم.'
        ],
        ['Run only the left motor for 1 rotation first.', 'شغّل المحرك الأيسر فقط لدورة واحدة أولًا.'],
        ['Then move forward 2 rotations.', 'ثم تحرك للأمام دورتين.']
    ),
    41: t(
        [
            'Pivot on the left wheel with one motor, then drive forward to the flag.',
            'در حول العجلة اليسرى بمحرك واحد ثم قُد للأمام إلى العلم.'
        ],
        ['Run only the right motor for 1 rotation first.', 'شغّل المحرك الأيمن فقط لدورة واحدة أولًا.'],
        ['Then move forward 2 rotations.', 'ثم تحرك للأمام دورتين.']
    ),
    42: t(
        ['Drive through the gate on the right and reach the exit.', 'مرّ عبر البوابة على اليمين ثم صل إلى المخرج.'],
        ['Drive up a little, pivot right, then go through the gate.', 'تقدم قليلًا ثم در يمينًا ثم مرّ عبر البوابة.'],
        [
            'Move 2 rotations, left motor 1 rotation, move 2 rotations.',
            'تحرك دورتين، المحرك الأيسر دورة، ثم تحرك دورتين.'
        ]
    ),
    43: t(
        ['Drive through the gate on the left and reach the exit.', 'مرّ عبر البوابة على اليسار ثم صل إلى المخرج.'],
        ['Drive up a little, pivot left, then go through the gate.', 'تقدم قليلًا ثم در يسارًا ثم مرّ عبر البوابة.'],
        [
            'Move 2 rotations, right motor 1 rotation, move 2 rotations.',
            'تحرك دورتين، المحرك الأيمن دورة، ثم تحرك دورتين.'
        ]
    ),
    44: t(
        [
            'Turn the robot exactly 135 degrees using the left motor and degrees.',
            'أدر الروبوت 135 درجة بدقة باستخدام المحرك الأيسر والدرجات.'
        ],
        ['Only the degrees unit counts here.', 'وحدة الدرجات فقط هي المقبولة هنا.'],
        [
            'The wheel turns 4 times as far as the robot: 540 degrees.',
            'تدور العجلة أربعة أضعاف دوران الروبوت: 540 درجة.'
        ]
    ),
    45: t(
        ['Raise the arm by one full rotation (360 degrees).', 'ارفع الذراع دورة كاملة (360 درجة).'],
        ['Choose the arm motor in the motor block.', 'اختر محرك الذراع في كتلة المحرك.'],
        ['Run the arm motor forward 1 rotation.', 'شغّل محرك الذراع للأمام دورة واحدة.']
    ),
    46: t(
        [
            'The arm starts raised at 540 degrees. Lower it to about 180 degrees.',
            'تبدأ الذراع مرفوعة عند 540 درجة. اخفضها إلى نحو 180 درجة.'
        ],
        ['Run the arm motor backward.', 'شغّل محرك الذراع للخلف.'],
        ['Lower it by 360 degrees.', 'اخفضها 360 درجة.']
    ),
    47: t(
        [
            'Raise the arm slowly (40 or less) for 2 seconds to reach about 430 degrees.',
            'ارفع الذراع ببطء (40 أو أقل) لمدة ثانيتين لتصل إلى نحو 430 درجة.'
        ],
        ['Set the arm speed first, then run it for 2 seconds.', 'اضبط سرعة الذراع أولًا ثم شغّلها ثانيتين.'],
        ['Speed 30 for 2 seconds raises the arm about 430 degrees.', 'السرعة 30 لمدة ثانيتين ترفع الذراع نحو 430 درجة.']
    ),
    48: t(
        [
            'Final challenge: drive to the box, lower the arm, then return to the start.',
            'التحدي الأخير: اذهب إلى الصندوق ثم اخفض الذراع ثم عد إلى البداية.'
        ],
        [
            'The arm starts raised at 360 degrees. Lower it all the way.',
            'تبدأ الذراع مرفوعة عند 360 درجة. اخفضها بالكامل.'
        ],
        [
            'Move forward 4.5 rotations, lower the arm 360 degrees, move backward 4.5 rotations.',
            'تحرك للأمام 4.5 دورة ثم اخفض الذراع 360 درجة ثم تحرك للخلف 4.5 دورة.'
        ]
    )
};

export const text = <T extends { en: string; ar: string }>(v: T, lang: Lang): string => v[lang];
