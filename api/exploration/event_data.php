<?php
// Exploration event data — uses globals from engine_config.php (MALE_NAMES, FEMALE_NAMES, etc.)

$ZONE_DESC = [
    'Болото' => 'туманных болот',
    'Заброшенная военная база и окрестности' => 'заброшенной военной базы',
    'Свалка мусора' => 'свалки',
    'Темный лес' => 'тёмного леса',
    'База бандитов' => 'бандитского лагеря',
    'Руины города' => 'городских руин',
    'Старый завод' => 'старого завода',
    'Пустошь' => 'пустоши',
];

function getZoneDesc($zoneName) {
    global $ZONE_DESC;
    return isset($ZONE_DESC[$zoneName]) ? $ZONE_DESC[$zoneName] : $zoneName;
}

function substitute($text, $zoneDesc, $faction) {
    global $MALE_NAMES, $FEMALE_NAMES, $NICKNAMES, $ITEM_NAMES, $LOOT_ROOMS;
    $male = PICK_RAND($MALE_NAMES);
    $female = PICK_RAND($FEMALE_NAMES);
    $nick = PICK_RAND($NICKNAMES);
    $item = PICK_RAND($ITEM_NAMES);
    $room = PICK_RAND($LOOT_ROOMS);
    $replacements = [
        '{zone}' => $zoneDesc,
        '{faction}' => $faction,
        '{male}' => $male,
        '{female}' => $female,
        '{nick}' => $nick,
        '{item}' => $item,
        '{room}' => $room,
    ];
    return str_replace(array_keys($replacements), array_values($replacements), $text);
}

function computeEffects($baseEffects, $level) {
    $effects = [];
    if (isset($baseEffects['chips'])) $effects['chips'] = is_callable($baseEffects['chips']) ? $baseEffects['chips']($level) : $baseEffects['chips'];
    if (isset($baseEffects['exp'])) $effects['exp'] = is_callable($baseEffects['exp']) ? $baseEffects['exp']($level) : $baseEffects['exp'];
    if (isset($baseEffects['damage'])) $effects['damage'] = is_callable($baseEffects['damage']) ? $baseEffects['damage']($level) : $baseEffects['damage'];
    if (isset($baseEffects['damagePercent'])) $effects['damagePercent'] = is_callable($baseEffects['damagePercent']) ? $baseEffects['damagePercent']($level) : $baseEffects['damagePercent'];
    if (isset($baseEffects['heal'])) $effects['heal'] = is_callable($baseEffects['heal']) ? $baseEffects['heal']($level) : $baseEffects['heal'];
    if (isset($baseEffects['healPercent'])) $effects['healPercent'] = is_callable($baseEffects['healPercent']) ? $baseEffects['healPercent']($level) : $baseEffects['healPercent'];
    if (isset($baseEffects['itemCount'])) $effects['itemCount'] = is_callable($baseEffects['itemCount']) ? $baseEffects['itemCount']($level) : $baseEffects['itemCount'];
    if (isset($baseEffects['combat'])) $effects['combat'] = $baseEffects['combat'];
    if (isset($effects['healPercent']) && $effects['healPercent'] > 0) $effects['healPercent'] = min($effects['healPercent'], 0.15);
    if (isset($effects['damagePercent']) && $effects['damagePercent'] > 0) $effects['damagePercent'] = min($effects['damagePercent'], 0.30);
    return $effects;
}

function resolveBranch($branch, $zone, $level, &$items) {
    $totalWeight = 0;
    foreach ($branch['outcomes'] as $o) $totalWeight += $o['weight'];
    $roll = mt_rand() / mt_getrandmax() * $totalWeight;
    $chosen = $branch['outcomes'][0];
    foreach ($branch['outcomes'] as $outcome) {
        $roll -= $outcome['weight'];
        if ($roll <= 0) { $chosen = $outcome; break; }
    }
    $texts = [$chosen['text']];
    $effects = [];
    if (isset($chosen['effects'])) {
        $raw = is_callable($chosen['effects']) ? $chosen['effects']($zone, $level) : $chosen['effects'];
        if (is_array($raw)) {
            if (isset($raw['chips'])) $effects['chips'] = $raw['chips'];
            if (isset($raw['exp'])) $effects['exp'] = $raw['exp'];
            if (isset($raw['damage'])) $effects['damage'] = $raw['damage'];
            if (isset($raw['damagePercent'])) $effects['damagePercent'] = $raw['damagePercent'];
            if (isset($raw['heal'])) $effects['heal'] = $raw['heal'];
            if (isset($raw['healPercent'])) $effects['healPercent'] = $raw['healPercent'];
            if (isset($raw['itemCount'])) $effects['itemCount'] = $raw['itemCount'];
            if (isset($raw['combat'])) $effects['combat'] = $raw['combat'];
        }
    }
    // Ресурсы в путешествии не тратятся: трата идёт только на старте рейда.
    return ['texts' => $texts, 'effects' => $effects, 'resourceCost' => null, 'resourceHad' => false];
}

// ---------------------------------------------------------------------------
$HELP_TEXTS_RICH = [
    [
        'text' => 'На дороге сидит старик. Нога перевязана грязной тряпкой. «Сынок, помоги дойти до посёлка. Отблагодарю, чем смогу». Помогаешь ему дойти — в благодарность он отдаёт старый, но рабочий пистолет и горсть чипов.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Провожаешь старика до посёлка — он сдержал слово, отдал пистолет и чипы.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,3)];}],
                ['text' => 'По пути старик рассказывает о заброшенном схроне военных — координаты пригодятся.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'itemCount'=>1];}],
                ['text' => 'Перевязываешь ногу старика свежим бинтом — рана неглубокая, заживёт быстро.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Старик малость прихрамывает — дорога заняла больше времени, чем думали. Устал, но дошёл.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}],
                ['text' => 'У околицы нас встречают родственники старика. «Спасибо, добрый человек!» — угощают ужином.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Женщина с ребёнком на руках прячется в подвале разрушенного дома. «Муж ушёл за водой и не вернулся…» Ты делишься с ней припасами. В ответ она отдаёт тебе шкатулку с редкими микросхемами.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Оставляешь женщине консервы и воду. Она со слезами благодарит и отдаёт шкатулку с микросхемами.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,3)];}],
                ['text' => 'Ребёнок перестаёт плакать, когда даёшь ему галету. Женщина улыбается и даёт тёплое одеяло.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Женщина рассказывает об окрестностях — указывает на дом, где можно найти припасы.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}],
                ['text' => 'Ребёнок рисует тебе картинку — под ней женщина пишет координаты схрона мужа.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Появляются подозрительные люди — женщина прячется, ты прикрываешь вход. Уходят.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Молодой парень копается в двигателе старого грузовика. «Не заведётся, чтоб его!». Помогаешь ему починить — он в благодарность даёт тебе топливо и указывает безопасный путь через болота.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вдвоём чините грузовик — замена свечей и проводки делает своё дело. Двигатель заводится!', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,3)];}],
                ['text' => 'Парень щедро делится топливом из грузовика и рисует карту безопасного пути.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}],
                ['text' => 'В кузове грузовика находишь ящик с консервами и инструментами — парень машет рукой: «Бери, мне не жалко!».', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'itemCount'=>1];}],
                ['text' => 'Парень оказывается болтливым — рассказывает о бандитской засаде на южной дороге.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}],
                ['text' => 'Под капотом оказывается больше проблем, чем думали. Чините кое-как — парень даёт сколько может.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Маленький мальчик сидит на обочине и плачет. «Я потерялся…» Ты провожаешь его до ближайшего поселения. Родители в благодарность угощают тебя обедом и дают чипы.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Мальчик показывает дорогу к посёлку — родители вне себя от радости. Сытный обед и чипы.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'По пути учишь мальчика отличать съедобные ягоды от ядовитых. Он внимательно слушает.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'healPercent'=>RF(0.01,0.03)];}],
                ['text' => 'Отец мальчика — местный охотник — даёт тебе запас патронов и карту охотничьих троп.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Оказывается, мальчик не просто потерялся — он убежал из дома. Родители просят присмотреть.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2)];}],
                ['text' => 'В посёлке праздник — кто-то родил, кто-то нашёл воду. Тебя угощают и зовут остаться.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Пожилая пара пытается перетащить телегу через завал. Ты помогаешь расчистить путь. Женщина угощает тебя домашним хлебом (настоящим, не синтетическим!), а мужчина даёт несколько чипов.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Расчищаешь завал за час — телега проезжает, старики благодарят от души. Хлеб тёплый, чипы звенят.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Женщина даёт не только хлеб, но и баночку варенья из одуванчиков. Настоящая роскошь!', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'chips'=>C($l,2)];}],
                ['text' => 'Мужчина рассказывает, что они держат путь к сыну в большой посёлок. Просит передать весточку.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}],
                ['text' => 'Под завалом находишь полезные вещи — старый лом и кусок брезента. Старики разрешают забрать.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}],
                ['text' => 'Завал оказывается больше, чем казался. Провозились дотемна, но старики зовут переночевать.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Раненый сталкер сидит у костра и пытается сам себе перевязать плечо. «Помоги, брат. Напоролся на арматуру в тёмном подвале». Ты помогаешь ему с перевязкой. Он даёт тебе флягу с водой и ценный совет.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Перевязываешь рану — кровь остановлена. Сталкер жмёт руку: «Спасибо, брат!».', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,3),'chips'=>C($l,3)];}],
                ['text' => 'Сталкер рассказывает про подвал, где напоролся — там остался ящик с патронами и чипами.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,3)];}],
                ['text' => 'Сталкер знает местные тропы как свои пять пальцев. Рисует карту с пометками аномалий.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}],
                ['text' => 'У сталкера во фляге не вода, а самогон. «Полечим раны по-нашему!» — прикладывается к фляге.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,2),'healPercent'=>RF(0.01,0.02)];}],
                ['text' => 'К костру подходят ещё двое сталкеров — знакомые раненого. Вместе веселее, делятся припасами.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.01,0.03),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Собака выбегает из кустов, поджав хвост. У неё — царапина и ошейник с запиской: «Приюти, кто может». Забираешь её с собой — она становится твоим компаньоном. В ошейнике припрятаны чипы.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Собака доверчиво виляет хвостом. Забираешь её — в ошейнике чипы и записка с координатами дома.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2),'healPercent'=>RF(0.01,0.03)];}],
                ['text' => 'По дороге собака облаивает кусты — там спрятан рюкзак с припасами. Умный пёс!', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,3)];}],
                ['text' => 'Собака оказывается обученной — знает команды «сидеть», «лежать», «голос». Ценный компаньон!', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}],
                ['text' => 'Встречаешь бывшего хозяина по записке — он просит присмотреть за собакой, даёт чипы за услугу.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}],
                ['text' => 'Собака приводит к могиле старого сталкера — рядом оставлены его вещи. Последняя воля.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,3)];}],
            ],
        ],
    ],
    [
        'text' => 'Юноша сидит на корточках у капкана, в который попался его друг. «Отцепи его, прошу!». Ты помогаешь освободить ногу парня. Спасённый достаёт из рюкзака банку тушёнки и несколько чипов.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Освобождаешь ногу из капкана — рана неглубокая. Парень в благодарность делится тушёнкой и чипами.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,3),'healPercent'=>RF(0.02,0.04)];}],
                ['text' => 'Осматриваешь капкан — ручная работа, можно разобрать на запчасти. Парни не против.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}],
                ['text' => 'Парни рассказывают, что капканы расставили бандиты — они предупреждают об опасной зоне.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}],
                ['text' => 'Оказывается, они выслеживали мутанта и сами попали в свой же капкан. Помогаешь закончить охоту.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}],
                ['text' => 'Появляются сталкеры, которые проверяют капканы. Объясняешь ситуацию — расходятся мирно.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Девушка в запылённой куртке чинит солнечную панель на крыше сарая. «Подай мне ключ на 10!» Работаешь с ней часом. Она даёт тебе запасную батарею и чипы за помощь.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Подаёшь инструменты — панель починена, свет есть! Девушка довольно улыбается и даёт батарею.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,3)];}],
                ['text' => 'В сарае находишь старый генератор и запчасти. Девушка разрешает взять что нужно.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,2)];}],
                ['text' => 'Девушка рассказывает, что живёт здесь одна, сама всё чинит. Уважение — чистая выживаемость.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'healPercent'=>RF(0.01,0.02)];}],
                ['text' => 'Пока чините панель, замечаешь вдалеке дым. Девушка объясняет, что это лагерь торговцев.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2)];}],
                ['text' => 'Работа подходит к концу, но начинает темнеть. Девушка предлагает чай и ночлег в сарае.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Трое детей играют в «войнушку» возле сгоревшего бронетранспортёра. Они не видели чужаков с рождения. Ты даёшь им сладости и рассказываешь старую сказку. Их мать приглашает тебя на ужин и даёт припасы в дорогу.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Дети в восторге от сладостей — облепили тебя со всех сторон. Мать зовёт ужинать.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Рассказываешь сказку про храброго рыцаря. Дети слушают, раскрыв рты. Мать улыбается.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'healPercent'=>RF(0.01,0.03)];}],
                ['text' => 'Осматриваешь бронетранспортёр — внутри уцелел ящик с инструментами и картами.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Мать рассказывает, что их отец ушёл в рейд и не вернулся. Просит узнать о нём у торговцев.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}],
                ['text' => 'Появляется мужчина с ружьём — оказывается, отец семейства вернулся! Радость, объятия, ужин.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'exp'=>E($l,3),'chips'=>C($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Из ямы кричит мужчина: «Помогите! Сорвался, ногу подвернул!». Ты спускаешь ему верёвку и вытаскиваешь. Он механик: в благодарность чинит одну из твоих вещей и делится чипами.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вытаскиваешь мужика — он механик от Бога. Чинит тебе вещь и даёт чипы. Ценный знакомый.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,3)];}],
                ['text' => 'В яме оказывается не только он, но и ящик с запчастями, который он нёс. Делится находкой.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,2)];}],
                ['text' => 'Механик рассказывает, что шёл к старому убежищу, где хранит инструменты. Даёт координаты.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}],
                ['text' => 'Нога опухла — механик не может идти. Придётся нести его на себе до ближайшего жилья.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.03),'exp'=>E($l,2)];}],
                ['text' => 'На шум прибегают знакомые механика — помогают донести его до мастерской. Там тебя ждёт угощение.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Бродячий кот трется о ноги. У него — ошейник с биркой «Рыжий, особь ценная». Кот ведёт тебя к заброшенному дому, где в подполе лежит ящик с инструментами и чипами.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Кот уверенно ведёт тебя к дому. В подполе — ящик с инструментами и чипами. Умный котейка!', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,4),'exp'=>E($l,3)];}],
                ['text' => 'В доме, кроме подпола, есть кухня с запасом консервов. Кот одобрительно мяукает.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'chips'=>C($l,2)];}],
                ['text' => 'Кот приводит на чердак — там гнездо птиц и старая шкатулка с украшениями.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,3)];}],
                ['text' => 'Кот шипит и фыркает в углу — там змея. Благодаря коту замечаешь опасность вовремя.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2)];}],
                ['text' => 'Кот приводит к соседнему дому — там живёт старушка, которая ищет своего Рыжего.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.05),'exp'=>E($l,2),'chips'=>C($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Древняя старуха сидит на крыльце и плетёт сеть из проволоки и пластиковых лент. «Помоги натянуть, старая уже, сил нет». Помогаешь — она угощает травяным чаем и даёт оберег из костей птиц.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Натягиваешь сеть — старуха довольно кивает. Чай пахнет мятой и чабрецом, оберег тёплый на ощупь.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'exp'=>E($l,2)];}],
                ['text' => 'Старуха рассказывает, что видела во сне «железных людей». «Они идут с севера, берегись».', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}],
                ['text' => 'В доме старухи — сушёные травы, коренья и банки с настойками. Она разрешает взять немного.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'itemCount'=>1];}],
                ['text' => 'Старуха оказывается знахаркой. Осматривает твои раны и даёт мазь из глины и прополиса.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'exp'=>E($l,2)];}],
                ['text' => 'К старухе приходят соседи за травами. Знакомишься с местными — они делятся новостями.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Семья переселенцев остановилась у ручья. Отец чинит телегу, мать кормит детей. «Не подкинешь бензина? Своим кончился». Делишься топливом — они дают тебе старую карту местности с пометками тайников.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Делишься топливом — отец довольно хлопает по плечу. Карта с тайниками — отличная награда.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,3)];}],
                ['text' => 'Мать угощает тебя горячей похлёбкой — настоящая еда, а не синтетика. Силы возвращаются.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'exp'=>E($l,2)];}],
                ['text' => 'Дети играют у ручья — находишь в воде старый нож. Отец говорит: «Возьми, нам ни к чему».', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}],
                ['text' => 'Телега сломана серьёзнее, чем думали. Помогаешь с ремонтом — отец даёт ещё и инструменты.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,3)];}],
                ['text' => 'Отец рассказывает о большом посёлке в двух днях пути. «Там есть рынок и доктор. Скажи, от меня».', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}],
            ],
        ],
    ],
    [
        'text' => 'Двое сталкеров спорят, куда идти. Один говорит: «Налево — к базе, направо — к смерти». Второй: «Да пошёл ты!». Ты указываешь им безопасный путь. В благодарность делятся патронами.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Разнимаешь спорщиков. Один из них признаёт твою правоту. Делятся патронами и картой.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,3),'exp'=>E($l,3)];}],
                ['text' => 'Выясняешь, что они спорят о дороге к старому НИИ. Ты знаешь этот район — рисуешь им маршрут.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}],
                ['text' => 'Оба сталкера поворачиваются против тебя — «А ты не лезь, умник!». Получаешь по лицу.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.12),'chips'=>NC($l,1)];}],
                ['text' => 'Выясняется, что оба пути ведут к разным группировкам. «Налево — {faction}, направо — конкуренты».', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}],
                ['text' => 'Сталкеры оказываются из одного отряда — просто поссорились. Миришь их, получаешь долю.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Освобождаешь пленного, привязанного к столбу. «Спасибо, брат. Я инженер с Водоканала. Должен теперь тебе». Он даёт тебе жетон, по которому на его станции дадут бесплатный запас воды.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Перерезаешь верёвки — инженер свободен. Жетон на воду — отличная награда.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,3)];}],
                ['text' => 'Инженер рассказывает, что его взяли в плен бандиты. Он знает, где их лагерь — ведёт тебя туда.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,3)];}],
                ['text' => 'Инженер чинит твой инструмент в благодарность. Золотые руки — теперь вещь как новая.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}],
                ['text' => 'На шум прибегают бандиты, которые его сторожили. Приходится отбиваться от них вместе.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.06),'exp'=>E($l,3),'combat'=>true];}],
                ['text' => 'Инженер приглашает на станцию Водоканала — там тебя ждёт горячий душ и настоящий обед.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Учитель в развалинах школы проводит урок для горстки детей. Он рассказывает о физике и истории. «Хочешь, посиди, послушай. Знания — сила». Полчаса лекции — и ты чувствуешь себя умнее.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Садишься на парту. Учитель объясняет закон Ома и тактику Ганнибала. Мозг кипит, но приятно.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,4),'healPercent'=>RF(0.01,0.02)];}],
                ['text' => 'Учитель просит рассказать о внешнем мире. Дети слушают, раскрыв рты. Ты — живая легенда.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}],
                ['text' => 'Помогаешь учителю починить парты и доску. Заодно находишь в подсобке старый глобус.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'itemCount'=>1];}],
                ['text' => 'Учитель жалуется на нехватку учебников. Обещаешь поискать в рейдах — дети радостно галдят.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2)];}],
                ['text' => 'После урока учитель угощает чаем из трав. Разговор о жизни — простой и мудрый старик.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,3)];}],
            ],
        ],
    ],
    [
        'text' => 'У монаха в оранжевой робе закончилась вода. Он медитирует под палящим солнцем. Ты даёшь ему флягу. «Будда хранит тебя, странник». Он дарит тебе чётки из обожжённой глины — они странно тёплые на ощупь.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Монах принимает воду с благодарностью. Чётки действительно тёплые — может, Будда хранит?', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'exp'=>E($l,3)];}],
                ['text' => 'Монах рассказывает о своём пути — он идёт к священному озеру. «Вода там лечит раны».', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}],
                ['text' => 'Монах медитирует с чётками — ты чувствуешь странное тепло. Кажется, раны затягиваются.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'К монаху подходят местные жители за советом. Он представляет тебя как «спасителя». Честь.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}],
                ['text' => 'Монах приглашает разделить с ним скромную трапезу. Рис, вода и молитва — простота лечит.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Слепой ветеран сидит у могильного креста. «Сын здесь лежит. Не уберёг…» Ты молча сидишь рядом. Ветеран достаёт флягу, наливает по сто грамм. Горькая, но крепкая встреча.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Сидишь с ветераном молча. Он ценит компанию. Достаёт сверток — патроны и чипы. «Держи, сынок».', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,3)];}],
                ['text' => 'Ветеран оказывается бывшим снайпером. Учит тебя правильно дышать при стрельбе.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}],
                ['text' => 'Ветеран рассказывает, где его сын нашёл свой последний тайник. Даёт координаты.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Появляются мародёры. Ветеран, несмотря на слепоту, достаёт обрез. Отбиваетесь вместе.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.05),'exp'=>E($l,3),'combat'=>true];}],
                ['text' => 'Ветеран провожает тебя до околицы. «Заходи, если что. Солдату солдата понять легче».', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.05),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Молодая пара строит дом из обломков. «Не армия, не банда — просто хотим жить по-человечески». Они приглашают тебя помочь забить пару гвоздей. За работу кормят ужином и дают чипы.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Забиваешь гвозди, пилишь доски. Дом растёт на глазах. Пара довольно, ужин — от души.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Девушка готовит ужин на костре. Настоящий борщ из консервов и дикого лука — объедение!', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'chips'=>C($l,2)];}],
                ['text' => 'Парень — бывший строитель. Показываешь ему чертёж, он подсказывает, как укрепить конструкцию.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}],
                ['text' => 'Находят старый ящик с инструментами в развалинах. Ты помогаешь его поднять — внутри запчасти.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}],
                ['text' => 'Соседи приносят стройматериалы в благодарность за то, что пара строит общий колодец.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Гонец на велосипеде чуть не сбивает тебя. «Прости, брат, спешу! В посёлке эпидемия!». У него порвана цепь. Ты помогаешь починить — он мчится дальше, крикнув на прощание: «Проверь фильтр для воды, если есть!».',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Чинишь цепь за минуту — гонец жмёт газ (педали) и улетает. Ценная информация.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'healPercent'=>RF(0.01,0.02)];}],
                ['text' => 'Гонец рассказывает об эпидемии — тиф, грязная вода. Предупреждён — вооружён.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}],
                ['text' => 'У гонца в рюкзаке — пакет с лекарствами для посёлка. Он просит передать, если сам не доберётся.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}],
                ['text' => 'Велосипед разваливается на части — цепь порвана, колесо спущено, тормозов нет. Полный караул.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.03),'exp'=>E($l,2)];}],
                ['text' => 'У гонца есть дубликат карты с отмеченными безопасными источниками воды. Делится.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'itemCount'=>1];}],
            ],
        ],
    ],
    [
        'text' => 'Маленький щенок выбегает из кустов, весь в репьях. За ним никто не идёт. Ты даёшь ему галету — он лижет руку и бежит за тобой. Компаньон на ближайший час поднимает настроение.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Щенок жуёт галету и виляет хвостом. Идёт за тобой — настроение на высоте, мир кажется добрее.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'exp'=>E($l,2)];}],
                ['text' => 'Щенок находит гнездо с яйцами — приносит в зубах, не разбив. Умный малыш!', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.01,0.03),'itemCount'=>1];}],
                ['text' => 'Щенок лает на кусты — там спрятан рюкзак путника с припасами. Нюх не обманет!', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,2),'exp'=>E($l,2)];}],
                ['text' => 'Щенок отказывается идти дальше — скулит и смотрит в сторону леса. Там может быть его дом.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2)];}],
                ['text' => 'К вечеру щенок устаёт. Засыпает у тебя на коленях. Тепло и уютно даже в Пустоши.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.05),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Одинокий торговец сидит у перевёрнутой телеги. Колесо сломалось, товары рассыпаны по пыльной дороге. Он предлагает щедрую плату за помощь — видно, что спешит.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Помогаешь собрать рассыпанные консервы — торговец открывает ящик с инструментами.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Даёшь воды из фляги — торговец жадно пьёт и рассказывает о бандитской засаде на пути.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'healPercent'=>RF(0.01,0.03)];}],
                ['text' => 'Замечаешь, что торговец ранен — перевязываешь глубокий порез на руке.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}],
                ['text' => 'Помогаешь починить колесо снятой запчастью — телега снова на ходу.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}],
                ['text' => 'Ночью торговец достаёт старую рацию — просит батарейки, чтобы вызвать караван.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}],
            ],
        ],
    ],
    [
        'text' => 'На обочине дороги сидит слепая старуха. Перед ней старая шляпа с парой чипов. Она поворачивает голову на твои шаги: «Подай, добрый человек, век не забуду».',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Даёшь ей флягу — она долго пьёт, крестится. «Спасибо, сынок, отплачу добром».', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'exp'=>E($l,2)];}],
                ['text' => 'У старухи дрожат руки — она давно не ела. Делишься консервой.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'healPercent'=>RF(0.01,0.02)];}],
                ['text' => 'Замечаешь у старухи больную ногу — перематываешь чистой тканью.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}],
                ['text' => 'Старуха говорит, что у неё есть внук — механик на старой заправке.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'healPercent'=>RF(0.01,0.03)];}],
                ['text' => 'У старухи пропал голос — она хрипит. Даёшь ей лекарство от кашля.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}],
            ],
        ],
    ],
    [
        'text' => 'Из развалин школы доносится детский смех. Трое ребят играют в «войнушку» самодельными мечами из арматуры. Завидев тебя, замирают. Старший прячет младших за спину.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Достаёшь консервы и протягиваешь детям — они робко подходят, берут, благодарят.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Показываешь фокус с монеткой и батарейкой — дети в восторге, смеются, зовут играть.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'healPercent'=>RF(0.02,0.03)];}],
                ['text' => 'Спрашиваещь, где их родители. Старший мальчик показывает на холм — там лагерь выживших.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}],
                ['text' => 'Младший показывает свою «крепость» — куча мусора и старый сейф вместо трона.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}],
                ['text' => 'Дети просят проводить их до лагеря — страшно одним. Соглашаешься.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'healPercent'=>RF(0.02,0.04)];}],
            ],
        ],
    ],
    [
        'text' => 'Придорожный гараж с проржавевшей вывеской «Шиномонтаж». Внутри возится механик. Увидев тебя, он вытирает руки ветошью: «Запчасти есть? Работа нужна?».',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Даёшь механикe инструменты — он свистит: «О, комаровские!» Чинит твой инвентарь.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,3)];}],
                ['text' => 'Механик просит подсобить с двигателем — вместе вытаскиваете старый мотор.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}],
                ['text' => 'В углу гаража — куча гнилых досок. Механик просит расчистить.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'healPercent'=>RF(0.01,0.02)];}],
                ['text' => 'Находишь в гараже сломанный пластиковый корпус — механик говорит, что нужна заплатка.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}],
                ['text' => 'Механик жалуется на тусклый свет — фонарь садится. Нужны батарейки.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}],
            ],
        ],
    ],
    [
        'text' => 'Из кустов вываливается растрёпанный мужик с диким взглядом. Он тяжело дышит, оглядывается: «За мной хвост! Бандиты! Спрячь меня!».',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Даёшь ему воды — он отпивает и успокаивается. Рассказывает, что сбежал из плена.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'healPercent'=>RF(0.01,0.03)];}],
                ['text' => 'Беглец ранен — пуля задела плечо. Достаёшь бинты и лекарства.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}],
                ['text' => 'Кормишь беглеца консервами — он жадно ест и рассказывает, где бандиты держат заложников.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}],
                ['text' => 'Слышен шум мотора — бандиты близко. Нужно заметать следы.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Беглец весь в ссадинах — перевязываешь его рваную одежду изолентой.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2),'healPercent'=>RF(0.01,0.02)];}],
            ],
        ],
    ],
    [
        'text' => 'Старенький радиоприёмник на развалинах вдруг оживает — сквозь помехи пробивается голос: «SOS... Мы на старой метеостанции... Нужна помощь...».',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Проверяешь питание — приёмник сажает последние батарейки. Нужны свежие.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}],
                ['text' => 'Шум глушит сигнал — можно попробовать поднять антенну повыше.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Помехи от старого пластикового корпуса — можно изолировать.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'healPercent'=>RF(0.01,0.02)];}],
                ['text' => 'Приёмник перегрелся — нужна деревянная подставка для вентиляции.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}],
                ['text' => 'Голос с метеостанции просит принести топливо для генератора.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,3)];}],
            ],
        ],
    ],
];



// ---------------------------------------------------------------------------
// Micro event data
// ---------------------------------------------------------------------------
$MICRO_BUILDINGS = ['сгоревшего дома','разрушенного моста','старой церкви','ржавого ангара','пустого склада','тёмного подвала','военного бункера','старого завода'];
$MICRO_OBSERVATIONS = ['Изнутри доносится странный скрип.','Окна выбиты, двери распахнуты.','Внутри темно и тихо.','Пахнет сыростью.','Следы свежие — кто-то был недавно.'];
$MICRO_SOUNDS = ['далёкий взрыв','вой сирены','треск веток','звук мотора','чей-то крик','лай собак','скрип металла','хлопок выстрела'];
$MICRO_DIRECTIONS = ['слева','справа','впереди','позади нас','из леса','со стороны реки'];
$MICRO_REACTIONS = ['Настораживаемся.','Прислушиваемся.','Берём оружие наизготовку.','Ускоряем шаг.','Ждём минуту.'];
$MICRO_SMELLS = ['Пахнет дымом.','Запах горелой проводки.','Воняет болотом.','Пахнет бензином.','Сладковатый запах разложения.'];
$MICRO_FOOTING = ['Земля твёрдая.','Грунт рыхлый — ноги утопают.','Под ногами хрустит гравий.','Скользкая глина.','Песок, мелкий и сыпучий.'];
$MICRO_NEUTRAL = [
    // Original 10
    "Тишина. Только ветер шелестит травой.",
    "Проходим мимо заросшего пруда. Вода тёмная и неподвижная.",
    "Тропинка петляет между холмов. Красивый вид с вершины.",
    "Солнце клонится к закату. Пора искать место для ночлега.",
    "Лёгкий ветерок приносит запах полыни.",
    "В небе кружат птицы. Воздух чист.",
    "Лесная тропа выводит к живописному озеру.",
    "Вдалеке видны руины старого города.",
    "Поле диких цветов простирается до горизонта.",
    "Старая дорога, заросшая травой. Давно здесь никто не ездил.",
    // New 35
    "Пересекаем высохшее русло реки. Тишина, только ветер шелестит сухой травой.",
    "Натыкаемся на остов сгоревшего дома. Обгоревшие стены, запах пепла.",
    "Проходим мимо заброшенной заправки. Стёкла выбиты, внутри пусто.",
    "Вдали виднеется полуразрушенная вышка сотовой связи. Когда-то здесь ловил интернет.",
    "Овраг, заваленный бытовым мусором. Среди отходов блестит что-то металлическое.",
    "Больница на холме. Окна тёмные, двери распахнуты. Оттуда тянет холодом.",
    "Разрушенный мост через реку. Придётся искать брод в полукилометре выше.",
    "Заброшенная церковь. Купол обрушился, но крест на шпиле уцелел.",
    "Бензоколонка с проржавевшими колонками. Ценник: «Бензин — 5\$». Смешно.",
    "Руины школы. Парты перевёрнуты, на доске — надпись мелом: «Мы ещё вернёмся».",
    "Старый железнодорожный вокзал. На табло — расписание поездов двадцатилетней давности.",
    "Мостовая треснула, из асфальта пробивается молодая берёза.",
    "Сгоревшая библиотека. Книги превратились в пепел, одна полка уцелела.",
    "Вдалеке слышен вой — то ли зверь, то ли ветер в проводах.",
    "Старая водонапорная башня. Лестница шатается, но забраться можно.",
    "Разрушенный аквапарк. Горки покосились, бассейны заросли тиной.",
    "Заброшенная АЗС с пробитыми цистернами. Трава вокруг не растёт.",
    "Тлеющий костёр на обочине. Кто-то ушёл совсем недавно.",
    "Ржавый остов легковушки. В салоне — растения и птичье гнездо.",
    "Ветряк, забытый на холме. Лопасти медленно вращаются со скрипом.",
    "Кусты ежевики вдоль старой изгороди. Ягоды крупные и сладкие.",
    "Муравейник выше человеческого роста. Муравьи деловито снуют туда-сюда.",
    "В небе — клин птиц. Они тянутся на юг, хотя уже глубокая осень.",
    "Переходим мелкую речушку вброд. Вода ледяная, но освежает.",
    "Старый указатель: «До города 5 км». Города больше нет.",
    "Поле подсолнухов. Они повёрнуты к солнцу, несмотря ни на что.",
    "Ветви деревьев сплелись над головой, образуя зелёный тоннель.",
    "Туман поднимается от земли. Видимость падает до нескольких метров.",
    "Лягушачий хор у пруда. Кто-то ещё живёт в этом мире.",
    "Град размером с горох барабанит по крыше брошенного сарая.",
    "Следы шин на грязи — кто-то проехал на машине сегодня утром.",
    "В кустах возится ёжик. Фыркает и убегает в подлесок.",
    "Солнечные лучи пробиваются сквозь тучи — красивые, как на картине.",
    "Радуга после короткого дождя. Яркая, до самого горизонта.",
    "Стая ворон срывается с дерева с оглушительным карканьем.",
    // Additional 100
    "Заброшенная детская площадка. Ржавые качели тихо скрипят на ветру.",
    "На обочине лежит брошенный туристический рюкзак. Внутри только дырявый спальник.",
    "Вывеска магазина выцвела на солнце. Буквы почти не разглядеть.",
    "Небольшой овраг, заросший крапивой. Приходится обходить.",
    "Ржавый дорожный знак «Опасный поворот». Поворот есть, дороги давно нет.",
    "Под ногами хрустят сухие ветки и мелкий гравий.",
    "Сломанный фонарный столб накренился над дорогой.",
    "Одинокое сухое дерево выделяется на фоне серого неба.",
    "Проходим мимо брошенного прицепа. Колеса ушли глубоко в землю.",
    "В воздухе пахнет озоном и близким дождём.",
    "На камне греется небольшая ящерица. Завидев нас, она юркает в щель.",
    "Старый колодец с оборванной цепью. На дне блестит вода.",
    "Стая диких голубей вспархивает из колючего кустарника.",
    "Заброшенный павильон остановки. На стене — наивное графити десятилетней давности.",
    "Тропинка ведет через густые заросли шиповника.",
    "Заброшенный яблоневый сад. Плоды мелкие и кислые, но съедобные.",
    "Вдали виднеется силуэт старого элеватора.",
    "Глубокая колея от тяжелой техники, заполненная мутной водой.",
    "Стены полуразрушенного гаража сплошь покрыты сухим мхом.",
    "На заборе висит выцветшее объявление о пропаже собаки.",
    "Сухой перекати-поле медленно катится по пустой дороге.",
    "Под корой старого пня копошатся жуки-короеды.",
    "Заброшенное поле теплиц. Почти все стёкла выбиты, внутри буйствует сорняк.",
    "Ветер гоняет по асфальту пустую пластиковую бутылку.",
    "Старый бетонный дзот времён неизвестно какой войны.",
    "Птичье гнездо в кабине заброшенного трактора.",
    "Маленький ручей с чистой и очень холодной водой.",
    "Вдоль дороги тянется ржавая колючая проволока.",
    "Заброшенный трансформаторный будка. Внутри давно выдрали все провода.",
    "Из туч ненадолго проглядывает луна, освещая путь.",
    "Старый рекламный щит зовет на курорт, которого больше нет.",
    "Следы парнокопытных на размокшей глине.",
    "Покосившийся деревянный мостик через канаву.",
    "Заброшенная пасека. Пустые ульи разбросаны по траве.",
    "Тихий шелест камыша у высыхающего болота.",
    "Остатки старого забора, полускрытые в высоких лопухах.",
    "В небе медленно проплывают тяжёлые свинцовые тучи.",
    "Солнце печёт, на открытых участках совершенно нет тени.",
    "Сухая земля покрыта сеткой мелких трещин.",
    "В кустах вспыхивают и гаснут светлячки.",
    "Ржавый почтовый ящик на покосившемся столбе.",
    "Разрушенное кафе на обочине. От вывески осталась только буква «К».",
    "Ветер доносит далекий стук — где-то болтается кусок железа.",
    "Заброшенный карьер. На дне скопилась вода зеленоватого оттенка.",
    "Старый газетный киоск, заколоченный досками.",
    "Гравийная дорога шуршит под подошвами.",
    "На ветке сидит дятел и ритмично долбит сухую древесину.",
    "Промзона вдали кажется вымершим каменным великаном.",
    "Обрыв над рекой. Отсюда открывается отличный обзор на километры вокруг.",
    "Паутина с каплями росы блестит в лучах утреннего солнца.",
    "Брошенная стройка. Бетонные плиты и торчащая ржавая арматура.",
    "Заброшенный телятник. Крыша провалилась, внутри растёт молодой лесок.",
    "В озере у берега плавают мелкие мальки.",
    "Старый сарай, пахнущий прелым сеном и пылью.",
    "Из расщелины в скале пробивается небольшой росток.",
    "Заброшенный тир. Деревянные мишени сплошь в дырах и трещинах.",
    "Тихий дождь начинаются капать, оставляя темные круги на пыли.",
    "На земле лежит сломанный зонтик, залепленный грязью.",
    "Тропа огибает крупный валун, покрытый лишайником.",
    "Заброшенная метеостанция. Флюгер застрял в одном положении.",
    "Пахнет сыростью и опавшими листьями.",
    "Старая железобетонная труба, полузасыпанная землей.",
    "В траве блестит стеклянное донышко от разбитой бутылки.",
    "Деревянный крест на краю дороги без надписей.",
    "Ветер выдувает мелкую пыль из трещин в сухой земле.",
    "Старый сад с дикой смородиной. Ягоды мелкие, но душистые.",
    "Заброшенный домик лесника. Дверь сорвана с петель.",
    "Небольшая поляна, усыпанная сосновыми шишками.",
    "Старый ж/д тупик. На рельсах стоит единственный ржавый вагон.",
    "В вечернем воздухе кружат густые тучи мошек.",
    "Проходим мимо сложенного штабеля прогнивших брёвен.",
    "Заброшенный лодочный причал. Доски сгнили и ушли под воду.",
    "Тихий шелест тополей вдоль заброшенного шоссе.",
    "Брошенный трехколесный детский велосипед без одного колеса.",
    "Куча известняка и щебня, проросшая чертополохом.",
    "В густой траве мелькает хвост убегающей лисицы.",
    "Старая чугунная колонка. Рычаг нажимается со скрипом, но воды нет.",
    "Заброшенный тир в парке. Ржавые силуэты уточек на подставках.",
    "Сухие стебли борщевика стоят как вымерший лесок.",
    "На небе разгорается яркий, алый закат.",
    "Заброшенная лодочная станция. На берегу лежат дырявые пластиковые корпуса.",
    "Остатки кирпичной трубы от сгоревшей бани.",
    "На дороге лежит сброшенная змеиная кожа.",
    "В воздухе висит легкая дымка от далекого лесного пожара.",
    "Заброшенный летний лагерь. Сгнившие деревянные домики в сосновом бору.",
    "По дну оврага течёт незаметный, но шустрый ручеёк.",
    "Старый дорожный столбик с едва различимой цифрой «42».",
    "Проходим мимо заброшенной птицефабрики. Огромные пустые цеха.",
    "Лёгкий заморозок покрыл траву тонкой белой корочкой.",
    "Вдоль тропы расположились заросли дикой папоротника.",
    "Заброшенный речной бакен на суше, далеко от воды.",
    "Старый медный кабель торчит из земли, срезанный у самого основания.",
    "По небу плывет одинокое тучное облако необычной формы.",
    "Остатки поваленного бурей старого дуба.",
    "Заброшенный спортплощадка. Баскетбольное кольцо без сетки согнуто вниз.",
    "На камнях у воды сидит одинокая цапля и смотрит в гладь.",
    "Старая песчаная насыпь, размытая дождями.",
    "В воздухе пахнет хвоей и нагретой смолой.",
    "Заброшенный пожарный гидрант ярко-красного цвета, тронутый ржавчиной.",
    "Ночь наступает быстро. На небе появляются первые яркие звёзды.",
];

function generateMicroVariant() {
    global $MICRO_BUILDINGS, $MICRO_OBSERVATIONS, $MICRO_SOUNDS, $MICRO_DIRECTIONS, $MICRO_REACTIONS, $MICRO_SMELLS, $MICRO_FOOTING;
    $roll = mt_rand() / mt_getrandmax();
    if ($roll < 0.25) {
        $text = "Проходим мимо " . pick($MICRO_BUILDINGS) . ". " . pick($MICRO_OBSERVATIONS);
        $xp = mt_rand() / mt_getrandmax() > 0.6 ? rangeInt(1, 8) : 0;
        return ['text' => $text, 'type' => 'neutral', 'effects' => $xp ? ['exp' => $xp] : []];
    } elseif ($roll < 0.50) {
        $text = "Слышен " . pick($MICRO_SOUNDS) . " " . pick($MICRO_DIRECTIONS) . ". " . pick($MICRO_REACTIONS);
        return ['text' => $text, 'type' => mt_rand() / mt_getrandmax() > 0.7 ? 'danger' : 'neutral', 'effects' => []];
    } elseif ($roll < 0.75) {
        $text = pick($MICRO_FOOTING) . " " . pick($MICRO_OBSERVATIONS);
        return ['text' => $text, 'type' => 'neutral', 'effects' => []];
    } else {
        $text = pick($MICRO_SMELLS) . " Тянет " . pick($MICRO_DIRECTIONS) . ".";
        return ['text' => $text, 'type' => 'neutral', 'effects' => []];
    }
}

function generateMicroEvent($zoneDesc = '', $faction = '') {
    global $MICRO_NEUTRAL, $MICRO_BUILDINGS, $MICRO_OBSERVATIONS, $MICRO_SOUNDS, $MICRO_DIRECTIONS, $MICRO_REACTIONS, $MICRO_SMELLS, $MICRO_FOOTING;
    // ~55% pure flavor (no effects), ~45% small reward/penalty (matching reference master)
    $roll = mt_rand() / mt_getrandmax();
    if ($roll < 0.55) {
        $variant = mt_rand() / mt_getrandmax();
        if ($variant < 0.33) {
            $text = "Проходим мимо " . pick($MICRO_BUILDINGS) . ". " . pick($MICRO_OBSERVATIONS);
        } elseif ($variant < 0.50) {
            $text = "Слышен " . pick($MICRO_SOUNDS) . " " . pick($MICRO_DIRECTIONS) . ". " . pick($MICRO_REACTIONS);
        } elseif ($variant < 0.67) {
            $text = pick($MICRO_FOOTING) . " " . pick($MICRO_OBSERVATIONS);
        } else {
            $text = pick($MICRO_SMELLS) . " Тянет " . pick($MICRO_DIRECTIONS) . ".";
        }
        return ['text' => $text, 'type' => 'neutral', 'effects' => []];
    }
    $text = pick($MICRO_NEUTRAL);
    $effects = [];
    $sub = ($roll - 0.55) / 0.45;
    if ($sub < 0.25) {
        $effects['chips'] = mt_rand(1, 4);
    } elseif ($sub < 0.50) {
        $effects['exp'] = mt_rand(1, 8);
    } elseif ($sub < 0.70) {
        $effects['healPercent'] = mt_rand(1, 2) / 100;
    } elseif ($sub < 0.85) {
        $effects['damagePercent'] = mt_rand(1, 3) / 100;
    } else {
        $effects['itemCount'] = 1;
    }
    return ['text' => $text, 'type' => 'neutral', 'effects' => $effects];
}

$TRAP_TEXTS_RICH = [
    [
        'text' => 'Мужчина с перевязанным глазом машет тебе: «Помоги, брат, друзей в засаде бросили!» Ведёт тебя прямиком в ловушку — трое бандитов встречают тебя дубинами. Еле отбиваешься и теряешь часть припасов.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Распознаёшь обман — готовишься к бою заранее и застаёшь бандитов врасплох.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Замечаешь второго в кустах — бьёшь первым, вырубаешь главаря с одного удара.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Бандиты действуют слаженно — дубины бьют с двух сторон, припасы сыплются на землю.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.12),'chips'=>NC($l,2)];}],
                ['text' => 'Главарь банды подходит ближе — нюхает твой рюкзак и решает забрать всё.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.10,0.15),'chips'=>NC($l,3)];}],
                ['text' => 'Бросаешь горсть пыли в глаза главарю, прорываешься сквозь строй, хватая свой рюкзак.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.06),'exp'=>E($l,3)];}],
            ],
        ],
    ],
    [
        'text' => 'Девушка с заплаканным лицом просит воды. Ты протягиваешь флягу — она выбивает её у тебя из рук, и тут же из кустов выбегают её сообщники. «Шмонай его!» Потеряно часть чипов.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Чувствуешь неладное — держишь флягу крепко, она не может её выбить. Сообщники выбегают раньше времени, ты готов.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Замечаешь шевеление в кустах заранее — делаешь шаг назад, разрывая дистанцию.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Девушка ловко выбивает флягу — сообщники налетают, обшаривают карманы. Чипы исчезают.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>NC($l,2),'damagePercent'=>RF(0.04,0.08)];}],
                ['text' => 'Из кустов выбегает пятеро вместо троих — засада оказалась крупнее, чем думал.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.14),'chips'=>NC($l,3)];}],
                ['text' => 'Прикрываешь лицо рукой, уворачиваешься от удара и бежишь в сторону леса. Чипы сыплются, но жизнь цела.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.05),'chips'=>NC($l,1),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Запах дыма и жареного мяса. За столом сидит компания, машет: «Садись, путник, угощайся!» Мясо оказывается отравленным. Ты теряешь сознание и просыпаешься без части вещей.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Нюхаешь мясо — запах подозрительный. Отказываешься от угощения, компания теряет интерес.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Достаёшь свои припасы — «У меня своё есть, спасибо». Компания злится, но не нападает.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Мясо кажется вкусным — съедаешь кусок. Сознание мутится, падаешь лицом в тарелку.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.14),'chips'=>NC($l,2)];}],
                ['text' => 'Компания оказывается больше — из-за дерева выходят ещё трое. Котёл с отравой на всех.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.10,0.18),'chips'=>NC($l,3)];}],
                ['text' => 'Замечаешь странный привкус — откладываешь кусок, но компания уже окружила. Приходится пробиваться.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.06),'exp'=>E($l,3),'chips'=>NC($l,1)];}],
            ],
        ],
    ],
    [
        'text' => 'Яркая тряпка на ветке — якобы указатель к «Бесплатному складу». Там — растяжка с гранатой. Чудом остаёшься жив, но контужен и зол.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Замечаешь тонкую леску поперёк прохода — растяжка обезврежена. В «складе» находишь припасы.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,3)];}],
                ['text' => 'Тряпка слишком яркая — явно приманка. Обходишь склад стороной, находишь схрон в скалах.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Ничего не подозревая, заходишь в склад — граната взрывается. Контужен, оглушён.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.12,0.20),'chips'=>NC($l,1)];}],
                ['text' => 'Растяжка ведёт к цепной реакции — взрываются ещё две гранаты. Мощный взрыв.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.18,0.25),'chips'=>NC($l,2)];}],
                ['text' => 'Замечаешь растяжку в последний момент — падаешь ничком. Взрыв задевает спину, но жить будешь.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.05,0.10),'exp'=>E($l,3)];}],
            ],
        ],
    ],
    [
        'text' => '"Эй, чувак, хочешь дешёвый ствол?" — парень в капюшоне достаёт пистолет. Пистолет — муляж, а пока ты смотришь, его подельник обчищает твой рюкзак.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Узнаёшь модель — слишком лёгкий для настоящего. Бьёшь по руке, муляж летит в грязь.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Держишь рюкзак перед собой — подельник не может расстегнуть молнию. Поворачиваешься и бьёшь.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Пистолет выглядит настоящим — отвлекаешься. Подельник вытаскивает часть припасов.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>NC($l,2),'damagePercent'=>RF(0.02,0.05)];}],
                ['text' => 'Из-за угла выходит второй подельник — засада на три стороны. Пути к отступлению нет.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.12),'chips'=>NC($l,3)];}],
                ['text' => 'Отбрасываешь рюкзак в сторону — подельник бросается за ним. Пока они заняты, атакуешь.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04),'exp'=>E($l,3),'chips'=>NC($l,1)];}],
            ],
        ],
    ],
    [
        'text' => 'Из темноты — крик о помощи. Ты бежишь на звук и проваливаешься в яму-ловушку, прикрытую ветками. На дне — старые кости и вонь. Выбираешься, но ранен и выпачкан в грязи.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Крик стихает — понимаешь, что это подстроено. Пятишься к дереву и замечаешь верёвку ямы.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Зажигаешь фонарь — внизу видны кости. Точно ловушка. Обходишь, но теряешь время.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Бежишь на крик и проваливаешься. Яма глубокая — выбираешься весь в синяках и грязи.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.06,0.12),'chips'=>NC($l,1)];}],
                ['text' => 'На дне ямы оказывается нора — оттуда вылезают крысы. Кусают тебя, пока карабкаешься.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.14),'exp'=>E($l,2)];}],
                ['text' => 'Кричащий оказывается манекеном с динамиком. Ловушка для дураков. Ты дурак, но живой.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.05),'exp'=>E($l,3)];}],
            ],
        ],
    ],
    [
        'text' => '"Меня зовут {male}, я бывший военный. Вступи в наш отряд — у нас еда, оружие, бабы!" В отряде оказывается секта каннибалов. С боем прорываешься наружу.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => '"Военный" щёлкает пальцами слишком нервно — профи так не делают. Отказываешься вежливо.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Замечаешь человеческие кости у костра — "откуда, говорю, мясо?" Он бледнеет.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Вступаешь в отряд — на третий день замечаешь, что "тушёнка" подозрительно знакомая. Бой.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.12,0.22),'chips'=>NC($l,2)];}],
                ['text' => 'Сектантов оказывается больше дюжины — засада. Прорываешься с боем, теряя часть припасов.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.14,0.22),'chips'=>NC($l,3),'combat'=>true];}],
                ['text' => 'Предлагаешь "военному" сделку — рассказываешь про другой отряд. Он уводит своих. Ты сбегаешь.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Красивая женщина в чистой одежде стоит на пороге брошенного магазина. «Заходи, я одна, мне страшно». Внутри — ловушка: двое с ножами. Едва уносишь ноги.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Слишком чистая для Пустоши — явно подстава. Проходишь мимо, женщина зло ругается вслед.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Заходишь с оружием наготове — замечаешь нож в рукаве женщины. Бьёшь первой.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Заходишь и попадаешь в ловушку — двое с ножами атакуют. Едва уносишь ноги, получая порезы.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.14),'chips'=>NC($l,2)];}],
                ['text' => 'Из подсобки выбегают ещё двое — четверо против одного. Отбиваешься, но теряешь припасы.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.10,0.18),'chips'=>NC($l,3)];}],
                ['text' => 'Внутри оказывается ловушка с сигнализацией — на шум прибегают ещё люди. Сбегаешь через чёрный ход.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.04,0.08),'exp'=>E($l,3)];}],
            ],
        ],
    ],
    [
        'text' => 'Странник предлагает сыграть в кости: "Удвою твои чипы, если выиграешь!" Кости краплёные. Проигрываешь всё, что поставил.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Замечаешь, что кости падают одинаково — крап. "Спасибо, не интересно". Странник злится.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Достаёшь свои кости — "Давай на моих". Странник отказывается — явно боится честной игры.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Соглашаешься и проигрываешь всё. Кости явно краплёные — чипы уплывают в карман странника.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>NC($l,2),'damagePercent'=>RF(0.01,0.03)];}],
                ['text' => 'Странник не один — из-за угла выходят двое. Если проиграешь — не отдашь просто так.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.06,0.10),'chips'=>NC($l,3)];}],
                ['text' => 'Соглашаешься, но ставишь маленькую сумму. Проигрываешь — странник уходит довольный, но ты почти ничего не потерял.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>NC($l,1),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Дорогу перегородил «дорожный сборщик» — вооружённый тип с ржавым автоматом. "Плати за проход". Платишь, но в последний момент он пытается забрать всё. Отбиваешься, но чипы уже потеряны.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Автомат ржавый — даже не встанет. Достаёшь свой ствол, сборщик пятится: "Ладно, проходи".', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Автомат заклинивает — сборщик пытается передёрнуть затвор, но бесполезно. Атакуешь.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Платишь, но сборщик хватает твой рюкзак. Отбиваешь, теряя часть чипов в драке.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>NC($l,2),'damagePercent'=>RF(0.04,0.08)];}],
                ['text' => 'Из кустов выходят его подельники — целая банда сборщиков. Окружают со всех сторон.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.14),'chips'=>NC($l,3)];}],
                ['text' => 'Сборщик срывается — автомат стреляет очередью в воздух. Ты падаешь, прикрывая голову, и теряешь часть чипов.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.06),'chips'=>NC($l,1),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => '"Помоги откопать колодец!" — кричит мужик из ямы. Ты наклоняешься — он хватает тебя за шкирку и стаскивает вниз. Под землёй — старая штольня. Выбираешься через затопленный тоннель.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Слишком громко кричит для "застрявшего" — явно приманка. Достаёшь верёвку и делаешь вид, что помогаешь.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Заглядываешь в яму — внизу виден лаз. Мужик не застрял, он ждёт жертву. Броска не происходит.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Наклоняешься — мужик хватает за шкирку и тащит вниз. В штольне темно и сыро. Выбираешься через тоннель.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.10,0.18),'exp'=>E($l,4)];}],
                ['text' => 'Мужик оказывается не один — из тоннеля выходят двое. Засада под землёй.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.12,0.20),'chips'=>NC($l,2)];}],
                ['text' => 'Кидаешь мужику палку — "Держись!" Он хватает, палка гнилая, ломается. Он падает обратно в яму. Ты уходишь.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Лже-сталкер продаёт тебе карту "сокровищ". Он ведёт тебя к муляжу, где вместо сундука — взрывпакет. Теряешь часть снаряжения.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Карта явно нарисована от руки — свежие чернила. Разворачиваешься и уходишь.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Идёшь с ним, но держишь дистанцию. Он указывает на муляж — ты уже сзади, бьёшь первым.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Покупаешь карту и идёшь к "сокровищу". Вместо сундука — взрывпакет. Теряешь снаряжение.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.15),'chips'=>NC($l,2)];}],
                ['text' => 'Лже-сталкер приводит к банде — из кустов выходят четверо. Ловушка на два этапа.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.10,0.18),'chips'=>NC($l,3)];}],
                ['text' => 'Замечаешь, что сталкер нервно оглядывается. Достаёшь оружие — он срывается и бежит.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Женщина с ребёнком стоит на дороге, голосует. Ты останавливаешься — "ребёнок" оказывается муляжом, а из кустов выбегают грабители. "Кошелёк или жизнь!" Отбиваешься с трудом.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => '"Ребёнок" не шевелится — явно кукла. Достаёшь оружие, женщина бледнеет, грабители не выходят.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Останавливаешься на расстоянии. Женщина приближается — слишком быстрая для "спасающейся".', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Останавливаешься — "ребёнок" муляж, грабители выбегают. Отбиваешься, теряя часть чипов.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.06,0.12),'chips'=>NC($l,2)];}],
                ['text' => 'Грабителей оказывается шестеро — целая шайка. Окружают, требуют всё.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.15),'chips'=>NC($l,3)];}],
                ['text' => 'Женщина плачет по-настоящему — муляж, но она не в курсе? Грабители выбегают, она кричит.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.06),'exp'=>E($l,3)];}],
            ],
        ],
    ],
    [
        'text' => 'Странный аппарат посреди дороги — "автомат желаний". Надпись: "Брось 10 чипов и загадай". Бросаешь — аппарат выплёвывает ржавую банку с газом. Газ едкий, глаза слезятся.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Пинком сбиваешь аппарат — внутри механизм с баллончиком. Обычный развод. Забираешь чипы обратно.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}],
                ['text' => 'Замечаешь трубку, ведущую в кусты — кто-то управляет аппаратом дистанционно.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Бросаешь 10 чипов — аппарат плюётся газом в лицо. Глаза слезятся, чипы пропали.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.06),'chips'=>NC($l,2)];}],
                ['text' => 'Аппарат оказывается ловушкой — из-за камней выбегают двое с дубинами. "Ещё чипы есть?"', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.06,0.12),'chips'=>NC($l,2)];}],
                ['text' => 'Вскрываешь аппарат монтировкой — внутри баллончик и механизм. Самоделка.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,3)];}],
            ],
        ],
    ],
    [
        'text' => 'Шериф самопровозглашённый на въезде в посёлок: "Пошлина на вход — 20 чипов с рыла". Платишь — он пропускает. В посёлке ни души — это ловушка. Из домов выходят люди с оружием.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Шериф слишком нервный — то ли пьян, то ли врёт. Предлагаешь заплатить позже. Он соглашается — слишком легко.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}],
                ['text' => 'Замечаешь следы на дороге — много людей прошло, но никто не вернулся. Тревожный знак.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Платишь 20 чипов — в посёлке ни души. Из домов выходят люди с оружием. Ловушка.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.15),'chips'=>NC($l,2)];}],
                ['text' => '"Шериф" свистит — из домов выбегает толпа. Пути назад нет — только вперёд через строй.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.10,0.18),'chips'=>NC($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Видишь, что "шериф" ворует у прохожих — он шулер. Достаёшь камеру, снимаешь. Всё вскрывается.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,3)];}],
            ],
        ],
    ],
    [
        'text' => '"Сыграем на интерес?" — предлагает парень в дорогой куртке. Он вытаскивает колоду карт. Карты меченые — ты проигрываешь все чипы, что были в кармане.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Куртка дорогая, но грязная — явно напоказ. "Не играю с незнакомцами". Парень злится.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Достаёшь свои карты — "Давай на моих, я тасую". Парень отказывается — колода краплёная.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Соглашаешься — проигрываешь всё. Карты меченые, парень улыбается. Чипы уплывают.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>NC($l,2)];}],
                ['text' => 'Парень не один — из-за угла выглядывает здоровяк. Если проиграешь — не отдашь просто так.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.04,0.08),'chips'=>NC($l,2)];}],
                ['text' => 'Соглашаешься, ставишь 5 чипов. Проигрываешь — парень недоволен, уходит.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>NC($l,1),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => '"Помоги выбраться!" — человек наполовину влез в узкую трубу и застрял. Ты тянешь его — он оказывается легче пера, но из трубы вылетает рой мутировавших насекомых. Кусают больно.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => '"Легче пера?" — дёргаешь на себя, он вылетает как пробка. В трубе пусто. Ложная тревога.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Слышишь жужжание внутри. "Там насекомые, мужик. Я пас". Он орёт, но ты не рискуешь.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Тянешь — он лёгкий, из трубы вылетает рой. Насекомые кусают, лицо и руки опухают.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.06,0.12),'exp'=>E($l,3)];}],
                ['text' => 'Из трубы вылезают ещё двое — подельники. Рой отвлекает, пока они атакуют с дубинами.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.15),'chips'=>NC($l,2)];}],
                ['text' => 'Кидаешь дымовую шашку в трубу. Насекомые вылетают, дым душит и их, и "застрявшего".', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Привал у красивого озера. Вода прозрачная — слишком прозрачная. Со дна поднимаются пузыри. Вода начинает кипеть — озеро радиоактивное. Получаешь ожоги, быстро ретируясь.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'В озере нет рыбы — стерильно чисто. Биота отсутствует. Не подходишь к берегу.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Достаёшь дозиметр — трещит. Озеро фонит. Отходишь на безопасное расстояние.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Пузыри кажутся забавными — подходишь. Вода вскипает, обжигает ноги. Бежишь.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.14)];}],
                ['text' => 'Озеро светится — радиоактивное свечение. Воздух нагревается, тяжело дышать.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.06,0.12),'chips'=>NC($l,1)];}],
                ['text' => 'Бросаешь камень — он шипит и растворяется. Кислота. Уходишь, пока цел.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Двое играют в "русскую рулетку" с трёхзарядным револьвером. Пьяный хохот. "А вот и третий! Садись, не бойся!" Отказываешься — они обижаются и открывают стрельбу.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Пьяные в дымину — револьвер может выстрелить в любого. Достаёшь ствол, они трезвеют.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => '"Сыграем в карты на интерес, без стрельбы". Один соглашается, второй злится.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Отказываешься — обижаются и стреляют. Пули летят мимо, одна задевает плечо.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.06,0.10),'combat'=>true];}],
                ['text' => 'Револьвер щёлкает — выстрел в голову одного. Второй в ярости, винит тебя.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.05,0.10),'chips'=>NC($l,2)];}],
                ['text' => 'Соглашаешься — револьвер пуст, патрон не вставляли. Блеф. Забираешь их чипы.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,3)];}],
            ],
        ],
    ],
    [
        'text' => '"Место силы" — табличка у дерева. Под деревом — "жертвенный алтарь" с запиской: "Оставь дань, получишь удачу". Оставляешь чипы — ничего не происходит. Чипы пропали.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Алтарь из подручных материалов — доски, краска, гвозди. Шарлатанство. Проходишь мимо.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Следы у дерева — кто-то прятался за стволом. Ждёт жертву. Уходишь незаметно.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Оставляешь 20 чипов — ничего не происходит. Чипы исчезают в щели алтаря.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>NC($l,2),'exp'=>E($l,2)];}],
                ['text' => 'Из-за алтаря выходит "монах" — "Ты оскорбил духов! Штраф!" С него станется.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.04,0.08),'chips'=>NC($l,2)];}],
                ['text' => 'Оставляешь фальшивые чипы (обёртки). Ночью слышишь: "Обманули!" Смешно.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Пьяный водитель на древнем мотоцикле чуть не сбивает тебя. Он слезает и начинает агрессивно выяснять отношения. За его спиной появляются трое друзей.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Мотоцикл разваливается — глушитель отвалился, колёса стёрты. Водитель пьян.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Друзья шатаются — все пьяные. "Давай мировую?" Они забывают об агрессии.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Водитель наезжает — удар плечом, падаешь. Друзья пинают, отбирают чипы.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.06,0.12),'chips'=>NC($l,2)];}],
                ['text' => 'Друзья достают оружие — цепь, нож, бита. Серьёзная угроза. Пятишься, но они наступают.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.14),'chips'=>NC($l,2)];}],
                ['text' => 'Водитель падает с мотоцикла — пьяный в хлам. Друзья смеются, помогают. Уходишь.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'В заброшенном доме слышен детский плач. Ты заходишь — и дверь захлопывается. Ловушка: дом подготовлен для отлова "живого товара" работорговцами. Пробиваешь стену и сбегаешь.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Плач из подвала — дверь заперта, за ней тишина. Не ломись, осмотрись.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Наличник свежий — дверь захлопнулась не случайно. Дом используется.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Дверь захлопывается — темно, шаги наверху. Ты не один. Пробиваешь стену.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.10,0.18),'exp'=>E($l,4)];}],
                ['text' => 'Трое с верёвками из темноты — "Живой товар! Хватай!" Бой в замкнутом.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.12,0.20),'chips'=>NC($l,2)];}],
                ['text' => 'Кричишь: "Полиция! Обыск!" Работорговцы в панике, ты сбегаешь с их припасами.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Дорогу перегораживает самодельный шлагбаум. Рядом трое с автоматами. «Пошлина за проезд — 30 чипов. Досмотр транспорта». Табличка криво намалёвана, «таможенники» нервные.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Замечаешь, что автоматы на трофейных ремнях — не свои. Проверяешь их реакцию.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}],
                ['text' => 'Предлагаешь изоленту в уплату — «у нас тут ремонт забора, сгодится».', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.01,0.03),'exp'=>E($l,2)];}],
                ['text' => 'Платишь и проходишь — за спиной слышишь смешки. Они делят чипы и готовятся к следующему.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>NC($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Видишь, что шлагбаум держится на хлипкой пластиковой трубе. Удар — и он падает.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Внезапно слышен звук мотора — едет настоящий патруль. Лже-таможенники в панике.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Мост через реку частично обрушен. Посередине застрял старый грузовик. Внизу — мутная вода. На том берегу кто-то машет — просит помощи, мол, застрял на неделю.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Пытаешься отремонтировать настил из досок — часть проваливается под ногами.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.05),'exp'=>E($l,2)];}],
                ['text' => 'Помогаешь парню вытолкать грузовик — он оказывается бандитом, в кузове награбленное.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Замечаешь, что мост заминирован. Кто-то не хотел, чтобы переходили. Мины старые.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'damagePercent'=>RF(0.04,0.08)];}],
                ['text' => 'Вода в реке подозрительно пахнет — мутировавшая органика. Лучше не лезть.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.01,0.03),'exp'=>E($l,2)];}],
                ['text' => 'Человек на том берегу исчез — был ли он вообще? Призрак? Или засада?', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}],
            ],
        ],
    ],
    [
        'text' => 'Заброшенный магазин с вывеской «Продукты 24 часа». На полках — консервы, вода, батарейки. Всё выглядит свежим. Слишком свежим для этих развалин.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Хватаешь консервы с полки — под ними проволока, зажигалка, самодельный запал.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.04,0.08),'exp'=>E($l,2)];}],
                ['text' => 'Вода в бутылках мутная — явно из лужи. Проверяешь герметичность.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.01,0.03),'exp'=>E($l,2)];}],
                ['text' => 'Батарейки на кассе — старые, но в упаковке. Проверяешь — некоторые рабочие.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Из подсобки слышен шум — там кто-то есть. Бандиты ждут клиента.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'На кассе — записка: «Это ловушка. Уходи». Кто-то был тут до тебя.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Тропа петляет через овраг, затянутый густым туманом. Внизу — кости и битая техника. Тишина звенит в ушах. Кажется, что туман движется против ветра.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Достаёшь пластиковый лист — укрываешься, туман оседает на нём каплями.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,2)];}],
                ['text' => 'Туман пахнет гарью — поджигаешь факел, туман рассеивается.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Связываешь одежду изолентой — не даёшь туману проникнуть под куртку.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'В тумане слышны шаги — кто-то ходит рядом, но никого не видно.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Туман ядовит — чувствуешь жжение в горле. Нужно лекарство.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'damagePercent'=>RF(0.01,0.03)];}],
            ],
        ],
    ],
    [
        'text' => 'На дороге сидят двое — один перевязан окровавленным бинтом, другой держит его за плечо. «Помоги, брат! На нас напали!» Голос дрожит, но глаза бегают.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Осматриваешь «раненого» — бинт чистый, кровь — краска. Ловушка!', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}],
                ['text' => 'Протягиваешь воду — «раненый» отводит взгляд. Пьёт, не глядя. Подозрительно.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.01,0.03),'exp'=>E($l,2)];}],
                ['text' => 'Даёшь консервы — пока они едят, замечаешь ещё одного в кустах. Трое.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,2)];}],
                ['text' => 'Видишь нож под курткой «раненого» — он не ранен, он готовится.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'damagePercent'=>RF(0.01,0.03)];}],
                ['text' => 'Кричишь: «Сзади!» — они оборачиваются. Пока отвлеклись — бежишь.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Старый колодец на краю заброшенной деревни. Изнутри доносится запах воды и сырости. Ржавая цепь обрывается в темноту. Кто-то привязал к ней ведро с чипами.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Тянешь цепь — ведро идёт тяжело. Вместо чипов — рой мутировавших пиявок.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.04,0.08),'exp'=>E($l,2)];}],
                ['text' => 'Колодец старый — доски вокруг подгнили. Можно упасть.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}],
                ['text' => 'В ведре — битое стекло и ржавые иглы. Кто-то хочет заразить тебя.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}],
                ['text' => 'Из колодца идёт пар — под землёй геотермальный источник. Горячо.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'damagePercent'=>RF(0.01,0.03)];}],
                ['text' => 'Внизу кто-то есть — слышен кашель. Там человек, упал и не может выбраться.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}],
            ],
        ],
    ],
    [
        'text' => 'Из-за поворота вылетает ржавый грузовик с бандитами в кузове. Они палят в воздух: «Стоять! Гони чипы!» За рулём — пьяный водила, грузовик виляет из стороны в сторону.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Грузовик шатается — можно запрыгнуть в кузов, отвлекая бандитов.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Водила пьяный — можно крикнуть, отвлечь. Он теряет управление.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'damagePercent'=>RF(0.03,0.06)];}],
                ['text' => 'Из кузова вылетает ящик — бандиты везли добычу. Можно подобрать.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}],
                ['text' => 'Бандиты в кузове сцепились — грызутся за выпивку. Воспользуйся хаосом.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Грузовик несётся на тебя — прыгай в сторону. Увернуться почти невозможно.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'damagePercent'=>RF(0.04,0.08)];}],
            ],
        ],
    ],
    [
        'text' => 'Лесная тропа усеяна ржавыми капканами и растяжками. Кто-то поставил их густо, на разной высоте. Ветки хрустят под ногами — каждый шаг может стать последним.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Замечаешь тонкую проволоку на уровне шеи. Наклоняешься — растяжка перед лицом.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Капкан на ноге — зубья ржавые, но держат мёртво.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.05),'exp'=>E($l,2)];}],
                ['text' => 'Ржавый капкан приманен консервной банкой — внутри заплесневелая еда.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}],
                ['text' => 'Пластиковая мина-растяжка — корпус треснул, взрывчатки не видно.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Тропа ведёт к норе — изнутри запах топлива. Кто-то хранит канистры.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}],
            ],
        ],
    ],
];
$LOOT_TEXTS_RICH = [
    [
        'text' => 'Среди мусора замечаешь блеск. Под ржавым листом железа — аккуратно сложенные предметы. Кто-то явно прятал это на чёрный день.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Осматриваем тайник — находим припасы и ценные вещи.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,4)];}],
                ['text' => 'Промываем находки — определяем настоящую ценность трофеев.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5)];}],
                ['text' => 'Тайник заминирован — срабатывает растяжка.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06,'chips'=>NC($l,1)];}],
                ['text' => 'Из-под мусора вылетает рой мутантов — потревожили гнездо.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,2)];}],
                ['text' => 'Торопливо собираем всё подряд — часть ломается при переноске.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
    'text' => 'В заброшенном научном комплексе среди бетонных руин находишь старый гермобокс с маркировкой «Проект Эволюция». Внутри ещё работают индикаторы — довоенная лаборатория законсервировалась сама.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'Открываешь гермобокс. Внутри сохранились экспериментальные микросхемы и записи исследований.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,4)];}],

            ['text' => 'Извлекаешь генетический архив. Возможно, данные помогут учёным изучить происхождение мутантов.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,3)];}],

            ['text' => 'Автоматическая система защиты принимает тебя за нарушителя. Из стен выдвигаются старые боевые турели.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,2)];}],

            ['text' => 'В лаборатории просыпается экспериментальный мутант. Существо когда-то было человеком.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],

            ['text' => 'Разбираешь старое оборудование лаборатории. Большинство деталей бесполезно, но некоторые механизмы ещё пригодны.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'exp'=>E($l,2)];}],
        ],
    ],
],
[
    'text' => 'В руинах старого мегаполиса находишь подземный вход с эмблемой довоенного энергетического концерна. За дверью — автономная станция обслуживания, которая работала последние сто лет.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'Восстанавливаешь питание станции. Внутри сохранились контейнеры с технологиями довоенного производства.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'itemCount'=>1];}],

            ['text' => 'Находишь терминал с картами старых коммуникаций города. Многие подземные пути ещё существуют.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,5),'chips'=>C($l,3)];}],

            ['text' => 'Система защиты принимает тебя за диверсанта. Из стен активируются старые лазерные турели.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.11,'chips'=>NC($l,2)];}],

            ['text' => 'Из технических тоннелей выходят мутировавшие рабочие. Когда-то это были люди, пережившие первые годы катастрофы.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,1)];}],

            ['text' => 'Разбираешь оборудование станции. Большая часть электроники мертва, но некоторые детали ещё ценны.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'chips'=>C($l,2),'exp'=>E($l,2)];}],
        ],
    ],
],


[
    'text' => 'Среди обломков военного комплекса обнаруживаешь огромного робота-охранника. Его корпус покрыт ржавчиной, но один оптический сенсор всё ещё светится.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'Восстанавливаешь часть системы робота. Он передаёт архив последних приказов армии старого мира.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,5)];}],

            ['text' => 'Меняешь старый протокол безопасности. Робот открывает склад боевого снаряжения.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,3)];}],

            ['text' => 'Робот распознаёт тебя как враждебную цель и запускает боевой режим.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.12];}],

            ['text' => 'Корпус робота повреждён и внутри происходит утечка охлаждающей жидкости. Ядовитый пар заполняет помещение.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],

            ['text' => 'Разбираешь останки робота. Модель слишком старая, но отдельные модули ещё можно использовать.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,3),'itemCount'=>rangeInt(0,1)];}],
        ],
    ],
],
[
    'text' => 'В глубине заражённой зоны находишь старое поселение учёных. Дома полуразрушены, но в одном из бункеров ещё горит аварийный свет. На стене надпись: «Последний эксперимент завершён».',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'Входишь в бункер. В лабораторных шкафах сохранились образцы технологий и научные записи.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,5)];}],

            ['text' => 'Находишь дневники учёных. В них описаны первые годы после атомной войны и причины появления некоторых мутантов.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,6)];}],

            ['text' => 'Из биокамеры вырывается мутировавшее создание. Оно оказалось результатом экспериментов учёных.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.12,'chips'=>NC($l,1)];}],

            ['text' => 'Система очистки воздуха выходит из строя. В помещение поступает радиоактивная пыль.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09];}],

            ['text' => 'Разбираешь оборудование лаборатории. Большая часть уже бесполезна, но некоторые детали ещё имеют ценность.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}],
        ],
    ],
],


[
    'text' => 'Среди радиоактивного леса обнаруживаешь старый военный узел связи. Огромная антенна всё ещё направлена в небо и периодически передаёт неизвестный сигнал.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'Подключаешься к системе связи. Получаешь координаты забытых военных складов.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,4)];}],

            ['text' => 'Находишь архив сообщений старого гарнизона. Последняя запись была сделана через неделю после начала войны.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,6),'chips'=>C($l,3)];}],

            ['text' => 'Сигнал оказывается ловушкой. Кто-то использовал старый маяк, чтобы заманивать сталкеров.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,2)];}],

            ['text' => 'Сигнал привлекает древний боевой дрон. Он считает территорию всё ещё военной зоной.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.11];}],

            ['text' => 'Разбираешь оборудование связи. Некоторые модули всё ещё работают.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,3),'itemCount'=>rangeInt(0,1)];}],
        ],
    ],
],


[
    'text' => 'После сильного выброса находишь вход в старый подземный комплекс. По документам это был центр управления климатическими системами планеты.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'Восстанавливаешь главный терминал и находишь карты довоенных ресурсов.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,5)];}],

            ['text' => 'Находишь резервный склад автономных фильтров и очистителей воды.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,2)];}],

            ['text' => 'Система климат-контроля запускает аварийный режим. Потоки горячего воздуха обжигают помещение.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10];}],

            ['text' => 'В глубине комплекса пробуждаются сервисные роботы, повреждённые радиацией.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,1)];}],

            ['text' => 'Изучаешь старые системы комплекса. Большинство технологий уже никто не способен повторить.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,4),'chips'=>C($l,2)];}],
        ],
    ],
],
[
    'text' => 'После сильного выброса земля возле старой промышленной зоны покрылась странным стеклянным налётом. В центре аномалии лежит довоенный контейнер с эмблемой корпорации «НейроСинтез».',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'Осторожно извлекаешь контейнер. Внутри находятся экспериментальные нейромодули для человеческого мозга.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,7),'exp'=>E($l,5)];}],

            ['text' => 'Считываешь память контейнера. Там данные о первых экспериментах над усилением человеческого организма.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,6)];}],

            ['text' => 'Аномалия активируется. Металл вокруг начинает плавиться, контейнер выбрасывает ударную волну.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.12,'chips'=>NC($l,2)];}],

            ['text' => 'Из зоны выходит изменённое существо. На его теле видны следы старых имплантов.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10];}],

            ['text' => 'Изучаешь следы аномалии. Учёные будущего наверняка заплатили бы за эти наблюдения.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,4),'chips'=>C($l,3)];}],
        ],
    ],
],

[
    'text' => 'В разрушенном посёлке находишь работающий радиопередатчик. Из динамика слышится голос: «Если кто-то меня слышит — ответьте. Мы остались здесь».',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Отвечаешь на сигнал. Группа выживших делится координатами старого склада.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}],

            ['text' => 'Идёшь по сигналу и находишь старую группу инженеров, которые ремонтируют довоенные устройства.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,5),'chips'=>C($l,4)];}],

            ['text' => 'Оказывается, сигнал был приманкой мародёров. Они ждали сталкеров, которые придут на помощь.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,1)];}],

            ['text' => 'На сигнал реагирует старый военный дрон. Он принимает людей рядом за вражескую группу.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.11];}],

            ['text' => 'Записываешь частоту передатчика. Возможно, когда-нибудь она поможет найти других выживших.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}],
        ],
    ],
],


[
    'text' => 'В глубине леса обнаруживаешь старый исследовательский комплекс. В документах он обозначен как центр изучения адаптации человека к радиации.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'В лаборатории находишь защищённые контейнеры с медицинскими препаратами.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.08,0.15),'itemCount'=>1];}],

            ['text' => 'Находишь записи экспериментов. Учёные пытались создать людей, устойчивых к новому миру.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,6)];}],

            ['text' => 'В камере содержания обнаруживается выживший экспериментальный субъект.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10];}],

            ['text' => 'Система жизнеобеспечения ломается. Из лаборатории выходит заражённый газ.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.12];}],

            ['text' => 'Изучаешь лабораторию и оставляешь отметки на карте для других сталкеров.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,4),'chips'=>C($l,2)];}],
        ],
    ],
],
[
    'text' => 'В овраге обнаруживаешь странные следы. Кто-то недавно проходил здесь, оставляя отпечатки тяжёлых механических ног.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Следуешь за отпечатками и находишь заброшенного разведывательного робота. Его память частично цела.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,5)];}],

            ['text' => 'Восстанавливаешь питание робота. Он показывает карту ближайших опасных зон.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,6),'chips'=>C($l,3)];}],

            ['text' => 'Робот активирует боевой режим. Его старая программа всё ещё считает войну продолжающейся.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.12];}],

            ['text' => 'На сигнал робота приходят дикие мутанты. Они реагируют на его энергию.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10];}],

            ['text' => 'Оставляешь робота на месте. Возможно, кто-то сможет восстановить его полностью.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,4)];}],
        ],
    ],
],
[
    'text' => 'Среди пустоши обнаруживаешь огромный город-призрак. Странно то, что внутри некоторых зданий всё ещё работает электричество.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Находишь подземное убежище, где несколько поколений людей пережили войну в изоляции.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,12),'exp'=>E($l,12),'itemCount'=>1];}],

            ['text' => 'В городском архиве находишь записи о первых годах после катастрофы.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,14),'chips'=>C($l,8)];}],

            ['text' => 'Оказывается, город защищался автоматическими системами всё это время. Они считают тебя заражённым.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.16];}],

            ['text' => 'Из канализации выходят мутировавшие жители старого города.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.14];}],

            ['text' => 'Изучаешь город и понимаешь: цивилизация могла восстановиться, но выбрала выживание.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,15),'chips'=>C($l,4)];}],
        ],
    ],
],


[
    'text' => 'В глубинах старой лаборатории находишь человека в криокапсуле. Система поддерживала его жизнь со времён войны.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Запускаешь капсулу. Учёный просыпается и рассказывает о последних днях старого мира.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,15),'chips'=>C($l,10)];}],

            ['text' => 'Учёный передаёт тебе архив своих исследований и разработки довоенной эпохи.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,14),'exp'=>E($l,12)];}],

            ['text' => 'Капсула заражена неизвестным вирусом. Учёный превращается в опасное существо.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.17];}],

            ['text' => 'Система лаборатории запускает аварийный протокол уничтожения данных.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.12,'chips'=>NC($l,2)];}],

            ['text' => 'Слушаешь рассказ учёного. Он говорит, что человечество погибло не от войны, а от собственной гордости.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,16)];}],
        ],
    ],
],


[
    'text' => 'В закрытом военном секторе находишь следы эксперимента по созданию нового вида человека, способного жить после ядерной зимы.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Находишь генетические архивы проекта. Данные оцениваются как бесценные.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,15),'exp'=>E($l,15)];}],

            ['text' => 'Находишь образцы первого поколения изменённых людей.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,12),'exp'=>E($l,13)];}],

            ['text' => 'Экспериментальные существа просыпаются в лаборатории.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.18];}],

            ['text' => 'Система защиты принимает тебя за часть эксперимента и пытается удалить.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.15];}],

            ['text' => 'Оставляешь комплекс нетронутым. Некоторые знания слишком опасны.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,14)];}],
        ],
    ],
],


[
    'text' => 'В горах находишь место падения огромного объекта. Это не самолёт — это часть старой орбитальной станции.',
    'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Извлекаешь высокотехнологичные материалы, которые больше никто не производит.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,16),'itemCount'=>1];}],

            ['text' => 'Находишь журнал экипажа. Последняя запись сделана уже после начала войны.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,15),'chips'=>C($l,8)];}],

            ['text' => 'Аварийная система станции активирует защитных роботов.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.18];}],

            ['text' => 'Корпус станции повреждён. Из него выходит токсичный газ.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.14];}],

            ['text' => 'Смотришь на остатки орбитальной эпохи человечества и понимаешь, насколько далеко оно успело зайти.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,18),'chips'=>C($l,5)];}],
        ],
    ],
],

[
    'text' => 'Среди разрушенных домов находишь старый жилой комплекс. Электричество в нём исчезло десятки лет назад, но одна квартира закрыта изнутри.',
    'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Вскрываешь квартиру и находишь личный запас семьи: консервы, фильтры воды и инструменты.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,3)];}],

            ['text' => 'Находишь домашний терминал. В памяти сохранились последние сообщения жителей перед войной.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,4)];}],

            ['text' => 'В квартире обнаруживается заражённый человек, который выжил после мутаций.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09];}],

            ['text' => 'Срабатывает старая домашняя система защиты. Автоматические турели принимают тебя за угрозу.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10];}],

            ['text' => 'Изучаешь квартиру. Среди вещей находишь фотографии мира до катастрофы.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,5)];}],
        ],
    ],
],

[
    'text' => 'Под землёй обнаруживаешь огромный военный командный комплекс. По архивным данным, он должен был продолжать управление армией даже после уничтожения цивилизации.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Запускаешь центральный компьютер. Старый военный ИИ выходит на связь и благодарит за восстановление системы.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,10),'exp'=>E($l,10)];}],

            ['text' => 'Получаешь доступ к военным картам. На них отмечены объекты, которых уже нет на современных картах.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,8),'exp'=>E($l,8)];}],

            ['text' => 'ИИ считает войну ещё продолжающейся и активирует систему обороны против неизвестного врага.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.15];}],

            ['text' => 'Система безопасности выпускает боевого робота последнего поколения.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.16,'chips'=>NC($l,2)];}],

            ['text' => 'Разговариваешь с ИИ и узнаёшь правду: последние приказы человечества были отданы почти сто лет назад.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,12),'chips'=>C($l,5)];}],
        ],
    ],
],


[
    'text' => 'В заражённой долине встречаешь мутанта, который не атакует. Он наблюдает за тобой и повторяет человеческие слова.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Оказываешь помощь существу. Оно показывает скрытый путь через опасную территорию.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,10),'chips'=>C($l,4)];}],

            ['text' => 'Мутант отдаёт старый человеческий жетон. Судя по датам, он когда-то был учёным.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,9),'exp'=>E($l,8)];}],

            ['text' => 'Мутант внезапно теряет контроль. Радиация разрушает его сознание.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.14];}],

            ['text' => 'Другие мутанты реагируют на него и начинают охоту.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.12];}],

            ['text' => 'Изучаешь поведение существа. Возможно, мутации сделали не только монстров.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,10)];}],
        ],
    ],
],


[
    'text' => 'Находишь действующий ядерный объект. После войны его системы автоматически поддерживали работу десятилетиями.',
    'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Извлекаешь энергетические элементы из безопасного сектора.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,12),'itemCount'=>1];}],

            ['text' => 'Получаешь доступ к системе мониторинга. Она показывает историю радиационного заражения региона.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,10),'chips'=>C($l,5)];}],

            ['text' => 'Срабатывает аварийная система. Начинается выброс радиации.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.15];}],

            ['text' => 'Охранные роботы станции принимают тебя за нарушителя.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.14];}],

            ['text' => 'Изучаешь объект и понимаешь масштаб технологий старого человечества.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,12)];}],
        ],
    ],
],
[
    'text' => 'На поверхности пустыни виден огромный купол. По данным старых карт — здесь находилась экспериментальная колония нового поколения.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Входишь внутрь и находишь работающую систему очистки воздуха.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.1),'exp'=>E($l,5)];}],

            ['text' => 'Находишь архив колонии. Здесь сохранились технологии выращивания пищи.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,7),'exp'=>E($l,7)];}],

            ['text' => 'Жители колонии оказались мутировавшими из-за эксперимента.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.12];}],

            ['text' => 'Система колонии считает внешний мир заражённым и активирует карантин.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10];}],

            ['text' => 'Изучаешь колонию и понимаешь: человечество могло начать заново, но не успело.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,8)];}],
        ],
    ],
],

[
    'text' => 'На равнине стоит огромный завод по производству боевых машин. Его автоматические линии остановились лишь несколько десятилетий назад.',
    'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Находишь склад компонентов для роботов. Некоторые детали сохранились.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,7),'itemCount'=>1];}],

            ['text' => 'Запускаешь старый производственный компьютер. Он показывает чертежи техники прошлого.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,7),'chips'=>C($l,4)];}],

            ['text' => 'Конвейер случайно запускается. Сборочные роботы считают тебя повреждённой деталью.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.11];}],

            ['text' => 'В цеху просыпается охранный механоид времён войны.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.13];}],

            ['text' => 'Осматриваешь заводские линии. Многие технологии уже невозможно повторить.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,5),'chips'=>C($l,3)];}],
        ],
    ],
],
[
    'text' => 'Находишь старый жилой сектор города. Среди домов ещё работают автоматические системы освещения, будто жители ушли вчера.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'В одном из домов находишь семейный тайник с довоенными вещами и запасами.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,5)];}],

            ['text' => 'Находишь домашнего робота-компаньона. Его память сохранила последние часы перед катастрофой.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,5),'chips'=>C($l,4)];}],

            ['text' => 'Система безопасности дома считает тебя грабителем и активирует защитные механизмы.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08];}],

            ['text' => 'В подвале обнаруживается гнездо мутировавших животных. Они жили здесь десятилетиями.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,1)];}],

            ['text' => 'Осматриваешь район. В большинстве домов пусто, но иногда встречаются полезные старые вещи.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'exp'=>E($l,2)];}],
        ],
    ],
],
[
        'text' => 'На обочине застрял старый сервисный робот серии «Антей». Его оптический сенсор всё ещё слабо мигает, а из манипулятора вылетают искры.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Аккуратно аккуратно вскрываем сервисный отсек — внутри сохранились целые модули памяти.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,3)];}],
                ['text' => 'Сливаем остатки синтетического масла и снимаем уцелевший титановый щиток.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,2)];}],
                ['text' => 'Робот воспринимает нас как угрозу и активирует аварийную разрядную дугу!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'Из корпуса вылезает гнездо слепых клещей-паразитов, питавшихся аккумом.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}],
                ['text' => 'Сбиваем турельную головку, надеясь найти редкий объектив.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,2)];}],
            ],
        ],
    ],

    // 2. Телефонная будка 1980-х
    [
        'text' => 'Среди разрушенного бетона стоит сохранившаяся красная телефонная будка. Внутри висит тяжелая трубка, а монетоприемник неожиданно гудит.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Разбираем монетоприемник — внутри застряла горсть советских монет и редкий чип-декодер.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'itemCount'=>1];}],
                ['text' => 'Из трубки доносится записанный автоответчиком голос, называющий координаты военного склада.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,4),'chips'=>C($l,2)];}],
                ['text' => 'Внутри будки скопился тяжелый ядовитый газ из разбитого трансформатора.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}],
                ['text' => 'При попытке открыть дверь проржавевшие стекла лопаются и осыпаются на нас.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05,'chips'=>NC($l,1)];}],
                ['text' => 'Пытаемся вырвать стальной кабель аппарата на цветмет.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'exp'=>E($l,2)];}],
            ],
        ],
    ],

    // 3. Застрявший автоматоход
    [
        'text' => 'В болоте по самые оси увяз трехосный грузовик-автоматоход. В его открытом кузове видны ящики с маркировкой МО СССР и электронные блоки.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Пробираемся к кузову и достаем герметичный кейс с вычислительными платами.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,2)];}],
                ['text' => 'Промываем найденные в кабине армейские рационы от болотной тины.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.08),'itemCount'=>1];}],
                ['text' => 'Из затопленной кабины выскакивает кибер-болотник — сгнивший мутант с впаянными чипами.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}],
                ['text' => 'Грузовик неожиданно проседает глубже, зажимая ногу между бортом и корягой.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}],
                ['text' => 'Срезаем силовую проводку со старого генератора.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'chips'=>C($l,2)];}],
            ],
        ],
    ],

    // 4. Схрон синоптика
    [
        'text' => 'На вершине холма обрушилась метеорологическая вышка. Под обломками виднеется стальной кунг с надписью «Госкомгидромет».',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вскрываем гермодверь кунга и находим рабочие барометры и микросхемы связи.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}],
                ['text' => 'Находим запасы фильтрованной воды и медицинские аптечки синоптиков.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.10),'exp'=>E($l,2)];}],
                ['text' => 'Рядом с вышкой находилась аномалия «Шаровая молния» — нас бьет разрядом.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'Деревянные перекрытия вышки рушатся прямо на нас во время поиска.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}],
                ['text' => 'Промываем радиодетали от многолетней пыли.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,1)];}],
            ],
        ],
    ],

    // 5. Убежище радиолюбителя
    [
        'text' => 'В чердачном помещении сгоревшей пятиэтажки сохранился угол радиолюбителя: трансиверы, радиолампы и паутина антенн на крыше.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Демонтируем уцелевшие транзисторы и блоки настройки частоты.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,3)];}],
                ['text' => 'Находим на столе запечатанный термос и пачку сухарей.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.07),'itemCount'=>1];}],
                ['text' => 'Антенна на крыше наэлектризована статической аномалией — удар током!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}],
                ['text' => 'Гнилые чердачные доски проваливаются под нашим весом.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08];}],
                ['text' => 'Пытаемся укрепить расшатанную мачту антенны, чтобы осмотреться.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,1)];}],
            ],
        ],
    ],

    // 6. Сломанный агробот
    [
        'text' => 'Посреди заросшего сорняками поля стоит гусеничный агробот «Колос-4». Его культиватор заклинило, но батарейный отсек цел.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем медные обмотки и главный процессор управления севом.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'itemCount'=>1];}],
                ['text' => 'В баке агробота сохранился чистый технический спирт.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}],
                ['text' => 'Агробота заклинило не просто так — в гусеницах запутался ядовитый слепыш-переросток.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}],
                ['text' => 'Гидравлика робота неожиданно выстреливает струей раскаленного масла.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}],
                ['text' => 'Пробуем отбить стальную лемех-лопату на металлолом.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}],
            ],
        ],
    ],

    // 7. Аптека с кодовым замком
    [
        'text' => 'Разграбленная аптека 80-х годов. На заднем дворе виднеется стальной сейф с обгоревшим электронным замком.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вскрываем сейф и забираем армейские стимуляторы и медицинские чипы.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.06,0.12),'chips'=>C($l,3)];}],
                ['text' => 'Промываем сохранившиеся флаконы с физраствором.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}],
                ['text' => 'В подсобке аптеки затаился кислотный слизень.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'Сейф оказывается заминирован химической ловушкой с хлором.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}],
                ['text' => 'Пытаемся отжать дверцу сейфа тяжелым ломом.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,2)];}],
            ],
        ],
    ],

    // 8. Разбитый полицейский патруль
    [
        'text' => 'На перекрестке стоит сгоревший «ГАЗ-24» патрульной службы с экспериментальным электронным радаром на крыше.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем радар и извлекаем вычислительный блок милицейской базы данных.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,3)];}],
                ['text' => 'В багажнике находим герметичную канистру с малом и ремень генератора.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1];}],
                ['text' => 'Из салона вылезает псевдособака, устроившая там логово.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,2)];}],
                ['text' => 'Бензобак машины протек и вспыхивает от случайной искры.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09];}],
                ['text' => 'Обираем подголовники и салон на ткань и набивку.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,1)];}],
            ],
        ],
    ],

    // 9. Остов курьерского дрона
    [
        'text' => 'В ветвях старого дуба застрял тяжелый почтовый дрон 80-х «Пчела-M». Его почтовый контейнер все еще закрыт.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Сбиваем дрон и достаем ценные посылки с микрочипами и оптикой.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'itemCount'=>1];}],
                ['text' => 'В контейнере находим сублимированный сухой паек и флягу.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.08),'exp'=>E($l,1)];}],
                ['text' => 'Дрон включает аварийный резонатор, привлекая местных слепых мутантов.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'При падении дрона с дерева нас накрывает тяжелая сухая ветка.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}],
                ['text' => 'Заматываем лопасти дрона, чтобы забрать их как запчасти.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,2)];}],
            ],
        ],
    ],

    // 10. Покинутая бензоколонка
    [
        'text' => 'На старой АЗС с проржавевшими вывесками «Автоэкспорт» стоит заброшенный автоцистерна. Из подпола тянет сыростью.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Сливаем из подземного резервуара остатки очищенного керосина и микросхемы насоса.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'itemCount'=>1];}],
                ['text' => 'В операторской находим целую упаковку батареек и свечей.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}],
                ['text' => 'Из подземного люка вылезает гигантский кровососущий камышовик.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,2)];}],
                ['text' => 'Труба насоса под давлением выплескивает едкую смесь в глаза.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}],
                ['text' => 'Пытаемся сбить стальной замок с технического люка.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}],
            ],
        ],
    ],

    // 11. Остов шагающего экскаватора
    [
        'text' => 'В песчаном карьере возвышается гигантский шагающий экскаватор ЭШ-10/70. В его кабине все еще светится один индикатор.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Пробираемся в рубку и снимаем релейные блоки и силовые чипы.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,3)];}],
                ['text' => 'В бытовке экипажа находим чистую воду и чистые бинты.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.09),'itemCount'=>1];}],
                ['text' => 'В стреле экскаватора свили гнездо скальные крысы.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}],
                ['text' => 'Ржавая лестница на высоту 20 метров подламывается под ногами.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08];}],
                ['text' => 'Подпираем перекошенную дверь рубки, чтобы спокойно искать.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,1)];}],
            ],
        ],
    ],

    // 12. Разбитый аномалией КРАЗ
    [
        'text' => 'Грузовик КрАЗ, перевозивший электронное оборудование, застрял в локальной гравитационной аномалии. Кабина плющена, но кузов цел.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вытаскиваем из кузова ящики с конденсаторами и чипами.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'itemCount'=>1];}],
                ['text' => 'В бардачке спальника находим флягу со спиртом и сухое горючее.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.06),'exp'=>E($l,2)];}],
                ['text' => 'Гравитационный импульс аномалии неожиданно расширяется!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}],
                ['text' => 'Из-под колеса вырывается струя сжатого воздуха с пылью.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Сооружаем рычаг из ветки, чтобы достать дальний ящик.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}],
            ],
        ],
    ],

    // 13. Автоматизированная насосная
    [
        'text' => 'Небольшое бетонное здание насосной станции. Внутри ритмично стучит старый поршневой насос, управляемый микроконтроллером.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Считываем прошивку и забираем управляющую плату насоса.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,3)];}],
                ['text' => 'Насос качает чистейшую артезианскую воду — напиваемся и набираем с собой.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.06,0.12),'itemCount'=>1];}],
                ['text' => 'В сыром углу насосной устроилась электрическая жаба-мутант.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'Проржавевший патрубок высокого давления лопается у нас за спиной.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}],
                ['text' => 'Пытаемся заблокировать маховик насоса стальным прутом.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,1)];}],
            ],
        ],
    ],

    // 14. Бункер узла связи
    [
        'text' => 'Заглубленный бункер узла связи «Интеркосмос». Затоплен по щиколотку, в темноте мигают редкие диоды стойки серверов.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем серверные платы с позолоченными контактами.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,2)];}],
                ['text' => 'На сухом столе оператора находим закрытую коробку с пайком ВКС СССР.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.10),'itemCount'=>1];}],
                ['text' => 'В затопленном полу проходит оголенный кабель под напряжением!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,2)];}],
                ['text' => 'Из вентиляции вываливается ядовитый паук-сенокос.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}],
                ['text' => 'Срываем стальную дверцу с аварийного щитка.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}],
            ],
        ],
    ],

    // 15. Упавший экспериментальный истребитель
    [
        'text' => 'В тайге находятся обломки истребителя «МиГ-35Э». Носовая часть с бортовым компьютером и радаром с активной фазированной решеткой цела.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем процессорный блок бортового компьютера.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,7),'exp'=>E($l,4)];}],
                ['text' => 'В катапультируемом кресле находим аварийный запас НЗ.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.06,0.11),'itemCount'=>1];}],
                ['text' => 'Срабатывает пиропатрон системы аварийного сброса фонаря!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.11,'chips'=>NC($l,2)];}],
                ['text' => 'Топливо из крыльевых баков разъедает подошву обуви.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Отбиваем титановый обшивочный лист.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,1)];}],
            ],
        ],
    ],

    // 16. Заброшенный планетарий
    [
        'text' => 'Здание городского планетария. Под треснувшим куполом стоит старый оптико-механический проектор «Цейсс» с кучей линз и сервоприводов.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем линзы высокого качества и сервомоторы позиционирования.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}],
                ['text' => 'В подсобке проекциониста находим запечатанную бутылку сока и чистые салфетки.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.07),'exp'=>E($l,2)];}],
                ['text' => 'Под проектором гнездятся слепые рукокрылые мутанты.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'Купол планетария осыпается стеклянным дождем от порыва ветра.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}],
                ['text' => 'Фиксируем покосившийся проектор, чтобы он не упал на нас.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,1)];}],
            ],
        ],
    ],

    // 17. Лаборатория робототехники
    [
        'text' => 'Полуразрушенный корпус института ПТИ. В лаборатории на столах стоят опытные образцы шагающих манипуляторов.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Демонтируем шаговые двигатели и контроллеры движения.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,3)];}],
                ['text' => 'В медицинском уголке находим спирт и стерильные материалы.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.09),'itemCount'=>1];}],
                ['text' => 'Автоматическая система автоклава стравливает перегретый пар.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'Один из манипуляторов самопроизвольно сжимает клешню на нашей руке!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09];}],
                ['text' => 'Подпираем упавшую стеллажную стойку деревянным брусом.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}],
            ],
        ],
    ],

    // 18. Трактор на газогенераторе
    [
        'text' => 'На краю поля стоит экспериментальный трактор 80-х, работающий на древесном газе, со встроенным блоком автопилота.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем блок автопилота и платиновые датчики выхлопа.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}],
                ['text' => 'В газогенераторном бункере находим сухие березовые брикеты.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}],
                ['text' => 'В бункере накопился угарный газ — становится дурно.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}],
                ['text' => 'Тяжелый капот трактора срывается с петель и падает на нас.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'Заматываем пробитый шланг гидроусилителя, чтобы забрать его.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}],
            ],
        ],
    ],

    // 19. Разрушенный музей ДОСААФ
    [
        'text' => 'Здание учебного центра ДОСААФ. Внутри лежат спортивные винтовки, учебные рации и плакаты по ГО.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем радиолампы и кварцевые резонаторы из учебных радиостанций.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,3)];}],
                ['text' => 'Находим закрытую аптечку АИ-2 с непросроченными табельными средствами.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.07,0.13),'itemCount'=>1];}],
                ['text' => 'Учебная граната в сейфе оказалась боевой с растяжкой!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,2)];}],
                ['text' => 'Крыша зала рушится, поднимая тучи ядовитой старой извести.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}],
                ['text' => 'Используем деревянную рейку, чтобы выудить коробку из-под завала.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'exp'=>E($l,2)];}],
            ],
        ],
    ],

    // 20. Затопленный речной трамвай
    [
        'text' => 'На отмели речки лежит полузатопленный речной трамвайчик «Заря». Его рубка управления возвышается над водой.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем судовой эхолот и блоки радиостанции.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}],
                ['text' => 'В спасательном плоту находим запасы пресной воды и сигнальные ракеты.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.08),'exp'=>E($l,2)];}],
                ['text' => 'Из затопленного трюма выплывает мутировавшая речная выдра.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'Палуба прогнила — нога проваливается в ржавый металл.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}],
                ['text' => 'Обматываем найденные радиодетали пленкой от сырости.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}],
            ],
        ],
    ],

    // 21. Старая автоматическая застава
    [
        'text' => 'Бронированный периметр заставы с недействующим автоматическим пулеметом «Утёс-М». Его блок наведения тихо щелкает.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем модуль оптического наведения и вычислитель.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,3)];}],
                ['text' => 'В лентоприемнике сохранились нерасстрелянные патроны.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1];}],
                ['text' => 'Остаточный заряд пулемета производит короткую очередь по нам!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.12,'chips'=>NC($l,2)];}],
                ['text' => 'При досмотре периметра наступаем на сигнальную мину.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08];}],
                ['text' => 'Промываем датчики движения водой, проверяя их работоспособность.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}],
            ],
        ],
    ],

    // 22. Почтовое отделение 1980-х
    [
        'text' => 'Старое отделение связи. За разбитыми окошками касс стоят сортировочные машины для писем с простыми процессорами.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вынимаем процессоры сортировки и оптопары считывателей индексов.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}],
                ['text' => 'В сейфе начальника почты находим нераспечатанные посылки с сухими пайками.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.08),'itemCount'=>1];}],
                ['text' => 'Под деревянным полом кассы устроили гнездо тушинские крысы.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}],
                ['text' => 'Тяжелая решетка кассового окна солкается и падает на пальцы.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}],
                ['text' => 'Скрепляем найденные карты маршрутов изолентой.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}],
            ],
        ],
    ],

    // 23. Брошенный электрокар
    [
        'text' => 'На территории заводского двора стоит трехколесный электрокар ЭП-0808. Его медные шины и контроллер питания целы.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем медные шины питания и массивные тиристоры.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}],
                ['text' => 'В ящике для инструмента находим консистентную смазку и ветошь.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}],
                ['text' => 'Батарейный отсек выделяет концентрированный кислый газ.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'Рулевая колонка электрокара отламывается и бьет по колену.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}],
                ['text' => 'Используем стальной прут, чтобы поднять тяжелый аккум.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}],
            ],
        ],
    ],

    // 24. Медпункт ликвидаторов
    [
        'text' => 'Заброшенный временный медпункт. Внутри стоят автоклавы, носилки и упавшие шкафы с медикаментами.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Находим в герметичном сейфе противорадиационные препараты и медицинские чипы.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.08,0.15),'chips'=>C($l,3)];}],
                ['text' => 'Промываем и стерилизуем найденный набор скальпелей.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,3)];}],
                ['text' => 'В помещении сохранился высокий фон радиации — счетчик заходится треском.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}],
                ['text' => 'Упавший стеклянный шкаф разбивается прямо под ногами.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}],
                ['text' => 'Отгибаем стальную решетку на окне для быстрого отхода.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2)];}],
            ],
        ],
    ],

    // 25. Учебный робот-конструктор
    [
        'text' => 'В здании станции юных техников лежит разобранный робот-конструктор «Юность-85» с набором планарных плат.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Забираем идеальные микросхемы серии К155 и мелкие электродвигатели.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,2)];}],
                ['text' => 'В тумбочке учителя находим пачку чая и запечатанную сгущенку.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.08),'itemCount'=>1];}],
                ['text' => 'Старый конденсатор в питателе робота взрывается от прикосновения!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}],
                ['text' => 'Деревянный стеллаж с моделями рушится нам на голову.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Скрепляем изолентой лопнувший корпус макета радиоприемника.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}],
            ],
        ],
    ],

    // 26. Трамвайное депо
    [
        'text' => 'Заброшенное депо. На путях стоит трамвай «Татра3» с переоборудованной автоматической крышевой турелью.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем контроллер управления турелью и свинцовые аккумуляторы.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'itemCount'=>1];}],
                ['text' => 'В кабине вагоновожатого находим термос с травяным отваром и аптечку.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.09),'exp'=>E($l,2)];}],
                ['text' => 'Система безопасности трамвая выпускает высоковольтную дугу.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}],
                ['text' => 'Трамвай скрежещет и слегка проседает во смотровую яму.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}],
                ['text' => 'Используем деревянный брус для подпора тяжело дверцы фары.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}],
            ],
        ],
    ],

    // 27. Склад кибернетики
    [
        'text' => 'Полуподвальный склад оптовой базы. На стеллажах видны ящики с надписью «Запчасти к автооператорам».',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вскрываем ящики и забираем логические блоки и платиновые контакты.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,3)];}],
                ['text' => 'Промываем от складской пыли запаянные банки с армейской тушенкой.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.06,0.11),'itemCount'=>1];}],
                ['text' => 'На складе затаился слепой упырь, питающийся смазкой.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'Верхняя полка стеллажа подламывается под тяжестью металла.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}],
                ['text' => 'Перематываем поврежденную упаковку микросхем.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}],
            ],
        ],
    ],

    // 28. Старое реле связи
    [
        'text' => 'Вышка радиорелейной связи «Горизонт» на обрыве. В подсобке гудит заклинивший бензогенератор.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Останавливаем генератор и извлекаем его высокочастотный модуль.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}],
                ['text' => 'В канистре рядом находим чистый бензин для нашей зажигалки.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}],
                ['text' => 'Выхлопная труба генератора прогорела — ядовитые газы заполняют подсобку.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}],
                ['text' => 'Крепление растяжки вышки лопается от ветра — стальной трос бьет по стене.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}],
                ['text' => 'Подпираем покосившуюся дверь подсобки деревянным брусом.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,1)];}],
            ],
        ],
    ],

    // 29. Лаборатория агрофизики
    [
        'text' => 'Стеклянная оранжерея института агрофизики. В центре стоят фито-лампы и автоматическая система полива.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем таймеры полива, датчики влажности и платиновые электроды.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,3)];}],
                ['text' => 'В баке системы полива сохранилась чистая дистиллированная вода.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.09),'itemCount'=>1];}],
                ['text' => 'Мутировавший плющ-хищник пытается обвить нашу ногу!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'Стеклянная крыша оранжереи рушится от порыва ветра.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}],
                ['text' => 'Фиксируем изолентой треснувшую колбу гидропоники.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}],
            ],
        ],
    ],

    // 30. РЛС дальнего обнаружения
    [
        'text' => 'Огромная решетчатая антенна РЛС «Днепр». В аппаратной под вышкой висят блоки индикаторов кругового обзора.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Демонтируем осциллографические трубки и волноводы с золотым напылением.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,7),'exp'=>E($l,4)];}],
                ['text' => 'В шкафчике дежурного офицера находим герметичный термос и сухпай.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.10),'itemCount'=>1];}],
                ['text' => 'Конденсаторы высокой мощности все еще сохраняют смертельный заряд!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.11,'chips'=>NC($l,2)];}],
                ['text' => 'Металлическая секция антенны рушится на крышу аппаратной.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08];}],
                ['text' => 'Используем деревянный брусок как клинья для заклинивания двери.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,1)];}],
            ],
        ],
    ],

    // 31. Старый кинотеатр
    [
        'text' => 'Здание заброшенного кинотеатра «Родина». В проекционной будке стоят тяжелые кинопроекторы КПТ-7 с мощными дуговыми лампами.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем кварцевые отражатели, шаговые моторы и медные контакты.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}],
                ['text' => 'В буфете находим несколько запечатанных банок с фруктовым компотом.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.08),'exp'=>E($l,2)];}],
                ['text' => 'Старая кинопленка из нитроцеллюлозы мгновенно вспыхивает от искры!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'Гнилой деревянный пол проекционной проваливается под нами.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}],
                ['text' => 'Перематываем изолентой треснувшие линзы объектива.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}],
            ],
        ],
    ],

    // 32. Разбитый бронеавтомобиль «Водник»
    [
        'text' => 'Брошенная машина разведки. Внутри сохранился выносной комплекс ночного видения и тепловизор 80-х.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем электронно-оптический преобразователь и матрицы тепловизора.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,3)];}],
                ['text' => 'В десантном отсеке находим сухожаровые бинты и промедол.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.06,0.12),'itemCount'=>1];}],
                ['text' => 'Из бойницы выпрыгивает затаившийся слепой кибер-крот.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'Бронированная дверь люка падаёт от ветхости петель.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}],
                ['text' => 'Промываем оптику тепловизора чистой водой.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}],
            ],
        ],
    ],

    // 33. Речной гидроузел
    [
        'text' => 'Плотина малого гидроузла. В помещении турбины вращается ржавый вал, а на стене светится щит автоматики.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Забираем массивные медные шины и датчики оборотов вала.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}],
                ['text' => 'Находим в шкафу бытовки фильтр для воды и запасы соли.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.07),'exp'=>E($l,2)];}],
                ['text' => 'Турбина выплескивает струю ледяной воды под огромным давлением!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08];}],
                ['text' => 'Стенка затвора лопается, засыпая нас осколками бетона.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}],
                ['text' => 'Изолируем поврежденный кабель питания для безопасного осмотра.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}],
            ],
        ],
    ],

    // 34. Метеорологический зонд
    [
        'text' => 'В поле лежит упавший стратосферный зонд «Урал-3». Его измерительный контейнер с серебряно-цинковыми аккумами цел.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем серебряно-цинковые аккумуляторы и передатчик.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,3)];}],
                ['text' => 'В контейнере находим аварийный запас шоколада и галет.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.09),'itemCount'=>1];}],
                ['text' => 'Парашют зонда накрывает нас с головой — под ним затаилась ядовитая сороконожка.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'Батарея зонда протекает концентрированным щелочным электролитом.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}],
                ['text' => 'Сматываем тонкий прочный капроновый шнур зонда.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,1)];}],
            ],
        ],
    ],

    // 35. Покинутый комбинат «Синтез»
    [
        'text' => 'Цех автоматической фасовки химического комбината. На линии стоят роботы-укладчики с вакуумными захватами.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем вакуумные насосы и контроллеры линии.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}],
                ['text' => 'В бытовке операторов находим чистую спецодежду и респираторы.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}],
                ['text' => 'Из фасовочного бункера вырывается облако ядовитого реагента.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09];}],
                ['text' => 'Вакуумный захват робота сжимается на нашем плече от остаточного давления!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}],
                ['text' => 'Подпираем перекошенную раму робота бруском.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}],
            ],
        ],
    ],

    // 36. Разрушенный КИП и А
    [
        'text' => 'Здание лаборатории контрольно-измерительных приборов. На верстаках стоят осциллографы С1-65 и частотомеры.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Разбираем осциллографы — внутри золоченые переключатели и ценные платы.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,3)];}],
                ['text' => 'В шкафу находим запечатанные банки с дистиллированной водой и спиртом.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.08),'itemCount'=>1];}],
                ['text' => 'Трансформатор питания пробит на корпус — сильный удар током!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'Тяжелый осциллограф соскальзывает с верстака нам на ногу.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}],
                ['text' => 'Подпираем упавшую полку брусом.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2)];}],
            ],
        ],
    ],

    // 37. Бункер гражданской обороны
    [
        'text' => 'Убежище ГО под заводским клубом. Фильтровентиляционная установка «ФВУ-100» частично разобрана.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем электродвигатель вентилятора и блок автоматов защиты.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}],
                ['text' => 'На складе ГО находим нераспечатанные индивидуальные аптечки и дозиметры.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.06,0.11),'exp'=>E($l,2)];}],
                ['text' => 'В воздуховоде затаилась ядовитая слепая мошкара.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}],
                ['text' => 'Тяжелая гермодверь срывается со стопора и прижимает ногу.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09];}],
                ['text' => 'Проклеиваем треснувший корпус найденного дозиметра.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}],
            ],
        ],
    ],

    // 38. Покинутый инкассаторский броневик
    [
        'text' => 'На обочине стоит сгоревший «РАФ-2203» инкассаторов. Внутри виден спецавтомат фасовки купюр с чипами памяти.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вскрываем фасовочный автомат и извлекаем платы памяти и редкие чипы.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,3)];}],
                ['text' => 'В сейфе инкассаторов находим советские червонцы и флягу с водой.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.07),'itemCount'=>1];}],
                ['text' => 'Из-под сиденья вылетает рой огненных муравьев.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'Брокостекло двери трескается и вываливается острыми кусками.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}],
                ['text' => 'Скрепляем изолентой поврежденный кассетный блок.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}],
            ],
        ],
    ],

    // 39. Экспериментальная кормокухня
    [
        'text' => 'Здание животноводческого комплекса. На кормокухне стоит автоматический программный заварник кормов.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем шаговые контроллеры и дозирующие клапаны с чипами.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}],
                ['text' => 'В складе находим запасы чистого зерна и сушеных паточных брикетов.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.08),'exp'=>E($l,2)];}],
                ['text' => 'В паровом котле накопился ядовитый сероводород.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}],
                ['text' => 'Мешалка кормокухни проворачивается и зажимает рукав.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'Подпираем упавшую крышку котла деревянной жердью.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,1)];}],
            ],
        ],
    ],

    // 40. Лаборатория криогеники
    [
        'text' => 'Подвал под институтом физики. В криолаборатории стоят сосуды Дьюара и замерзшие платы управления.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Осторожно извлекаем сверхпроводящие магниты и чипы с платиновыми ножками.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,7),'exp'=>E($l,4)];}],
                ['text' => 'В бытовке находим спирт и согревающие термохимические грелки.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.06,0.11),'itemCount'=>1];}],
                ['text' => 'Утечка жидкого азота! Воздух мгновенно промерзает, леденя пальцы.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,2)];}],
                ['text' => 'От перепада температур лопается стальная балка перекрытия.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}],
                ['text' => 'Используем деревянный брус для безопасного скалывания льда.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}],
            ],
        ],
    ],

    // 41. Остов пассажирского «ЛИАЗ-677»
    [
        'text' => 'В овраге лежит желтый «ЛиАЗ». В его салоне висит экспериментальный кассовый автомат с электронным считывателем.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Разбираем кассовый автомат и забираем считывающую головку и чипы.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'itemCount'=>1];}],
                ['text' => 'В кабине водителя находим аптечку и термос с чаем.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.07),'exp'=>E($l,2)];}],
                ['text' => 'Под задним сиденьем устроилась стая ядовитых слепышей.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'Проржавевший пол автобуса проваливается под весом.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}],
                ['text' => 'Изолентой перематываем найденный рулон редких билетов.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2)];}],
            ],
        ],
    ],

    // 42. Заброшенный типографский цех
    [
        'text' => 'Цех типографии. На печатных станках стоят автоматические фотонаборные головки с прецизионной оптикой.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Демонтируем фотонаборные линзы и шаговые двигатели подачи пленки.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,3)];}],
                ['text' => 'В бытовке печатников находим чистый спирт и сухие салфетки.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.08),'itemCount'=>1];}],
                ['text' => 'В печатном валу застрял сухой мутировавший скалолаз.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}],
                ['text' => 'Тяжелый печатный вал соскальзывает со станины.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08];}],
                ['text' => 'Скрепляем изолентой найденные чертежи станков.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}],
            ],
        ],
    ],

    // 43. Бункер узла водоканала
    [
        'text' => 'Подземная задвижка магистрального водовода. На стене висит блок автоматического дозирования хлора.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем платы дозатора и платиновые датчики хлора.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}],
                ['text' => 'Находим в чистой секции резервуара чистейшую воду и запасы таблеток «Акватабс».', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.06,0.12),'exp'=>E($l,2)];}],
                ['text' => 'Утечка концентрированного хлора из баллона!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09];}],
                ['text' => 'Чугунная маховик задвижки лопается от нашего усилия.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}],
                ['text' => 'Подпираем перекошенную дверцу щитка бруском.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}],
            ],
        ],
    ],

    // 44. Разбитый подвижный КП
    [
        'text' => 'Командно-штабная машина на базе КрАЗ-260. Внутри стоит вычислительный комплекс «Маневр» 80-х годов.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем процессорные блоки на ферритовых сердечниках и микросхемы.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,7),'exp'=>E($l,4)];}],
                ['text' => 'В сейфе командира находим сухпай специального назначения и карту.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.10),'itemCount'=>1];}],
                ['text' => 'В штабе сработала система автоматического пожаротушения порошком.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'Бронированный борт кунга проседает и давит ногу.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}],
                ['text' => 'Используем деревянный шест для поднятия зависшей антенны.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2)];}],
            ],
        ],
    ],

    // 45. Телефонная станция АТС-54
    [
        'text' => 'Заброшенная районная АТС. В машинном зале стоят огромные декадно-шаговые искатели с серебряными контактами.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Срезаем массивные струны с серебряным напылением и шаговые реле.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'itemCount'=>1];}],
                ['text' => 'В комнатах отдыха находим запечатанный чайник и пачку сахара.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.06),'exp'=>E($l,2)];}],
                ['text' => 'Аккумуляторная батарея АТС протекает серной кислотой!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}],
                ['text' => 'Кабельный коллектор обрушивается под ногами.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}],
                ['text' => 'Скрепляем найденную схемы кабельных трасс изолентой.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}],
            ],
        ],
    ],

    // 46. Остов тепловоза «ТЭМ2»
    [
        'text' => 'На тупиковых путях стоит заброшенный тепловоз. В его дизельном отсеке сохранились мощные генераторы и пускорегулирующие платы.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Демонтируем тяжелые тиристоры и медные контакторы контакторной панели.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'itemCount'=>1];}],
                ['text' => 'В кабине машиниста находим чистую воду и сухпай железнодорожников.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.09),'exp'=>E($l,2)];}],
                ['text' => 'Из маслосборника вылезает замазанный мазутом слепой кабан.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}],
                ['text' => 'Тяжелый капотный щит дизеля срывается с петель.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}],
                ['text' => 'Изолируем поврежденный масляный шланг для слива масла.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}],
            ],
        ],
    ],

    // 47. Заброшенная радиоастрономическая обсерватория
    [
        'text' => 'Малый радиотелескоп с тарелкой 12 метров. В пультовой стоят застывшие стойки приемников СВЧ-диапазона.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем малошумящие усилители и малогабаритные волноводы.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,7),'exp'=>E($l,4)];}],
                ['text' => 'В комнате отдыха астрономов находим запечатанный кофе и галету.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.08),'itemCount'=>1];}],
                ['text' => 'Высоковольтный трансформатор тарелки дает разряд статики!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'Привод поворота тарелки лопается, сбрасывая противовес.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09];}],
                ['text' => 'Подпираем упавшую секцию шкафа деревянным брусом.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}],
            ],
        ],
    ],

    // 48. Автоматизированная сушилка зерна
    [
        'text' => 'Высокий элеватор с сушильным комплексом «КЗС-20». На пульте управления горят аварийные индикаторы.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Забираем платиновые датчики температуры зерна и блоки реле.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}],
                ['text' => 'В бытовке элеватора находим канистру чистого растительного масла и соль.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}],
                ['text' => 'Зерновая пыль в шахте вспыхивает от искры — микровзрыв!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}],
                ['text' => 'Деревянные лестничные марши элеватора рушатся.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}],
                ['text' => 'Заклиниваем стальным ломом вращающийся шнек.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}],
            ],
        ],
    ],

    // 49. Разбитый речной буксир
    [
        'text' => 'На песчаной косе лежит выброшенный буксир «БМ-12». В его рулевой рубке сохранился компрессор и судовой радар.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем блочную электронную часть радара и серебряные тумблеры.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,3)];}],
                ['text' => 'В камбузе находим сухой корабельный паек и соду.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.08),'itemCount'=>1];}],
                ['text' => 'Из затопленного машинного отделения вылезает гигантская рак-мутант.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'Проржавевшая переборка рубки рушится прямо на нас.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}],
                ['text' => 'Заматываем изолентой найденный аварийный фонарь.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>1];}],
            ],
        ],
    ],

    // 50. Сейсмологическая станция
    [
        'text' => 'Одинокое бетонное здание сейсмостанции в горах. В подвале тикает механический сейсмограф с электроникой.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем высокоточные прецизионные датчики и платиновые растяжки сейсмографа.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,7),'exp'=>E($l,4)];}],
                ['text' => 'В кладовой находим запасы консервированного мяса и чистую воду.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.06,0.12),'itemCount'=>1];}],
                ['text' => 'Локальный сейсмический толчок вызывает обвал бетонированного потолка!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,2)];}],
                ['text' => 'В темноте подвала наступаем на гнездо горного скорпиона-мутанта.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08];}],
                ['text' => 'Изолентой фиксируем ленту самописца с данными за прошлые годы.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}],
            ],
        ],
    ],
[
    'text' => 'На окраине заражённой зоны находишь старый центр подготовки спасателей. Перед войной здесь обучали людей работать в условиях катастроф.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'В тренировочном секторе находишь защищённые шкафы с медицинскими комплектами и экипировкой.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'healPercent'=>RF(0.05,0.1)];}],

            ['text' => 'Находишь симулятор выживания. Старый ИИ анализирует твои действия и выдаёт рекомендации.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,6),'chips'=>C($l,4)];}],

            ['text' => 'Система симуляции ошибочно активирует боевых тренировочных роботов.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,1)];}],

            ['text' => 'Из заражённого подвала выходят бывшие сотрудники центра. Радиация изменила их тела.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09];}],

            ['text' => 'Изучаешь учебные материалы старого мира. Многие знания уже давно потеряны.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,4),'chips'=>C($l,2)];}],
        ],
    ],
],


[
    'text' => 'В лесу находишь странную конструкцию из металла и композитных материалов. Позже выясняется, что это часть древнего орбитального оборудования.',
    'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'Извлекаешь уцелевший энергетический модуль. Такие детали давно стали редкостью.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,7),'itemCount'=>1];}],

            ['text' => 'В памяти оборудования находишь данные о старых космических проектах человечества.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,7),'chips'=>C($l,3)];}],

            ['text' => 'Оборудование включает защитный протокол. Автоматические системы принимают тебя за угрозу.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.11];}],

            ['text' => 'Рядом появляется стая мутантов. Они реагируют на энергию работающего устройства.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,1)];}],

            ['text' => 'Исследуешь неизвестную технологию и оставляешь координаты для будущих сталкеров.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,5),'chips'=>C($l,2)];}],
        ],
    ],
],


[
    'text' => 'Находишь старый подземный архив правительства. Внутри тысячи серверов, но большая часть уничтожена временем.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'Запускаешь резервный сервер. В нём сохранились документы о последних днях старого мира.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,6)];}],

            ['text' => 'Находишь старые карты ресурсов и объектов повышенной важности.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,4)];}],

            ['text' => 'Архив оказывается заражённым цифровым вирусом старого военного ИИ.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,2)];}],

            ['text' => 'Автоматическая система обороны считает тебя захватчиком архива.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.11];}],

            ['text' => 'Изучаешь архивные документы. Большинство информации уже никому не пригодится, но знания бесценны.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,5)];}],
        ],
    ],
],

[
    'text' => 'В пустынной зоне находишь огромный военный транспортный корабль. Он упал сюда ещё во время последней фазы войны.',
    'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'В грузовом отсеке находишь герметичные ящики с военным оборудованием.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,4)];}],

            ['text' => 'Извлекаешь боевой компьютер корабля. В памяти сохранились координаты старых баз.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,4)];}],

            ['text' => 'Внутри корабля просыпается аварийный боевой ИИ.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.12];}],

            ['text' => 'Из отсеков экипажа выходят заражённые выжившие, превратившиеся в мутантов.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10];}],

            ['text' => 'Разбираешь обломки корабля. Среди металла находишь редкие сплавы.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,3),'itemCount'=>rangeInt(0,1)];}],
        ],
    ],
],
[
    'text' => 'Под землёй находишь старую станцию метро будущего. Когда-то здесь ходили автономные поезда, но теперь тоннели заполнены водой и мутантами.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'Находишь технический вагон. Внутри сохранились инструменты инженеров.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,3)];}],

            ['text' => 'Запускаешь старый навигационный компьютер метро и получаешь карту безопасных туннелей.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,4),'chips'=>C($l,4)];}],

            ['text' => 'Из воды появляются слепые мутанты, которые жили в тоннелях десятки лет.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10];}],

            ['text' => 'Старый поезд внезапно запускается. Автоматическая система безопасности считает тебя пассажиром без допуска.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}],

            ['text' => 'Осматриваешь заброшенные вагоны. Большинство вещей сгнило, но некоторые детали можно забрать.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'chips'=>C($l,2)];}],
        ],
    ],
],

[
    'text' => 'На окраине мёртвого города замечаешь старый сервисный дрон. Он лежит среди обломков уже несколько десятилетий, но его камера всё ещё мигает.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Перезапускаешь дрон. В памяти сохранился маршрут военного каравана с координатами тайников.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,3)];}],

            ['text' => 'Заряжаешь аккумулятор дрона. Искусственный интеллект благодарит тебя и передаёт старый технический код доступа.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,4)];}],

            ['text' => 'Дрон распознаёт оружие и активирует защитный режим. Маленький разведчик превращается во врага.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}],

            ['text' => 'Дрон передаёт сигнал неизвестному владельцу. Через несколько минут появляются вооружённые мародёры.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}],

            ['text' => 'Разбираешь корпус дрона. Из-за возраста часть деталей ломается, но кое-что можно забрать.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,2)];}],
        ],
    ],
],
    [
        'text' => 'Брошенная машина скорой помощи. Внутри — медицинские шкафчики. Часть разграблена, но в одном ящике находишь бинты и препараты.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Осматриваем шкафчики — находим медикаменты и бинты.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.12),'itemCount'=>1];}],
                ['text' => 'Проверяем аккумулятор — бортовой компьютер подаёт признаки жизни.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,1)];}],
                ['text' => 'В кузове прячется мародёр — вооружён и агрессивен.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}],
                ['text' => 'Под сиденьем — грязные бинты со следами инфекции.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Разбираем салон на запчасти — шприцы, ампулы, трубки.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Старый рюкзак висит на ветке. Хозяин не вернулся. Внутри — запаянный контейнер с продовольствием и карта местности с пометками.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем рюкзак и изучаем карту — ценные ориентиры.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,5),'exp'=>E($l,3)];}],
                ['text' => 'Вскрываем контейнер с продовольствием — пайки в сохранности.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.06),'itemCount'=>1];}],
                ['text' => 'К ветке привязана сигнальная граната — дёргаем за верёвку.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'В рюкзаке — личные вещи хозяина и предсмертная записка.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05,'chips'=>NC($l,1)];}],
                ['text' => 'Обыскиваем окрестности в поисках других закладок хозяина.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'exp'=>E($l,3)];}],
            ],
        ],
    ],
    [
        'text' => 'Разбитый дрон лежит в овраге. Его аккумулятор ещё цел. Рядом валяются микросхемы и несколько чипов памяти.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем аккумулятор и память — ценные компоненты.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}],
                ['text' => 'Разбираем корпус на запчасти — микрочипы и провода.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'exp'=>E($l,3)];}],
                ['text' => 'Дрон запрограммирован на самоуничтожение — запускается таймер.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,2)];}],
                ['text' => 'В дроне застрял передатчик — подаёт сигнал хозяевам.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06,'chips'=>NC($l,1)];}],
                ['text' => 'Пытаемся восстановить дрон — нужны запчасти и время.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Высохшее русло ручья. На песке — человеческие кости и полуистлевший мешок. Внутри — коробка с инструментами и несколько старых монет (предметы старины ценятся у коллекционеров).',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Осторожно извлекаем коробку — инструменты в отличном состоянии.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,5)];}],
                ['text' => 'Промываем монеты в ручье — проступает коллекционная ценность.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6)];}],
                ['text' => 'Кости принадлежат не человеку — мутант затаился в песке.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,1)];}],
                ['text' => 'Мешок рассыпается при прикосновении — содержимое падает в ил.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05,'chips'=>NC($l,1)];}],
                ['text' => 'В русле чувствуется запах газа — возможно, утечка из труб.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04),'exp'=>E($l,3)];}],
            ],
        ],
    ],
    [
        'text' => 'Бункер с сорванной дверью. Внутри — пустые стеллажи, но в углу, под грудой тряпья, находишь маленький сейф. В сейфе — чипы данных.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вскрываем сейф — чипы данных в идеальном состоянии.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,4)];}],
                ['text' => 'Обыскиваем стеллажи — в щелях завалялись патроны.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1];}],
                ['text' => 'В бункере кто-то живёт — доносится кашель из темноты.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}],
                ['text' => 'Тряпьё под сейфом скрывает мину-ловушку.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,2)];}],
                ['text' => 'Пытаемся взломать сейф грубой силой — рискуем повредить чипы.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Упавший транспортный вертолёт. Обшивка прогорела, но грузовой отсек уцелел. Военные ящики раскрыты, но в одном находишь нераспечатанный контейнер с боеприпасами.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вскрываем контейнер — боеприпасы в герметичной упаковке.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,3)];}],
                ['text' => 'Сливаем остатки топлива из баков вертолёта.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4)];}],
                ['text' => 'Обшивка вертолёта рушится — едва успеваем отскочить.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,2)];}],
                ['text' => 'Из грузового отсека выползает раненый мутант.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}],
                ['text' => 'Разбираем приборную панель на запчасти.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Старый торговый автомат, перекошенный набок. Пара монет внутри — и он выдаёт банку газировки, пролежавшую там лет двадцать. На удивление, пить можно.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Запускаем автомат — он выдаёт несколько банок.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'chips'=>C($l,3)];}],
                ['text' => 'Вскрываем автомат монтировкой — внутри запас мелочи.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'itemCount'=>1];}],
                ['text' => 'Автомат оказывается подключён к растяжке — дёргаем за ручку.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}],
                ['text' => 'Газировка оказывается просроченной — начинается расстройство.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05,'healPercent'=>-RF(0.02,0.03)];}],
                ['text' => 'Пытаемся вытащить автомат целиком — слишком тяжёлый.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E(1,2),'damagePercent'=>RF(0.01,0.03)];}],
            ],
        ],
    ],
    [
        'text' => 'Мастерская оружейника. Хозяин давно мёртв, инструменты проржавели, но в тайнике под верстаком лежат запчасти для оружия и патроны.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем тайник — запчасти и патроны в смазке.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,4)];}],
                ['text' => 'Осматриваем тайник — находим чертежи оружия.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,3)];}],
                ['text' => 'Под верстаком — крысиное гнездо, мутированные твари.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06,'chips'=>NC($l,1)];}],
                ['text' => 'В мастерской — химические реактивы, некоторые протекают.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,2)];}],
                ['text' => 'Разбираем станки на запчасти — металл и механизмы.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Среди камней — свежий схрон. Кто-то оставил припасы и записку: «Если ты это читаешь — я уже мёртв. Забирай, пригодится».',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Забираем припасы — консервы и вода в целости.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,5)];}],
                ['text' => 'Ищем зацепки по записке — возможно, тайник не единственный.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,5),'chips'=>C($l,3)];}],
                ['text' => 'В схроне — мина-сюрприз для незваных гостей.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}],
                ['text' => 'Труп хозяина схрона — не успел уйти, умер от ран.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.04,'chips'=>NC($l,1)];}],
                ['text' => 'Роемся в записках — координаты других точек в округе.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C(1,2),'exp'=>E(1,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Упавший квадрокоптер с камерой. Карта памяти цела. На ней — координаты трёх тайников. Продаёшь данные торговцу информацией.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Считываем карту памяти — координаты чёткие, тайники реальны.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,4)];}],
                ['text' => 'Восстанавливаем повреждённые файлы на карте.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'itemCount'=>1];}],
                ['text' => 'Квадрокоптер подаёт сигнал бедствия — хозяева ищут его.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06,'chips'=>NC($l,1)];}],
                ['text' => 'На карте — ловушка: координаты ведут в засаду.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,2)];}],
                ['text' => 'Разбираем коптер на детали — пропеллеры и камера.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Ржавый автобус лежит на боку. В багажном отсеке — чемодан с одеждой и личные вещи. В подкладке пиджака зашита пачка чипов.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вскрываем чемодан — одежда и скрытые чипы в целости.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}],
                ['text' => 'Роемся в личных вещах — находим драгоценности.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}],
                ['text' => 'Автобус оседает — конструкция не выдерживает веса.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}],
                ['text' => 'В автобусе — труп водителя с ключ-картой доступа.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05,'chips'=>C($l,3)];}],
                ['text' => 'Собираем разбросанные вещи по всему салону.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'exp'=>E($l,3)];}],
            ],
        ],
    ],
    [
        'text' => 'На спутниковой тарелке висит рюкзак десантника. Внутри — НЗ, аптечка, карта с координатами эвакуационного дроп-пойнта. Картой можно торговать.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем рюкзак — содержимое в герметичных упаковках.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,5),'exp'=>E($l,3)];}],
                ['text' => 'Изучаем аптечку — медикаменты армейского образца.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.10),'itemCount'=>1];}],
                ['text' => 'Рюкзак заминирован — десантники не хотели отдавать припасы.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,2)];}],
                ['text' => 'С тарелки нас замечает патруль — открывают огонь.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06,'chips'=>NC($l,1)];}],
                ['text' => 'Пытаемся взобраться выше — вдруг на тарелке ещё что-то есть.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.03),'exp'=>E($l,3)];}],
            ],
        ],
    ],
    [
        'text' => 'Контейнер, сброшенный с дрона-снабженца. Частично разбит, но внутри — вакуумные упаковки с армейским пайком и сухой паёк.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вскрываем вакуумные упаковки — пайки свежие, съедобные.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.06,0.12),'itemCount'=>1,'chips'=>C($l,3)];}],
                ['text' => 'Проверяем герметичность — часть упаковок повреждена.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4)];}],
                ['text' => 'Контейнер привлёк мутантов — они уже рядом.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,2)];}],
                ['text' => 'В контейнере — тревожный маячок, подаёт сигнал.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05,'chips'=>NC($l,1)];}],
                ['text' => 'Разбираем контейнер на материалы — пластик и металл.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Рыболовная сеть, застрявшая в корягах. В ней — дохлая рыба и мусор, но среди грязи блестит металл: старый нож и несколько монет.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем нож и монеты — отличная добыча.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,5)];}],
                ['text' => 'Разматываем сеть в поисках других трофеев.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'exp'=>E($l,2)];}],
                ['text' => 'В сети — живая мутированная рыба, агрессивная.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}],
                ['text' => 'Коряги под сетью подгнили — берег рушится в воду.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06,'chips'=>NC($l,1)];}],
                ['text' => 'Чистим рыбу от грязи — возможно, часть съедобна.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'damagePercent'=>RF(0.01,0.02)];}],
            ],
        ],
    ],
    [
        'text' => 'Стенд с инструментами на автозаправке. Большая часть украдена, но на верхней полке лежит забытый набор отвёрток и мультиметр. Хозяевам уже не пригодятся.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Забираем инструменты — отвёртки и мультиметр в работе.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,3)];}],
                ['text' => 'Проверяем мультиметр — он работает, можно торговать.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4)];}],
                ['text' => 'Стенд рушится от ветхости — едва уворачиваемся.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06,'chips'=>NC($l,1)];}],
                ['text' => 'Из-за стойки выбегает мутант — охранял заправку.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,2)];}],
                ['text' => 'Осматриваем заправку в поисках топлива в цистернах.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Брошенный военный УАЗик. Колеса спущены, аккумулятор мёртв, но в бардачке — карта местности и кобура с пистолетом. Револьвер старого образца, но стреляет.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Забираем пистолет и карту — револьвер в смазке, боеспособен.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,5)];}],
                ['text' => 'Осматриваем кузов — ящик с патронами под сиденьем.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1];}],
                ['text' => 'В УАЗике — медвежий капкан, оставленный браконьерами.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}],
                ['text' => 'Из кабины вылетает рой мутированных ос.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05,'chips'=>NC($l,1)];}],
                ['text' => 'Пытаемся отбуксировать УАЗик к базе — тяжёлый, но ценный.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.03),'chips'=>C($l,3)];}],
            ],
        ],
    ],
    [
        'text' => 'Труп сталкера в странной позе. Рядом — пустая фляга и дневник. В дневнике — записи о «пятом измерении» и код от сейфа в его убежище. Координаты убежища указаны.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Забираем дневник — код от сейфа и координаты убежища.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,4),'itemCount'=>1];}],
                ['text' => 'Обыскиваем труп — находим спрятанный на теле чип.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4)];}],
                ['text' => 'Сталкер заражён — труп мутирует у нас на глазах.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,2)];}],
                ['text' => 'Запах сталкера привлекает хищников поблизости.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06,'chips'=>NC($l,1)];}],
                ['text' => 'Захораниваем сталкера по-человечески — моральный долг.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E(1,3),'damagePercent'=>RF(0.01,0.02)];}],
            ],
        ],
    ],
    [
        'text' => 'Логово браконьеров. Временное, судя по всему — брошено в спешке. В ящике — разделанная туша кабана и мешок с травами. Мясо можно приготовить, травы целебные.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Забираем мясо и травы — сытный ужин и лекарства обеспечены.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.08,0.14),'itemCount'=>1];}],
                ['text' => 'Сортируем травы — определяем целебные свойства.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Браконьеры вернулись — мы застали их врасплох.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,2)];}],
                ['text' => 'В логове — ловушка на дичь, срабатывает на нас.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05,'chips'=>NC($l,1)];}],
                ['text' => 'Разбираем логово на стройматериалы — доски и шкуры.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'exp'=>E($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Почтовый вагон, сошедший с рельсов. Мешки с корреспонденцией рассыпаны по откосу. Газеты, письма, бандероли. Кое-где торчат наклейки с адресами — можно найти координаты других сталкеров.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вскрываем посылку — {item} в идеальном состоянии.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,4),'exp'=>E($l,2)];}],
                ['text' => 'Роемся в письмах — находим ценные сведения и карты.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,3)];}],
                ['text' => 'Вагон завален — при попытке залезть рушится крыша.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}],
                ['text' => 'В посылке — битое стекло вместо {item}. Подстава.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,2)];}],
                ['text' => 'Собираем марки и конверты — коллекционная ценность.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E(1,2),'chips'=>C(1,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Сейф в полу разрушенного банка. Дверца снесена взрывом, внутри пусто. Но в щели застрела монета — редкая, коллекционная. У нумизматов пойдёт за чипы.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем монету — редкий экземпляр, почти не повреждён.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,2)];}],
                ['text' => 'Обыскиваем пол вокруг сейфа — рассыпанные чипы в пыли.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'itemCount'=>1];}],
                ['text' => 'В сейфе — заклинившая ячейка. При вскрытии срабатывает кислота.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06,'chips'=>NC($l,1)];}],
                ['text' => 'Из темноты банка доносится рык — сторожевой мутант.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,2)];}],
                ['text' => 'Пытаемся взломать соседнюю ячейку сейфа — вдруг там ещё что-то.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E(1,2),'damagePercent'=>RF(0.01,0.02)];}],
            ],
        ],
    ],
    [
        'text' => 'На обочине стоит разбитый военный грузовик. Кузов вскрыт, но под сиденьем — уцелевший ящик с маркировкой «Боеприпасы». Рядом валяются гильзы и обрывки карт.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вскрываешь ящик инструментами — внутри патроны и сухпай. Боезапас пополнен.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'В кабине — карта с отметками складов. Топливо для генератора было бы кстати.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}],
                ['text' => 'В кузове — рассыпанные консервы. Часть пробита осколками, но много целых.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,2),'exp'=>E($l,2)];}],
                ['text' => 'Под капотом — аккумулятор. Если он жив, можно забрать для зарядки.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,3)];}],
                ['text' => 'В ящике с инструментами — моток изоленты и запасные детали.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2),'itemCount'=>1,'chips'=>C($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Заброшенная аптека с выбитыми витражами. Полки пусты, но за фармацевтической стойкой — закрытая дверь в подсобку. Замок простой, внутри слышен писк крыс.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'В подсобке — шкаф с лекарствами. Большая часть испорчена, но кое-что уцелело.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'В углу — ящик с хирургическими инструментами. Стерильные, в масле.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,3)];}],
                ['text' => 'За прилавком — коробка с батарейками для медицинского оборудования.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}],
                ['text' => 'Находишь пластиковый контейнер с просроченными реагентами. Можно переработать.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}],
                ['text' => 'В стойке — выдвижной ящик с документацией. Внутри — карта с пометками.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Склад стройматериалов на окраине посёлка. Ворота сорваны с петель, внутри — горы пластиковых труб, досок, железных уголков. Ветер свистит в пустых проёмах.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Среди пластиковых труб находишь целую партию водопроводных фитингов.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'В углу — аккуратно сложенные доски. Видно, их кто-то приготовил для стройки.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Ржавый контейнер с металлическими уголками и крепежом.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,3)];}],
                ['text' => 'На верстаке — поломанный шуруповёрт и набор бит. Можно починить.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}],
                ['text' => 'В подсобке — ящик с батарейками для электроинструмента.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,3)];}],
            ],
        ],
    ],
    [
        'text' => 'На поляне лежит сбитый квадрокоптер. Корпус треснул, пропеллер погнут, но камера и модуль управления выглядят целыми. Рядом — парашютная стропа.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаешь аккумулятор — он уцелел. Можно переставить в другой прибор.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}],
                ['text' => 'Инструментами вскрываешь корпус — внутри микросхемы и провода.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,3)];}],
                ['text' => 'Пластиковые лопасти можно снять и переделать в крепления.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}],
                ['text' => 'Изолентой можно скрепить корпус — дрон будет как новый.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'Карта памяти в камере уцелела. На ней — записи с разведки.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,4),'chips'=>C($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Полуразрушенная библиотека. Книги разбросаны, но в подсобке — металлический шкаф. За ним фальшивая стена. За стеной — маленькая комната с сундуком.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Обматываешь книги изолентой — перетаскиваешь их в рюкзак. Много читать не будешь, но на вес золота.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}],
                ['text' => 'В сундуке — консервы и сухпай. Кто-то готовился к осаде.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,3),'exp'=>E($l,2)];}],
                ['text' => 'В ящике стола — старый фонарь и батарейки к нему.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}],
                ['text' => 'Фальшивая стена держится на гнилых досках. Один удар — проход открыт.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}],
                ['text' => 'В шкафу — аптечка первой помощи. Не вскрытая, с инструкцией.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,3)];}],
            ],
        ],
    ],
    [
        'text' => 'Водонапорная башня одиноко стоит посреди поля. Лестница цела, наверху — площадка с оборудованием. С башни открывается отличный обзор на километры вокруг.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'В баке — остатки чистой воды. Можно набрать с собой.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,2),'exp'=>E($l,2)];}],
                ['text' => 'Дизельный генератор у башни. Если есть топливо — можно запустить.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,3)];}],
                ['text' => 'На площадке — ящик с инструментами сварщика. Внутри электроды и маска.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}],
                ['text' => 'Внизу башни — железный контейнер с консервами, заваленный мусором.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,2),'exp'=>E($l,2)];}],
                ['text' => 'Ржавые заклёпки на башне. Нужно железо, чтобы укрепить конструкцию.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}],
            ],
        ],
    ],
];

// ---------------------------------------------------------------------------
// Item-rich events — guaranteed item drops with specific pools
// ---------------------------------------------------------------------------
$ITEM_TEXTS_RICH = [
    [
        'text' => 'Среди руин замечаешь старый армейский схрон. Из-под ржавого брезента виднеются ребристые контуры оружейных ящиков.',
        'type' => 'loot', 'noAutoBranch' => true, 'itemPool' => 'weapon1', 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Аккуратно вскрываешь ящик — внутри блестит смазка, оружие в идеальном состоянии.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,3)];}],
                ['text' => 'Проверяешь каждый ящик — в одном из них находишь запас патронов и чистый ствол.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,3)];}],
                ['text' => 'Схрон почти пуст — кто-то был здесь до тебя. Но один ящик чудом уцелел.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>1];}],
                ['text' => 'Ящик оказывается заминирован — срабатывает растяжка.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'damagePercent'=>0.08];}],
                ['text' => 'В схроне поселился слепой псевдо-кабан. Приходится отбивать добычу.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'damagePercent'=>0.06];}],
            ],
        ],
    ],
];
