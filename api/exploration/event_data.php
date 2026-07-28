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

function consumeResourceFromItems(&$items, $resourceName) {
    if ($items === null) return false;
    foreach ($items as $i => $item) {
        $itemName = $item['name'] ?? $item['resourceName'] ?? '';
        if ($itemName === $resourceName) {
            $qty = (int)($item['quantity'] ?? 1);
            if ($qty > 1) {
                $items[$i]['quantity'] = $qty - 1;
            } else {
                array_splice($items, $i, 1);
            }
            return true;
        }
    }
    return false;
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
    $resourceCost = null;
    $resourceHad = null;
    if (isset($chosen['resourceCost']) && $chosen['resourceCost']) {
        $resourceCost = $chosen['resourceCost'];
        $resourceHad = consumeResourceFromItems($items, $resourceCost);
        if ($resourceHad && isset($chosen['resourceText'])) {
            $texts[0] = $chosen['resourceText'];
            if (isset($chosen['resourceEffects'])) {
                $raw = is_callable($chosen['resourceEffects']) ? $chosen['resourceEffects']($zone, $level) : $chosen['resourceEffects'];
                if (is_array($raw)) {
                    foreach ($raw as $k => $v) {
                        if ($v) $effects[$k] = ($effects[$k] ?? 0) + $v;
                    }
                }
            }
        } elseif (!$resourceHad && isset($chosen['noResourceText'])) {
            $texts[0] = $chosen['noResourceText'];
            if (isset($chosen['noResourceEffects'])) {
                $raw = is_callable($chosen['noResourceEffects']) ? $chosen['noResourceEffects']($zone, $level) : $chosen['noResourceEffects'];
                if (is_array($raw)) {
                    foreach ($raw as $k => $v) {
                        if ($v) $effects[$k] = ($effects[$k] ?? 0) + $v;
                    }
                }
            }
        }
    }
    return ['texts' => $texts, 'effects' => $effects, 'resourceCost' => $resourceCost, 'resourceHad' => $resourceHad];
}

// ---------------------------------------------------------------------------
$HELP_TEXTS_RICH = [
    [
        'text' => 'На дороге сидит старик. Нога перевязана грязной тряпкой. «Сынок, помоги дойти до посёлка. Отблагодарю, чем смогу». Помогаешь ему дойти — в благодарность он отдаёт старый, но рабочий пистолет и горсть чипов.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Провожаешь старика до посёлка — он сдержал слово, отдал пистолет и чипы.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => 'Благодаря [Вода] находим по пути тайник старика — трофеи x3.', 'noResourceText' => 'Без [Вода] ничего лишнего — только то, что обещал.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'По пути старик рассказывает о заброшенном схроне военных — координаты пригодятся.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'itemCount'=>1];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] помогают открыть заржавевший люк схрона — лут x2.', 'noResourceText' => '[Изолента] нет — запоминаешь координаты на будущее.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Перевязываешь ногу старика свежим бинтом — рана неглубокая, заживёт быстро.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => 'Накладываешь повязку с [Инструменты] — старик щедро делится чипами.', 'noResourceText' => 'Бинтов нет — старик терпит, зато советует безопасный маршрут.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Старик малость прихрамывает — дорога заняла больше времени, чем думали. Устал, но дошёл.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] подсластили путь — старик в благодарность даёт ещё и оберег.', 'noResourceText' => 'Без [Дерево] просто идешь молча — старик экономит силы на разговоры.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'У околицы нас встречают родственники старика. «Спасибо, добрый человек!» — угощают ужином.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] пришёлся к столу — ужин знатный, сил прибавилось.', 'noResourceText' => '[Железо] нет — угощение скудное, но тёплый приём греет душу.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Женщина с ребёнком на руках прячется в подвале разрушенного дома. «Муж ушёл за водой и не вернулся…» Ты делишься с ней припасами. В ответ она отдаёт тебе шкатулку с редкими микросхемами.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Оставляешь женщине консервы и воду. Она со слезами благодарит и отдаёт шкатулку с микросхемами.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] пригодился женщине для обмена — она в ответ отдаёт редкую деталь.', 'noResourceText' => 'Без [Вода] она просто берёт припасы — микросхемы твои.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Ребёнок перестаёт плакать, когда даёшь ему галету. Женщина улыбается и даёт тёплое одеяло.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] греет малыша — женщина в благодарность чинит твою куртку.', 'noResourceText' => 'Без [Изолента] ребёнок всё равно рад галете — одеяло берёшь с собой.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Женщина рассказывает об окрестностях — указывает на дом, где можно найти припасы.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] помогают открыть запертую дверь в том доме — внутри ценный хабар.', 'noResourceText' => 'Без [Инструменты] просто запоминаешь координаты на будущее.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Ребёнок рисует тебе картинку — под ней женщина пишет координаты схрона мужа.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] помог разобрать каракули — схрон найден, внутри припасы.', 'noResourceText' => 'Без [Дерево] карта схрона остаётся загадкой.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return ['chips'=>NC($l,0)];}],
                ['text' => 'Появляются подозрительные люди — женщина прячется, ты прикрываешь вход. Уходят.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] замаскировал вход — незваные гости прошли мимо.', 'noResourceText' => 'Без [Железо] пришлось прятаться в темноте — отделался испугом.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Молодой парень копается в двигателе старого грузовика. «Не заведётся, чтоб его!». Помогаешь ему починить — он в благодарность даёт тебе топливо и указывает безопасный путь через болота.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вдвоём чините грузовик — замена свечей и проводки делает своё дело. Двигатель заводится!', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] как раз подошёл для замены — грузовик рычит как зверь! Трофеи x2.', 'noResourceText' => 'Без [Вода] чиним подручными средствами — завелся, но чихает.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Парень щедро делится топливом из грузовика и рисует карту безопасного пути.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => 'С [Изолента] канистра полнее — путь через болота короче.', 'noResourceText' => 'Без [Изолента] топлива в обрез — путь длиннее, но безопасный.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В кузове грузовика находишь ящик с консервами и инструментами — парень машет рукой: «Бери, мне не жалко!».', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] открывает ящик без шума — внутри редкие запчасти.', 'noResourceText' => 'Без [Инструменты] просто забираешь консервы — тоже неплохо.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Парень оказывается болтливым — рассказывает о бандитской засаде на южной дороге.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] задобрил парня — он выкладывает все секреты окрестностей.', 'noResourceText' => 'Без [Дерево] информация скупая, но полезная.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Под капотом оказывается больше проблем, чем думали. Чините кое-как — парень даёт сколько может.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] помог протянуть время — нашли ещё пару банок тушёнки в заначке.', 'noResourceText' => 'Без [Железо] ремонт на скорую руку — парень извиняется за скудную благодарность.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Маленький мальчик сидит на обочине и плачет. «Я потерялся…» Ты провожаешь его до ближайшего поселения. Родители в благодарность угощают тебя обедом и дают чипы.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Мальчик показывает дорогу к посёлку — родители вне себя от радости. Сытный обед и чипы.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] радует мальчика — родители в благодарность дают вдвое больше чипов.', 'noResourceText' => 'Без [Вода] обед простой, но искренний — чипы как договаривались.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'По пути учишь мальчика отличать съедобные ягоды от ядовитых. Он внимательно слушает.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'healPercent'=>RF(0.01,0.03)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] пригодился для сбора ягод — набрали целую миску.', 'noResourceText' => 'Без [Изолента] просто урок ботаники — польза позже.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Отец мальчика — местный охотник — даёт тебе запас патронов и карту охотничьих троп.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] пришёлся ко двору — охотник добавляет нож в придачу.', 'noResourceText' => 'Без [Инструменты] просто патроны — тоже сойдёт.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Оказывается, мальчик не просто потерялся — он убежал из дома. Родители просят присмотреть.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] скрепляет договор — родители доверяют тебе ценный предмет.', 'noResourceText' => 'Без [Дерево] просто кивают — «спасибо, добрый человек».', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В посёлке праздник — кто-то родил, кто-то нашёл воду. Тебя угощают и зовут остаться.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] украшает стол — старейшина поднимает тост за тебя.', 'noResourceText' => 'Без [Железо] вечер душевный, но без излишеств.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Пожилая пара пытается перетащить телегу через завал. Ты помогаешь расчистить путь. Женщина угощает тебя домашним хлебом (настоящим, не синтетическим!), а мужчина даёт несколько чипов.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Расчищаешь завал за час — телега проезжает, старики благодарят от души. Хлеб тёплый, чипы звенят.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] помог разбить крупный валун — путь свободен! Награда x2.', 'noResourceText' => 'Без [Вода] камни вручную — дольше, но справились.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Женщина даёт не только хлеб, но и баночку варенья из одуванчиков. Настоящая роскошь!', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'chips'=>C($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] в обмен на варенье — старушка довольна, даёт ещё и травяной сбор.', 'noResourceText' => 'Без [Изолента] варенье просто так — вкусно, но без добавки.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Мужчина рассказывает, что они держат путь к сыну в большой посёлок. Просит передать весточку.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] в качестве оплаты за услугу — мужчина щедро приплачивает.', 'noResourceText' => 'Без [Инструменты] обещает заплатить позже — чипы пока свои.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Под завалом находишь полезные вещи — старый лом и кусок брезента. Старики разрешают забрать.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => 'С [Дерево] разобрал завал быстрее — нашел под ним ящик с гвоздями.', 'noResourceText' => 'Без [Дерево] просто лом и брезент — мелочь, а приятно.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Завал оказывается больше, чем казался. Провозились дотемна, но старики зовут переночевать.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] согревает ночью — старуха даёт шерстяное одеяло в дорогу.', 'noResourceText' => 'Без [Железо] ночь холодная, но утро встречаешь с чистой совестью.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Раненый сталкер сидит у костра и пытается сам себе перевязать плечо. «Помоги, брат. Напоролся на арматуру в тёмном подвале». Ты помогаешь ему с перевязкой. Он даёт тебе флягу с водой и ценный совет.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Перевязываешь рану — кровь остановлена. Сталкер жмёт руку: «Спасибо, брат!».', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,3),'chips'=>C($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] пошёл на перевязку — сталкер отдаёт флягу и редкий артефакт.', 'noResourceText' => 'Без [Вода] просто бинтуем тряпками — сталкер благодарен, но скромно.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Сталкер рассказывает про подвал, где напоролся — там остался ящик с патронами и чипами.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,3)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] пригодился, чтобы вскрыть ящик — внутри целый арсенал!', 'noResourceText' => 'Без [Изолента] ящик не вскрыть — запоминаешь место на будущее.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Сталкер знает местные тропы как свои пять пальцев. Рисует карту с пометками аномалий.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] в подарок сталкеру — он чертит подробную карту со всеми тайниками.', 'noResourceText' => 'Без [Инструменты] карта схематичная, но опасные места помечены.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'У сталкера во фляге не вода, а самогон. «Полечим раны по-нашему!» — прикладывается к фляге.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,2),'healPercent'=>RF(0.01,0.02)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] под закуску — сталкер доволен, открывает тайник с ништяками.', 'noResourceText' => 'Без [Дерево] просто самогон — разговор душевный, ништяков нет.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'К костру подходят ещё двое сталкеров — знакомые раненого. Вместе веселее, делятся припасами.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.01,0.03),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] растопил лёд — сталкеры угощают тушёнкой и патронами.', 'noResourceText' => 'Без [Железо] просто знакомство — пару баек и спать.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Собака выбегает из кустов, поджав хвост. У неё — царапина и ошейник с запиской: «Приюти, кто может». Забираешь её с собой — она становится твоим компаньоном. В ошейнике припрятаны чипы.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Собака доверчиво виляет хвостом. Забираешь её — в ошейнике чипы и записка с координатами дома.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2),'healPercent'=>RF(0.01,0.03)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] манит собаку — она приводит к тайнику бывшего хозяина.', 'noResourceText' => 'Без [Вода] собака просто идёт за тобой — компаньон и чипы.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'По дороге собака облаивает кусты — там спрятан рюкзак с припасами. Умный пёс!', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,3)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] в рюкзаке — собака радуется, прыгает вокруг.', 'noResourceText' => 'Без [Изолента] просто припасы — собака уже отрабатывает хлеб.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Собака оказывается обученной — знает команды «сидеть», «лежать», «голос». Ценный компаньон!', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] как игрушка для пса — он в восторге, слушается беспрекословно.', 'noResourceText' => 'Без [Инструменты] пёс просто умный — команды знает, но без фокусов.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Встречаешь бывшего хозяина по записке — он просит присмотреть за собакой, даёт чипы за услугу.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] в доказательство заботы — хозяин доверяет тебе пса насовсем.', 'noResourceText' => 'Без [Дерево] хозяин просто рад, что пёс в хороших руках.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Собака приводит к могиле старого сталкера — рядом оставлены его вещи. Последняя воля.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,3)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] помог открыть ржавый ящик — внутри инструменты и патроны.', 'noResourceText' => 'Без [Железо] забираешь вещи как есть — пёс грустит у могилы.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Юноша сидит на корточках у капкана, в который попался его друг. «Отцепи его, прошу!». Ты помогаешь освободить ногу парня. Спасённый достаёт из рюкзака банку тушёнки и несколько чипов.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Освобождаешь ногу из капкана — рана неглубокая. Парень в благодарность делится тушёнкой и чипами.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,3),'healPercent'=>RF(0.02,0.04)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] дезинфицирует рану — парень даёт двойную порцию чипов.', 'noResourceText' => 'Без [Вода] просто бинтуем — парень благодарен, но скромно.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Осматриваешь капкан — ручная работа, можно разобрать на запчасти. Парни не против.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] помог разобрать механизм — ценные детали!', 'noResourceText' => 'Без [Изолента] капкан просто железо — тоже пригодится.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Парни рассказывают, что капканы расставили бандиты — они предупреждают об опасной зоне.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] пригодился для обмена — парни выкладывают все секреты района.', 'noResourceText' => 'Без [Инструменты] просто слушаешь — информация полезная, но без деталей.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Оказывается, они выслеживали мутанта и сами попали в свой же капкан. Помогаешь закончить охоту.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => 'С [Дерево] охота удалась — мясо мутанта делим поровну.', 'noResourceText' => 'Без [Дерево] мутант ушёл — парни извиняются, делятся последним.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Появляются сталкеры, которые проверяют капканы. Объясняешь ситуацию — расходятся мирно.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] сглаживает конфликт — сталкеры угощают папиросой и уходят.', 'noResourceText' => 'Без [Железо] пришлось объяснять на пальцах — обошлось.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Девушка в запылённой куртке чинит солнечную панель на крыше сарая. «Подай мне ключ на 10!» Работаешь с ней часом. Она даёт тебе запасную батарею и чипы за помощь.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Подаёшь инструменты — панель починена, свет есть! Девушка довольно улыбается и даёт батарею.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] понадобился для пайки — девушка даёт две батареи вместо одной.', 'noResourceText' => 'Без [Вода] просто ключи — батарея одна, но рабочая.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В сарае находишь старый генератор и запчасти. Девушка разрешает взять что нужно.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] помогает открутить генератор — внутри медная обмотка, ценный лут.', 'noResourceText' => 'Без [Изолента] запчасти на вес — пригодятся для крафта.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Девушка рассказывает, что живёт здесь одна, сама всё чинит. Уважение — чистая выживаемость.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'healPercent'=>RF(0.01,0.02)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] в обмен на советы по выживанию — знания бесценны.', 'noResourceText' => 'Без [Инструменты] просто болтовня за работой — пара лайфхаков.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Пока чините панель, замечаешь вдалеке дым. Девушка объясняет, что это лагерь торговцев.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] как пропуск в лагерь — торговцы дают скидку.', 'noResourceText' => 'Без [Дерево] просто знаешь, где торговать — без скидки.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Работа подходит к концу, но начинает темнеть. Девушка предлагает чай и ночлег в сарае.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] к чаю — вечер тёплый, сил прибавилось.', 'noResourceText' => 'Без [Железо] просто чай и сено — отдохнул, и ладно.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Трое детей играют в «войнушку» возле сгоревшего бронетранспортёра. Они не видели чужаков с рождения. Ты даёшь им сладости и рассказываешь старую сказку. Их мать приглашает тебя на ужин и даёт припасы в дорогу.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Дети в восторге от сладостей — облепили тебя со всех сторон. Мать зовёт ужинать.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] в придачу к сладостям — мать даёт вдвое больше припасов.', 'noResourceText' => 'Без [Вода] просто сладости — дети счастливы, мать рада.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Рассказываешь сказку про храброго рыцаря. Дети слушают, раскрыв рты. Мать улыбается.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'healPercent'=>RF(0.01,0.03)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] как реквизит для сказки — дети в восторге, мать дарит книгу.', 'noResourceText' => 'Без [Изолента] просто слова — сказка запомнится детям надолго.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Осматриваешь бронетранспортёр — внутри уцелел ящик с инструментами и картами.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] открывает заклинивший люк — внутри целый склад!', 'noResourceText' => 'Без [Инструменты] люк не открыть — запоминаешь на будущее.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Мать рассказывает, что их отец ушёл в рейд и не вернулся. Просит узнать о нём у торговцев.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] в залог обещания — мать даёт ценный предмет из приданого.', 'noResourceText' => 'Без [Дерево] обещаешь узнать — мать кивает, надежда в глазах.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Появляется мужчина с ружьём — оказывается, отец семейства вернулся! Радость, объятия, ужин.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] к столу — отец достаёт флягу, празднуем встречу.', 'noResourceText' => 'Без [Железо] просто радость встречи — семья благодарит от души.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Из ямы кричит мужчина: «Помогите! Сорвался, ногу подвернул!». Ты спускаешь ему верёвку и вытаскиваешь. Он механик: в благодарность чинит одну из твоих вещей и делится чипами.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вытаскиваешь мужика — он механик от Бога. Чинит тебе вещь и даёт чипы. Ценный знакомый.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] для ремонта — механик делает вещь лучше новой! Награда x2.', 'noResourceText' => 'Без [Вода] ремонт на коленке — вещь рабочая, но неидеально.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В яме оказывается не только он, но и ящик с запчастями, который он нёс. Делится находкой.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] помог поднять ящик — внутри редкие шестерни и провода.', 'noResourceText' => 'Без [Изолента] ящик поднимаем вдвоём — запчасти пополам.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Механик рассказывает, что шёл к старому убежищу, где хранит инструменты. Даёт координаты.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] для открытия убежища — внутри верстак и материалы.', 'noResourceText' => 'Без [Инструменты] просто координаты — пригодятся в следующий раз.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Нога опухла — механик не может идти. Придётся нести его на себе до ближайшего жилья.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.03),'exp'=>E($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] облегчает ношу — механик компенсирует труды чипами.', 'noResourceText' => 'Без [Дерево] тащишь на горбу — тяжко, но он старается не ныть.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'На шум прибегают знакомые механика — помогают донести его до мастерской. Там тебя ждёт угощение.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] к столу в мастерской — механик дарит походный набор инструментов.', 'noResourceText' => 'Без [Железо] просто ужин и ночлег — тоже неплохо.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Бродячий кот трется о ноги. У него — ошейник с биркой «Рыжий, особь ценная». Кот ведёт тебя к заброшенному дому, где в подполе лежит ящик с инструментами и чипами.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Кот уверенно ведёт тебя к дому. В подполе — ящик с инструментами и чипами. Умный котейка!', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,4),'exp'=>E($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] из подпола — кот трётся о ноги, мол, я старался. Лут x2.', 'noResourceText' => 'Без [Вода] просто ящик — инструменты и чипы, кот довольно мурчит.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В доме, кроме подпола, есть кухня с запасом консервов. Кот одобрительно мяукает.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'chips'=>C($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] на ужин коту — он довольно жмурится, ведёт к ещё одному тайнику.', 'noResourceText' => 'Без [Изолента] кот просто рад компании — консервы твои.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Кот приводит на чердак — там гнездо птиц и старая шкатулка с украшениями.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] для шкатулки — внутри довоенные монеты, ценная находка.', 'noResourceText' => 'Без [Инструменты] шкатулка не открывается — запоминаешь место.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Кот шипит и фыркает в углу — там змея. Благодаря коту замечаешь опасность вовремя.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] отпугивает змею — кот довольно умывается, опасность миновала.', 'noResourceText' => 'Без [Дерево] убиваешь змею ножом — кот смотрит с уважением.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Кот приводит к соседнему дому — там живёт старушка, которая ищет своего Рыжего.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.05),'exp'=>E($l,2),'chips'=>C($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] обрадовал старушку — она угощает пирогом и даёт чипы за заботу о коте.', 'noResourceText' => 'Без [Железо] просто возвращаешь кота — старушка благодарит от души.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Древняя старуха сидит на крыльце и плетёт сеть из проволоки и пластиковых лент. «Помоги натянуть, старая уже, сил нет». Помогаешь — она угощает травяным чаем и даёт оберег из костей птиц.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Натягиваешь сеть — старуха довольно кивает. Чай пахнет мятой и чабрецом, оберег тёплый на ощупь.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] укрепляет сеть — старуха даёт второй оберег, «на счастье».', 'noResourceText' => 'Без [Вода] сеть держится на честном слове — старуха довольно улыбается.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Старуха рассказывает, что видела во сне «железных людей». «Они идут с севера, берегись».', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] в руках старухи — она шепчет заговор, давая тебе удачу.', 'noResourceText' => 'Без [Изолента] просто слушаешь старуху — информация к размышлению.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В доме старухи — сушёные травы, коренья и банки с настойками. Она разрешает взять немного.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] в обмен на травы — старуха даёт редкий рецепт настойки.', 'noResourceText' => 'Без [Инструменты] травы просто так — пригодятся для лечения.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Старуха оказывается знахаркой. Осматривает твои раны и даёт мазь из глины и прополиса.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'exp'=>E($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] для мази — старуха колдует, раны затягиваются на глазах.', 'noResourceText' => 'Без [Дерево] мазь простая, но помогает — спасибо и на том.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'К старухе приходят соседи за травами. Знакомишься с местными — они делятся новостями.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] на общем столе — соседи угощают тебя ужином и делятся припасами.', 'noResourceText' => 'Без [Железо] просто знакомство — новости узнал, и ладно.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Семья переселенцев остановилась у ручья. Отец чинит телегу, мать кормит детей. «Не подкинешь бензина? Своим кончился». Делишься топливом — они дают тебе старую карту местности с пометками тайников.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Делишься топливом — отец довольно хлопает по плечу. Карта с тайниками — отличная награда.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] в придачу к топливу — отец отмечает на карте ещё пару схронов.', 'noResourceText' => 'Без [Вода] просто топливо — карта и так с пометками.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Мать угощает тебя горячей похлёбкой — настоящая еда, а не синтетика. Силы возвращаются.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] к обеду — мать даёт с собой свёрток с едой.', 'noResourceText' => 'Без [Изолента] похлёбка простая, но сытная — сил прибавилось.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Дети играют у ручья — находишь в воде старый нож. Отец говорит: «Возьми, нам ни к чему».', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] наточил нож до остроты бритвы — отец одобрительно свистит.', 'noResourceText' => 'Без [Инструменты] нож ржавый, но сгодится — лучше, чем ничего.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Телега сломана серьёзнее, чем думали. Помогаешь с ремонтом — отец даёт ещё и инструменты.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,3)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] для ремонта — телега как новая, отец щедро делится припасами.', 'noResourceText' => 'Без [Дерево] ремонт на соплях — телега доедет, но скрипит.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Отец рассказывает о большом посёлке в двух днях пути. «Там есть рынок и доктор. Скажи, от меня».', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] как пропуск — в посёлке тебя встречают как своего.', 'noResourceText' => 'Без [Железо] просто имя отца — пропуск словесный, но работает.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Двое сталкеров спорят, куда идти. Один говорит: «Налево — к базе, направо — к смерти». Второй: «Да пошёл ты!». Ты указываешь им безопасный путь. В благодарность делятся патронами.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Разнимаешь спорщиков. Один из них признаёт твою правоту. Делятся патронами и картой.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,3),'exp'=>E($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] в качестве благодарности — сталкеры дают вдвое больше патронов.', 'noResourceText' => 'Без [Вода] просто патроны — спорщики расходятся довольные.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Выясняешь, что они спорят о дороге к старому НИИ. Ты знаешь этот район — рисуешь им маршрут.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] за информацию — сталкеры рассказывают, что нашли в НИИ.', 'noResourceText' => 'Без [Изолента] просто рисуешь карту — сталкеры благодарят на словах.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Оба сталкера поворачиваются против тебя — «А ты не лезь, умник!». Получаешь по лицу.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.12),'chips'=>NC($l,1)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] зажимаешь в кулаке — удар точный, сталкеры отступают.', 'noResourceText' => 'Без [Инструменты] удар пропускаешь — ссадина на скуле.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.05)];}],
                ['text' => 'Выясняется, что оба пути ведут к разным группировкам. «Налево — {faction}, направо — конкуренты».', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] примиряет спорщиков — они дают тебе карту с маршрутами.', 'noResourceText' => 'Без [Дерево] спорщики уходят в разные стороны — информация теряется.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Сталкеры оказываются из одного отряда — просто поссорились. Миришь их, получаешь долю.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] на троих — сталкеры угощают тебя ужином и делятся припасами.', 'noResourceText' => 'Без [Железо] просто миришь их — спасибо на словах.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Освобождаешь пленного, привязанного к столбу. «Спасибо, брат. Я инженер с Водоканала. Должен теперь тебе». Он даёт тебе жетон, по которому на его станции дадут бесплатный запас воды.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Перерезаешь верёвки — инженер свободен. Жетон на воду — отличная награда.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] в сейфе у инженера — он открывает тайник с чипами.', 'noResourceText' => 'Без [Вода] просто жетон — вода будет бесплатной.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Инженер рассказывает, что его взяли в плен бандиты. Он знает, где их лагерь — ведёт тебя туда.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,3)];}, 'resourceCost' => 'Изолента', 'resourceText' => 'С [Изолента] проникаешь в лагерь — забираешь припасы бандитов.', 'noResourceText' => 'Без [Изолента] осторожно обходишь лагерь — добыча скромнее.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Инженер чинит твой инструмент в благодарность. Золотые руки — теперь вещь как новая.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] для починки — инженер делает вещь лучше прежнего.', 'noResourceText' => 'Без [Инструменты] ремонт на скорую руку — вещь рабочая, но хлипкая.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'На шум прибегают бандиты, которые его сторожили. Приходится отбиваться от них вместе.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.06),'exp'=>E($l,3),'combat'=>true];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] в бою — инженер держится молодцом, вдвоём отбились.', 'noResourceText' => 'Без [Дерево] отбиваешься один — инженер прячется, но потом благодарит.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Инженер приглашает на станцию Водоканала — там тебя ждёт горячий душ и настоящий обед.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] в хозяйстве станции — инженер даёт редкую деталь для фильтра.', 'noResourceText' => 'Без [Железо] просто душ и обед — рай после пустоши.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Учитель в развалинах школы проводит урок для горстки детей. Он рассказывает о физике и истории. «Хочешь, посиди, послушай. Знания — сила». Полчаса лекции — и ты чувствуешь себя умнее.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Садишься на парту. Учитель объясняет закон Ома и тактику Ганнибала. Мозг кипит, но приятно.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,4),'healPercent'=>RF(0.01,0.02)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] для урока — учитель показывает действующую модель генератора.', 'noResourceText' => 'Без [Вода] просто лекция — знания откладываются в голове.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Учитель просит рассказать о внешнем мире. Дети слушают, раскрыв рты. Ты — живая легенда.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] в подарок школе — учитель даёт редкую книгу с картами.', 'noResourceText' => 'Без [Изолента] просто рассказ — дети в восторге, учитель благодарен.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Помогаешь учителю починить парты и доску. Заодно находишь в подсобке старый глобус.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] для мастерской — учитель даёт набор чертёжных инструментов.', 'noResourceText' => 'Без [Инструменты] просто мебель чинишь — глобус забираешь как сувенир.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Учитель жалуется на нехватку учебников. Обещаешь поискать в рейдах — дети радостно галдят.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] в залог обещания — учитель даёт обед и карту окрестностей.', 'noResourceText' => 'Без [Дерево] просто обещание — учитель верит, дети машут вслед.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'После урока учитель угощает чаем из трав. Разговор о жизни — простой и мудрый старик.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,3)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] к чаю — учитель достаёт книгу стихов, читает вслух.', 'noResourceText' => 'Без [Железо] чай и разговор — душа отдыхает.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'У монаха в оранжевой робе закончилась вода. Он медитирует под палящим солнцем. Ты даёшь ему флягу. «Будда хранит тебя, странник». Он дарит тебе чётки из обожжённой глины — они странно тёплые на ощупь.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Монах принимает воду с благодарностью. Чётки действительно тёплые — может, Будда хранит?', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'exp'=>E($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] во фляге — монах читает молитву, благословляя тебя. Силы прибывают.', 'noResourceText' => 'Без [Вода] просто вода — монах благодарит, дарит чётки.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Монах рассказывает о своём пути — он идёт к священному озеру. «Вода там лечит раны».', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] монаху в дорогу — он в ответ даёт карту с отмеченным озером.', 'noResourceText' => 'Без [Изолента] просто координаты — может, пригодится.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Монах медитирует с чётками — ты чувствуешь странное тепло. Кажется, раны затягиваются.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] усиливает медитацию — монах говорит, что ты «чист душой».', 'noResourceText' => 'Без [Инструменты] чётки просто греют — эффект плацебо или нет?', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'К монаху подходят местные жители за советом. Он представляет тебя как «спасителя». Честь.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] местным от тебя — они в ответ угощают обедом.', 'noResourceText' => 'Без [Дерево] просто знакомство — местные приветливы, но без подарков.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Монах приглашает разделить с ним скромную трапезу. Рис, вода и молитва — простота лечит.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] к трапезе — монах достаёт редкий фрукт, делится пополам.', 'noResourceText' => 'Без [Железо] рис пресный, но сытный — и это дар в Пустоши.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Слепой ветеран сидит у могильного креста. «Сын здесь лежит. Не уберёг…» Ты молча сидишь рядом. Ветеран достаёт флягу, наливает по сто грамм. Горькая, но крепкая встреча.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Сидишь с ветераном молча. Он ценит компанию. Достаёт сверток — патроны и чипы. «Держи, сынок».', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] греет руки — ветеран рассказывает о сыне, становится легче.', 'noResourceText' => 'Без [Вода] просто сидите молча — ветеран ценит тишину.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Ветеран оказывается бывшим снайпером. Учит тебя правильно дышать при стрельбе.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] для упражнений — ветеран даёт оптический прицел.', 'noResourceText' => 'Без [Изолента] просто урок дыхания — навык на всю жизнь.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Ветеран рассказывает, где его сын нашёл свой последний тайник. Даёт координаты.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => 'С [Инструменты] вскрываешь тайник — внутри вещи сына, ценные и памятные.', 'noResourceText' => 'Без [Инструменты] тайник не открыть — запоминаешь место.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Появляются мародёры. Ветеран, несмотря на слепоту, достаёт обрез. Отбиваетесь вместе.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.05),'exp'=>E($l,3),'combat'=>true];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] для обреза — ветеран стреляет как бог, мародёры бегут.', 'noResourceText' => 'Без [Дерево] отбиваешься один — ветеран прикрывает, как может.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Ветеран провожает тебя до околицы. «Заходи, если что. Солдату солдата понять легче».', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.05),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] на прощание — ветеран даёт армейский жетон, «на удачу».', 'noResourceText' => 'Без [Железо] просто рукопожатие — крепкое, мужское.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Молодая пара строит дом из обломков. «Не армия, не банда — просто хотим жить по-человечески». Они приглашают тебя помочь забить пару гвоздей. За работу кормят ужином и дают чипы.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Забиваешь гвозди, пилишь доски. Дом растёт на глазах. Пара довольно, ужин — от души.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] для стройки — парень даёт лишнюю пачку гвоздей.', 'noResourceText' => 'Без [Вода] стройка идёт медленнее, но ужин заслужил.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Девушка готовит ужин на костре. Настоящий борщ из консервов и дикого лука — объедение!', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'chips'=>C($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] к борщу — девушка даёт баночку солений на дорогу.', 'noResourceText' => 'Без [Изолента] борщ без хлеба, но горячий и наваристый.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Парень — бывший строитель. Показываешь ему чертёж, он подсказывает, как укрепить конструкцию.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] для чертежа — парень даёт инженерный справочник.', 'noResourceText' => 'Без [Инструменты] просто советы — опыт бесценен.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Находят старый ящик с инструментами в развалинах. Ты помогаешь его поднять — внутри запчасти.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => 'С [Дерево] ящик открывается без проблем — внутри редкий набор свёрл.', 'noResourceText' => 'Без [Дерево] ящик пришлось взламывать — запчасти частично испорчены.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Соседи приносят стройматериалы в благодарность за то, что пара строит общий колодец.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] на новоселье — соседи накрывают стол, тебя зовут как почётного гостя.', 'noResourceText' => 'Без [Железо] просто знакомство с соседями — полезные связи.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Гонец на велосипеде чуть не сбивает тебя. «Прости, брат, спешу! В посёлке эпидемия!». У него порвана цепь. Ты помогаешь починить — он мчится дальше, крикнув на прощание: «Проверь фильтр для воды, если есть!».',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Чинишь цепь за минуту — гонец жмёт газ (педали) и улетает. Ценная информация.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'healPercent'=>RF(0.01,0.02)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] для цепи — гонец даёт флягу с чистой водой «за скорость».', 'noResourceText' => 'Без [Вода] цепь на скорую руку — гонец благодарит на ходу.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Гонец рассказывает об эпидемии — тиф, грязная вода. Предупреждён — вооружён.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] для фильтрации — гонец даёт запасные фильтры.', 'noResourceText' => 'Без [Изолента] просто знаешь — будешь кипятить воду.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'У гонца в рюкзаке — пакет с лекарствами для посёлка. Он просит передать, если сам не доберётся.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] для лекарств — гонец доверяет тебе часть груза.', 'noResourceText' => 'Без [Инструменты] просто обещаешь помочь — груз пока при нём.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Велосипед разваливается на части — цепь порвана, колесо спущено, тормозов нет. Полный караул.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.03),'exp'=>E($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] для колеса — катим велик до посёлка вместе, гонец делится припасами.', 'noResourceText' => 'Без [Дерево] ремонт бесполезен — провожаешь гонца пешком.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'У гонца есть дубликат карты с отмеченными безопасными источниками воды. Делится.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'itemCount'=>1];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] за карту — гонец просит передать привет в посёлке от него.', 'noResourceText' => 'Без [Железо] карта так, на клочке — но источники отмечены.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Маленький щенок выбегает из кустов, весь в репьях. За ним никто не идёт. Ты даёшь ему галету — он лижет руку и бежит за тобой. Компаньон на ближайший час поднимает настроение.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Щенок жуёт галету и виляет хвостом. Идёт за тобой — настроение на высоте, мир кажется добрее.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] щенку — он радостно тявкает, ведёт к старому дому.', 'noResourceText' => 'Без [Вода] щенок просто бежит рядом — компания греет душу.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Щенок находит гнездо с яйцами — приносит в зубах, не разбив. Умный малыш!', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.01,0.03),'itemCount'=>1];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] в обмен на яйца — щенок довольно жмурится.', 'noResourceText' => 'Без [Изолента] яйца просто так — завтрак обеспечен.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Щенок лает на кусты — там спрятан рюкзак путника с припасами. Нюх не обманет!', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] в рюкзаке — щенок гордо виляет хвостом, мол, я красавчик.', 'noResourceText' => 'Без [Инструменты] просто рюкзак — консервы и карта.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Щенок отказывается идти дальше — скулит и смотрит в сторону леса. Там может быть его дом.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] манит щенка — он бежит к старой будке, там ошейник с адресом.', 'noResourceText' => 'Без [Дерево] щенок грустит — провожаешь его до опушки.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'К вечеру щенок устаёт. Засыпает у тебя на коленях. Тепло и уютно даже в Пустоши.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.05),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] щенку на подстилку — он сладко спит, сил прибавляется и у тебя.', 'noResourceText' => 'Без [Железо] спишь, обняв щенка — тепло и спокойно.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Одинокий торговец сидит у перевёрнутой телеги. Колесо сломалось, товары рассыпаны по пыльной дороге. Он предлагает щедрую плату за помощь — видно, что спешит.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Помогаешь собрать рассыпанные консервы — торговец открывает ящик с инструментами.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Консервы', 'resourceText' => '[Консервы] торговец делится пайком — «держ, брат, пригодится».', 'noResourceText' => 'Без [Консервы] торговец просто кивает — помощь за помощь.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Даёшь воды из фляги — торговец жадно пьёт и рассказывает о бандитской засаде на пути.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'healPercent'=>RF(0.01,0.03)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] оживляет торговца — он чертит карту с засадой.', 'noResourceText' => 'Без [Вода] торговец сухо благодарит — без карты нарвёшься на бандитов.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Замечаешь, что торговец ранен — перевязываешь глубокий порез на руке.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}, 'resourceCost' => 'Лекарства', 'resourceText' => '[Лекарства] обеззараживают рану — торговец даёт редкую микросхему из тайника.', 'noResourceText' => 'Без [Лекарства] рана может загноиться — торговец торопится уйти.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Помогаешь починить колесо снятой запчастью — телега снова на ходу.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}, 'resourceCost' => 'Топливо', 'resourceText' => '[Топливо] для канистры — торговец заливает и даёт подвезти пару километров.', 'noResourceText' => 'Без [Топливо] катишь телегу вручную — торговец обещает заплатить позже.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Ночью торговец достаёт старую рацию — просит батарейки, чтобы вызвать караван.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}, 'resourceCost' => 'Батарейки', 'resourceText' => '[Батарейки] оживляют рацию — караван отвечает, торговец дарит компас.', 'noResourceText' => 'Без [Батарейки] рация молчит — торговец вздыхает.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'На обочине дороги сидит слепая старуха. Перед ней старая шляпа с парой чипов. Она поворачивает голову на твои шаги: «Подай, добрый человек, век не забуду».',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Даёшь ей флягу — она долго пьёт, крестится. «Спасибо, сынок, отплачу добром».', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] возвращает старуху к жизни — достаёт старинную монету на удачу.', 'noResourceText' => 'Без [Вода] старуха всё равно благодарит — тепло на душе.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'У старухи дрожат руки — она давно не ела. Делишься консервой.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'healPercent'=>RF(0.01,0.02)];}, 'resourceCost' => 'Консервы', 'resourceText' => '[Консервы] старуха ест с аппетитом и рассказывает, где зарыт тайник её мужа.', 'noResourceText' => 'Без [Консервы] старуха отказывается от еды — «не голодна, милый».', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Замечаешь у старухи больную ногу — перематываешь чистой тканью.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] фиксирует повязку — старуха показывает тропу к ферме с припасами.', 'noResourceText' => 'Без [Изолента] повязка держится плохо, но старуха рада заботе.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Старуха говорит, что у неё есть внук — механик на старой заправке.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'healPercent'=>RF(0.01,0.03)];}, 'resourceCost' => 'Батарейки', 'resourceText' => '[Батарейки] для фонаря — старуха светит, показывает дорогу к заправке.', 'noResourceText' => 'Без [Батарейки] старуха описывает путь на словах — можно заблудиться.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'У старухи пропал голос — она хрипит. Даёшь ей лекарство от кашля.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}, 'resourceCost' => 'Лекарства', 'resourceText' => '[Лекарства] возвращают голос — старуха шепчет секретный код от сейфа.', 'noResourceText' => 'Без [Лекарства] старуха замолкает — так и не рассказала главного.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,4)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Из развалин школы доносится детский смех. Трое ребят играют в «войнушку» самодельными мечами из арматуры. Завидев тебя, замирают. Старший прячет младших за спину.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Достаёшь консервы и протягиваешь детям — они робко подходят, берут, благодарят.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Консервы', 'resourceText' => '[Консервы] дети тащат тебя к своему тайнику в подвале — там старый ящик с припасами.', 'noResourceText' => 'Без [Консервы] дети просто прячутся — недоверие в глазах.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Показываешь фокус с монеткой и батарейкой — дети в восторге, смеются, зовут играть.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'healPercent'=>RF(0.02,0.03)];}, 'resourceCost' => 'Батарейки', 'resourceText' => '[Батарейки] заставляют фонарик мигать — дети визжат от радости и дарят найденный нож.', 'noResourceText' => 'Без [Батарейки] фокус не удаётся — дети разочарованы.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Спрашиваещь, где их родители. Старший мальчик показывает на холм — там лагерь выживших.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] для детей — они пьют и рассказывают о бандах в округе, чертят карту.', 'noResourceText' => 'Без [Вода] дети замолкают — старший насторожен.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Младший показывает свою «крепость» — куча мусора и старый сейф вместо трона.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] открывают сейф — внутри старые чипы и довоенная карта.', 'noResourceText' => 'Без [Инструменты] сейф не открыть — дети огорчены.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Дети просят проводить их до лагеря — страшно одним. Соглашаешься.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'healPercent'=>RF(0.02,0.04)];}, 'resourceCost' => 'Топливо', 'resourceText' => '[Топливо] для костра — дети греются, показывают короткую тропу к лагерю.', 'noResourceText' => 'Без [Топливо] идёте в темноте — медленно, но безопасно.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Придорожный гараж с проржавевшей вывеской «Шиномонтаж». Внутри возится механик. Увидев тебя, он вытирает руки ветошью: «Запчасти есть? Работа нужна?».',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Даёшь механикe инструменты — он свистит: «О, комаровские!» Чинит твой инвентарь.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] механик собирает из хлама полезную вещь — дарит на память.', 'noResourceText' => 'Без [Инструменты] механик разводит руками — «нет материала — нет работы».', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Механик просит подсобить с двигателем — вместе вытаскиваете старый мотор.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}, 'resourceCost' => 'Топливо', 'resourceText' => '[Топливо] механик заводит генератор — гараж оживает, он даёт скидку на ремонт.', 'noResourceText' => 'Без [Топливо] работаешь вручную — механик платит чипами.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В углу гаража — куча гнилых досок. Механик просит расчистить.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'healPercent'=>RF(0.01,0.02)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] годится на растопку — механик рад, делится довоенным пайком.', 'noResourceText' => 'Без [Дерево] расчищаешь руками — грязь и пыль, но гараж опрятнее.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.01,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Находишь в гараже сломанный пластиковый корпус — механик говорит, что нужна заплатка.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}, 'resourceCost' => 'Пластмасса', 'resourceText' => '[Пластмасса] механик варит корпус — получается крепкая канистра для воды.', 'noResourceText' => 'Без [Пластмасса] корпус летит в утиль — ничего не заработал.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Механик жалуется на тусклый свет — фонарь садится. Нужны батарейки.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}, 'resourceCost' => 'Батарейки', 'resourceText' => '[Батарейки] оживляют свет — механик находит под верстаком забытый ящик с чипами.', 'noResourceText' => 'Без [Батарейки] механик чинит на ощупь — работа идёт медленно.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Из кустов вываливается растрёпанный мужик с диким взглядом. Он тяжело дышит, оглядывается: «За мной хвост! Бандиты! Спрячь меня!».',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Даёшь ему воды — он отпивает и успокаивается. Рассказывает, что сбежал из плена.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'healPercent'=>RF(0.01,0.03)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] беглец приходит в себя и называет пароль от бандитского схрона с добычей.', 'noResourceText' => 'Без [Вода] беглец в панике — без карты схрон не найдёшь.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,4)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Беглец ранен — пуля задела плечо. Достаёшь бинты и лекарства.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}, 'resourceCost' => 'Лекарства', 'resourceText' => '[Лекарства] обеззараживают рану — беглец в благодарность отдаёт трофейный пистолет.', 'noResourceText' => 'Без [Лекарства] рана кровоточит — беглец теряет сознание, тащишь на себе.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Кормишь беглеца консервами — он жадно ест и рассказывает, где бандиты держат заложников.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Консервы', 'resourceText' => '[Консервы] беглец показывает тайный вход в лагерь — можно ударить первым.', 'noResourceText' => 'Без [Консервы] беглец слаб — информацию выдаёт урывками.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Слышен шум мотора — бандиты близко. Нужно заметать следы.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'damagePercent'=>RF(0.01,0.02)];}, 'resourceCost' => 'Топливо', 'resourceText' => '[Топливо] разливает лужи — бандиты решают, что здесь уже побывали, уезжают.', 'noResourceText' => 'Без [Топливо] прячешься в кустах — бандиты прочёсывают местность.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Беглец весь в ссадинах — перевязываешь его рваную одежду изолентой.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2),'healPercent'=>RF(0.01,0.02)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] держит повязку — беглец приходит в форму и ведёт тебя к тайнику.', 'noResourceText' => 'Без [Изолента] повязка спадает — беглец морщится от боли.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Старенький радиоприёмник на развалинах вдруг оживает — сквозь помехи пробивается голос: «SOS... Мы на старой метеостанции... Нужна помощь...».',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Проверяешь питание — приёмник сажает последние батарейки. Нужны свежие.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}, 'resourceCost' => 'Батарейки', 'resourceText' => '[Батарейки] оживляют приёмник — сигнал чистый, ты слышишь координаты.', 'noResourceText' => 'Без [Батарейки] приёмник глохнет — SOS остаётся неуслышанным.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Шум глушит сигнал — можно попробовать поднять антенну повыше.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'damagePercent'=>RF(0.01,0.02)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] удлиняют антенну — сигнал пробивается, слышно место и время.', 'noResourceText' => 'Без [Инструменты] антенна болтается — сигнал то появляется, то пропадает.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Помехи от старого пластикового корпуса — можно изолировать.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'healPercent'=>RF(0.01,0.02)];}, 'resourceCost' => 'Пластмасса', 'resourceText' => '[Пластмасса] экранирует корпус — помехи исчезают, голос чёткий и ясный.', 'noResourceText' => 'Без [Пластмасса] помехи остаются — слышны только обрывки.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Приёмник перегрелся — нужна деревянная подставка для вентиляции.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] подставка — приёмник остывает, работает стабильно.', 'noResourceText' => 'Без [Дерево] приёмник греется и затихает — сигнал потерян.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Голос с метеостанции просит принести топливо для генератора.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,3)];}, 'resourceCost' => 'Топливо', 'resourceText' => '[Топливо] — «Брат, ты нас спас!» На метеостанции тебя ждёт награда.', 'noResourceText' => 'Без [Топливо] откликнуться нечем — станция замолкает.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,4)];}, 'noResourceEffects' => function($z,$l){return [];}],
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
    "Бензоколонка с проржавевшими колонками. Ценник: «Бензин — 5$». Смешно.",
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
                ['text' => 'Распознаёшь обман — готовишься к бою заранее и застаёшь бандитов врасплох.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] стягивает рукоять — дубина летит точнее, бандиты разбегаются.', 'noResourceText' => 'Без [Вода] рукоять скользит — удар смазанный, бой затягивается.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Замечаешь второго в кустах — бьёшь первым, вырубаешь главаря с одного удара.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] смывает пот — взгляд ясный, удар точный в челюсть.', 'noResourceText' => 'Без [Изолента] пот заливает глаза — мажешь, пропускаешь ответку.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Бандиты действуют слаженно — дубины бьют с двух сторон, припасы сыплются на землю.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.12),'chips'=>NC($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] в кулаке — бьёшь наотмашь, пробиваешь строй.', 'noResourceText' => 'Без [Инструменты] кулаки скользят по курткам — бандиты смеются.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.05)];}],
                ['text' => 'Главарь банды подходит ближе — нюхает твой рюкзак и решает забрать всё.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.10,0.15),'chips'=>NC($l,3)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] прикрывает горло — удар дубиной скользит, не ломает ключицу.', 'noResourceText' => 'Без [Дерево] удар приходится в шею — теряешь сознание, просыпаешься без вещей.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.05,0.07)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.05,0.07)];}],
                ['text' => 'Бросаешь горсть пыли в глаза главарю, прорываешься сквозь строй, хватая свой рюкзак.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.06),'exp'=>E($l,3)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] под рукой — швыряешь во врагов, создавая дымовую завесу.', 'noResourceText' => 'Без [Железо] пыль не помогает — бандиты хватают тебя за куртку.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.03),'chips'=>NC($l,1)];}],
            ],
        ],
    ],
    [
        'text' => 'Девушка с заплаканным лицом просит воды. Ты протягиваешь флягу — она выбивает её у тебя из рук, и тут же из кустов выбегают её сообщники. «Шмонай его!» Потеряно часть чипов.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Чувствуешь неладное — держишь флягу крепко, она не может её выбить. Сообщники выбегают раньше времени, ты готов.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] бросаешь под ноги — сообщники поскальзываются, падают.', 'noResourceText' => 'Без [Вода] нечем отвлечь — сообщники хватают тебя за руки.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Замечаешь шевеление в кустах заранее — делаешь шаг назад, разрывая дистанцию.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] оказывается под рукой — брызгаешь в глаза нападающим, убегаешь.', 'noResourceText' => 'Без [Изолента] сообщники набрасываются — получаешь пару ударов.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Девушка ловко выбивает флягу — сообщники налетают, обшаривают карманы. Чипы исчезают.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>NC($l,2),'damagePercent'=>RF(0.04,0.08)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] в кармане — отбиваешься, сохраняешь половину чипов.', 'noResourceText' => 'Без [Инструменты] тебя обыскивают до нитки — все чипы пропали.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Из кустов выбегает пятеро вместо троих — засада оказалась крупнее, чем думал.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.14),'chips'=>NC($l,3)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] перекрывает вход — один бандит застревает, остальных добиваешь.', 'noResourceText' => 'Без [Дерево] бандиты налетают толпой — жёсткий бой, большие потери.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.04,0.06)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.04,0.06)];}],
                ['text' => 'Прикрываешь лицо рукой, уворачиваешься от удара и бежишь в сторону леса. Чипы сыплются, но жизнь цела.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.05),'chips'=>NC($l,1),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] разбрасываешь за спиной — преследователи задерживаются, собирая трофеи.', 'noResourceText' => 'Без [Железо] преследователи догоняют — получаешь по спине дубиной.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.03)];}],
            ],
        ],
    ],
    [
        'text' => 'Запах дыма и жареного мяса. За столом сидит компания, машет: «Садись, путник, угощайся!» Мясо оказывается отравленным. Ты теряешь сознание и просыпаешься без части вещей.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Нюхаешь мясо — запах подозрительный. Отказываешься от угощения, компания теряет интерес.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] проверяешь на куске хлеба — мясо шипит. Разоблачаешь заговор.', 'noResourceText' => 'Без [Вода] приходится рискнуть — откусываешь кусок, чувствуешь горечь.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Достаёшь свои припасы — «У меня своё есть, спасибо». Компания злится, но не нападает.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] разбавляешь их самогон — компания пьянеет, забывает о тебе.', 'noResourceText' => 'Без [Изолента] компания настаивает — силой заставляют есть отраву.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Мясо кажется вкусным — съедаешь кусок. Сознание мутится, падаешь лицом в тарелку.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.14),'chips'=>NC($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] прочищает желудок — успеваешь вырвать яд до того, как он подействовал.', 'noResourceText' => 'Без [Инструменты] яд действует быстро — просыпаешься связанным, без вещей.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.04,0.06)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.04,0.06)];}],
                ['text' => 'Компания оказывается больше — из-за дерева выходят ещё трое. Котёл с отравой на всех.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.10,0.18),'chips'=>NC($l,3)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] прикрывает лицо — удар дубиной скользит, успеваешь вскочить.', 'noResourceText' => 'Без [Дерево] удар приходится в висок — глубокий нокаут.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.05,0.07)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.05,0.07)];}],
                ['text' => 'Замечаешь странный привкус — откладываешь кусок, но компания уже окружила. Приходится пробиваться.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.06),'exp'=>E($l,3),'chips'=>NC($l,1)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] ломаешь о скамью — импровизированное оружие разгоняет компанию.', 'noResourceText' => 'Без [Железо] дерёшься голыми руками — вырываешься, но теряешь часть припасов.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04),'chips'=>NC($l,1)];}],
            ],
        ],
    ],
    [
        'text' => 'Яркая тряпка на ветке — якобы указатель к «Бесплатному складу». Там — растяжка с гранатой. Чудом остаёшься жив, но контужен и зол.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Замечаешь тонкую леску поперёк прохода — растяжка обезврежена. В «складе» находишь припасы.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] перерезает леску — граната не взрывается, забираешь трофеи.', 'noResourceText' => 'Без [Вода] леску не перерезать — граната взрывается за спиной.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Тряпка слишком яркая — явно приманка. Обходишь склад стороной, находишь схрон в скалах.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] смачиваешь тряпку — она тяжелеет, не колышется. Растяжка заметна сразу.', 'noResourceText' => 'Без [Изолента] тряпка манит — подходишь ближе, леска уже натянута.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Ничего не подозревая, заходишь в склад — граната взрывается. Контужен, оглушён.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.12,0.20),'chips'=>NC($l,1)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] в руках — успеваешь прикрыть голову, урон меньше.', 'noResourceText' => 'Без [Инструменты] взрыв приходится в корпус — тяжёлые ранения, осколки.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.05,0.08)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.05,0.08)];}],
                ['text' => 'Растяжка ведёт к цепной реакции — взрываются ещё две гранаты. Мощный взрыв.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.18,0.25),'chips'=>NC($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] затыкаешь уши — контузия слабее, слышишь звон, но стоишь.', 'noResourceText' => 'Без [Дерево] взрыв глушит полностью — очнулся в ста метрах, без памяти.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.07,0.10)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.07,0.10)];}],
                ['text' => 'Замечаешь растяжку в последний момент — падаешь ничком. Взрыв задевает спину, но жить будешь.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.05,0.10),'exp'=>E($l,3)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] подкладываешь под гранату — взрыв гасится, цел и невредим.', 'noResourceText' => 'Без [Железо] взрывная волна швыряет о стену — ушибы и порезы.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.05),'exp'=>E($l,1)];}],
            ],
        ],
    ],
    [
        'text' => '"Эй, чувак, хочешь дешёвый ствол?" — парень в капюшоне достаёт пистолет. Пистолет — муляж, а пока ты смотришь, его подельник обчищает твой рюкзак.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Узнаёшь модель — слишком лёгкий для настоящего. Бьёшь по руке, муляж летит в грязь.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] прилетает в голову подельника — он падает, рюкзак твой.', 'noResourceText' => 'Без [Вода] подельник успевает отбежать с рюкзаком.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Держишь рюкзак перед собой — подельник не может расстегнуть молнию. Поворачиваешься и бьёшь.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] хлещет по лицу подельника — он отшатывается, теряет равновесие.', 'noResourceText' => 'Без [Изолента] подельник ловко вытаскивает вещи из карманов куртки.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Пистолет выглядит настоящим — отвлекаешься. Подельник вытаскивает часть припасов.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>NC($l,2),'damagePercent'=>RF(0.02,0.05)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] зажимаешь под мышкой — подельник не может добраться до кармана.', 'noResourceText' => 'Без [Инструменты] подельник шарит по карманам — исчезают чипы и мелочи.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Из-за угла выходит второй подельник — засада на три стороны. Пути к отступлению нет.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.12),'chips'=>NC($l,3)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] швыряешь под ноги — нападающие поскальзываются, разбегаются.', 'noResourceText' => 'Без [Дерево] тебя зажимают в угол — получаешь по голове прикладом.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.05)];}],
                ['text' => 'Отбрасываешь рюкзак в сторону — подельник бросается за ним. Пока они заняты, атакуешь.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04),'exp'=>E($l,3),'chips'=>NC($l,1)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] летит в подельника — он спотыкается, роняет награбленное.', 'noResourceText' => 'Без [Железо] подельник хватает рюкзак и бежит — часть припасов потеряна.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.03),'chips'=>NC($l,1)];}],
            ],
        ],
    ],
    [
        'text' => 'Из темноты — крик о помощи. Ты бежишь на звук и проваливаешься в яму-ловушку, прикрытую ветками. На дне — старые кости и вонь. Выбираешься, но ранен и выпачкан в грязи.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Крик стихает — понимаешь, что это подстроено. Пятишься к дереву и замечаешь верёвку ямы.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] бросаешь в яму — верёвка ржавая, ветки гнилые, обман виден.', 'noResourceText' => 'Без [Вода] лезешь в яму головой — больно, грязно, унизительно.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Зажигаешь фонарь — внизу видны кости. Точно ловушка. Обходишь, но теряешь время.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] плещешь в яму — вода шипит, кислота на дне. Повезло, что не упал.', 'noResourceText' => 'Без [Изолента] темно — не видно дна, думаешь, просто яма.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Бежишь на крик и проваливаешься. Яма глубокая — выбираешься весь в синяках и грязи.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.06,0.12),'chips'=>NC($l,1)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] цепляется за стенки — карабкаешься быстрее, не срываешься.', 'noResourceText' => 'Без [Инструменты] стенки скользкие — срываешься трижды, теряешь силы.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'На дне ямы оказывается нора — оттуда вылезают крысы. Кусают тебя, пока карабкаешься.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.14),'exp'=>E($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] разводишь костёр у входа — крысы не лезут, дым отпугивает.', 'noResourceText' => 'Без [Дерево] крысы кусают за пальцы — больно, противно, мерзко.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.05)];}],
                ['text' => 'Кричащий оказывается манекеном с динамиком. Ловушка для дураков. Ты дурак, но живой.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.05),'exp'=>E($l,3)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] кидаешь в манекен — он разваливается, внутри чипы и механизмы.', 'noResourceText' => 'Без [Железо] просто пинаешь манекен — пусто, только динамик.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.03),'chips'=>NC($l,1)];}],
            ],
        ],
    ],
    [
        'text' => '"Меня зовут {male}, я бывший военный. Вступи в наш отряд — у нас еда, оружие, бабы!" В отряде оказывается секта каннибалов. С боем прорываешься наружу.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => '"Военный" щёлкает пальцами слишком нервно — профи так не делают. Отказываешься вежливо.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] протягиваешь "военному" — он хватает, но рука дрожит. Точно не профи.', 'noResourceText' => 'Без [Вода] просто отказываешься — он настаивает, но ты уже настороже.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Замечаешь человеческие кости у костра — "откуда, говорю, мясо?" Он бледнеет.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] проливаешь на кости — они шипят. Точно человеческие. Каннибалы.', 'noResourceText' => 'Без [Изолента] кости похожи на свиные — или ты себя убеждаешь?', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Вступаешь в отряд — на третий день замечаешь, что "тушёнка" подозрительно знакомая. Бой.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.12,0.22),'chips'=>NC($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] зажимаешь в кулаке — бьёшь наотмашь, пробиваешь строй сектантов.', 'noResourceText' => 'Без [Инструменты] кулаки скользят — сектанты валят тебя, связывают.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.05,0.08)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.05,0.08)];}],
                ['text' => 'Сектантов оказывается больше дюжины — засада. Прорываешься с боем, теряя часть припасов.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.14,0.22),'chips'=>NC($l,3),'combat'=>true];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] разрывает круг — сектанты шатаются, ты выбегаешь в лес.', 'noResourceText' => 'Без [Дерево] круг сжимается — получаешь удар по затылку, падаешь.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.06,0.09)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.06,0.09)];}],
                ['text' => 'Предлагаешь "военному" сделку — рассказываешь про другой отряд. Он уводит своих. Ты сбегаешь.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] даёшь "военному" на дорогу — он уходит, оставляя тебя в покое.', 'noResourceText' => 'Без [Железо] он требует чипы — платишь, но теряешь половину запаса.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return ['chips'=>NC($l,2)];}],
            ],
        ],
    ],
    [
        'text' => 'Красивая женщина в чистой одежде стоит на пороге брошенного магазина. «Заходи, я одна, мне страшно». Внутри — ловушка: двое с ножами. Едва уносишь ноги.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Слишком чистая для Пустоши — явно подстава. Проходишь мимо, женщина зло ругается вслед.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] кидаешь в витрину — звон стекла отвлекает нападающих, уходишь.', 'noResourceText' => 'Без [Вода] просто проходишь — она кричит, но ты не оборачиваешься.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Заходишь с оружием наготове — замечаешь нож в рукаве женщины. Бьёшь первой.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] заливает глаза женщине — она слепнет, нападающие в панике.', 'noResourceText' => 'Без [Изолента] женщина выхватывает нож — бой начинается с её удара.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Заходишь и попадаешь в ловушку — двое с ножами атакуют. Едва уносишь ноги, получая порезы.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.14),'chips'=>NC($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] отбивает нож — один нападающий роняет оружие, выбегает.', 'noResourceText' => 'Без [Инструменты] ножи достают до тебя — глубокие порезы, потеря крови.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.05)];}],
                ['text' => 'Из подсобки выбегают ещё двое — четверо против одного. Отбиваешься, но теряешь припасы.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.10,0.18),'chips'=>NC($l,3)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] перекрывает проход — женщина спотыкается, нападающие путаются.', 'noResourceText' => 'Без [Дерево] проход свободен — нападающие атакуют со всех сторон.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.04,0.06)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.04,0.06)];}],
                ['text' => 'Внутри оказывается ловушка с сигнализацией — на шум прибегают ещё люди. Сбегаешь через чёрный ход.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.04,0.08),'exp'=>E($l,3)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] заклинивает дверь чёрного хода — нападающие не могут открыть, ты сбегаешь.', 'noResourceText' => 'Без [Железо] дверь заперта — ищешь другой выход, теряя время и силы.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04),'chips'=>NC($l,1)];}],
            ],
        ],
    ],
    [
        'text' => 'Странник предлагает сыграть в кости: "Удвою твои чипы, если выиграешь!" Кости краплёные. Проигрываешь всё, что поставил.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Замечаешь, что кости падают одинаково — крап. "Спасибо, не интересно". Странник злится.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] проверяешь на костях — они шипят, крап проступает. Странник бледнеет.', 'noResourceText' => 'Без [Вода] просто отказываешься — странник пожимает плечами, уходит.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Достаёшь свои кости — "Давай на моих". Странник отказывается — явно боится честной игры.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] смачиваешь кости — крап смывается, кости становятся честными.', 'noResourceText' => 'Без [Изолента] кости как кости — может, показалось?', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Соглашаешься и проигрываешь всё. Кости явно краплёные — чипы уплывают в карман странника.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>NC($l,2),'damagePercent'=>RF(0.01,0.03)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] отвлекает странника — подменяешь кости на свои, выигрываешь обратно.', 'noResourceText' => 'Без [Инструменты] странник забирает выигрыш — чипы уплывают навсегда.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Странник не один — из-за угла выходят двое. Если проиграешь — не отдашь просто так.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.06,0.10),'chips'=>NC($l,3)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] швыряешь в странника — он спотыкается, подельники бегут помогать, ты уходишь.', 'noResourceText' => 'Без [Дерево] подельники хватают тебя — обыскивают, забирают чипы силой.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.05)];}],
                ['text' => 'Соглашаешься, но ставишь маленькую сумму. Проигрываешь — странник уходит довольный, но ты почти ничего не потерял.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>NC($l,1),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] бросаешь под ноги страннику — он наклоняется, ты уходишь с чипами.', 'noResourceText' => 'Без [Железо] странник ловко прячет выигрыш — ты остаёшься в минусе.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['chips'=>NC($l,1)];}],
            ],
        ],
    ],
    [
        'text' => 'Дорогу перегородил «дорожный сборщик» — вооружённый тип с ржавым автоматом. "Плати за проход". Платишь, но в последний момент он пытается забрать всё. Отбиваешься, но чипы уже потеряны.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Автомат ржавый — даже не встанет. Достаёшь свой ствол, сборщик пятится: "Ладно, проходи".', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] блестит на солнце — сборщик видит, что ты вооружён серьёзно, отступает.', 'noResourceText' => 'Без [Вода] сборщик смеётся — "С пустыми руками пришёл, лох?"', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Автомат заклинивает — сборщик пытается передёрнуть затвор, но бесполезно. Атакуешь.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] заливаешь автомат — механизм заклинивает намертво, сборщик в панике.', 'noResourceText' => 'Без [Изолента] автомат просто старый — может выстрелить, а может нет.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Платишь, но сборщик хватает твой рюкзак. Отбиваешь, теряя часть чипов в драке.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>NC($l,2),'damagePercent'=>RF(0.04,0.08)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] прилетает сборщику в лоб — он роняет автомат, хватается за лицо.', 'noResourceText' => 'Без [Инструменты] сборщик бьёт прикладом — получаешь по рёбрам, теряешь дыхание.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Из кустов выходят его подельники — целая банда сборщиков. Окружают со всех сторон.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.14),'chips'=>NC($l,3)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] разрывает круг — бандиты разбегаются, ты прорываешься.', 'noResourceText' => 'Без [Дерево] круг сжимается — получаешь удары со всех сторон, теряешь припасы.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.04,0.06)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.04,0.06)];}],
                ['text' => 'Сборщик срывается — автомат стреляет очередью в воздух. Ты падаешь, прикрывая голову, и теряешь часть чипов.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.06),'chips'=>NC($l,1),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] прикрывает спину — пуля рикошетит от неё, ты цел, сборщик бежит.', 'noResourceText' => 'Без [Железо] пуля задевает плечо — больно, но жить будешь. Сборщик сбегает.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
            ],
        ],
    ],
    [
        'text' => '"Помоги откопать колодец!" — кричит мужик из ямы. Ты наклоняешься — он хватает тебя за шкирку и стаскивает вниз. Под землёй — старая штольня. Выбираешься через затопленный тоннель.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Слишком громко кричит для "застрявшего" — явно приманка. Достаёшь верёвку и делаешь вид, что помогаешь.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] бросаешь в яму — мужик ловит, но рука скользит. Он не может выбраться.', 'noResourceText' => 'Без [Вода] мужик просит руку — ты не даёшь, он злится, вылезает сам.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Заглядываешь в яму — внизу виден лаз. Мужик не застрял, он ждёт жертву. Броска не происходит.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] заливаешь лаз — мужик вылезает мокрый и злой. Обходит тебя стороной.', 'noResourceText' => 'Без [Изолента] темнота скрывает лаз — не видишь подвоха.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Наклоняешься — мужик хватает за шкирку и тащит вниз. В штольне темно и сыро. Выбираешься через тоннель.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.10,0.18),'exp'=>E($l,4)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] освещает тоннель — находишь выход быстрее, без лишних травм.', 'noResourceText' => 'Без [Инструменты] тоннель тёмен — спотыкаешься, расшибаешь колени.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.04,0.06)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.04,0.06)];}],
                ['text' => 'Мужик оказывается не один — из тоннеля выходят двое. Засада под землёй.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.12,0.20),'chips'=>NC($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] перекрывает вход — подельники не могут выбраться, мужик один.', 'noResourceText' => 'Без [Дерево] подельники выходят — тройной удар в темноте.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.05,0.07)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.05,0.07)];}],
                ['text' => 'Кидаешь мужику палку — "Держись!" Он хватает, палка гнилая, ломается. Он падает обратно в яму. Ты уходишь.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] крепкая — мужик вылезает, благодарит и уходит. Никакой ловушки.', 'noResourceText' => 'Без [Железо] палка гнилая — мужик орёт, обещает отомстить.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
            ],
        ],
    ],
    [
        'text' => 'Лже-сталкер продаёт тебе карту "сокровищ". Он ведёт тебя к муляжу, где вместо сундука — взрывпакет. Теряешь часть снаряжения.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Карта явно нарисована от руки — свежие чернила. Разворачиваешься и уходишь.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] смачивает карту — чернила плывут. Фальшивка!', 'noResourceText' => 'Без [Вода] просто не веришь — сталкер обижается, уходит.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Идёшь с ним, но держишь дистанцию. Он указывает на муляж — ты уже сзади, бьёшь первым.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] скрывает твои следы — сталкер теряет тебя из виду, ты заходишь сбоку.', 'noResourceText' => 'Без [Изолента] сталкер видит тебя — ты слишком заметен на открытой местности.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Покупаешь карту и идёшь к "сокровищу". Вместо сундука — взрывпакет. Теряешь снаряжение.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.15),'chips'=>NC($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] прикрывает от взрыва — урон меньше, снаряжение целее.', 'noResourceText' => 'Без [Инструменты] взрывная волна швыряет на землю — вещи разлетаются.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.05)];}],
                ['text' => 'Лже-сталкер приводит к банде — из кустов выходят четверо. Ловушка на два этапа.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.10,0.18),'chips'=>NC($l,3)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] перекрывает тропу — бандиты не могут подойти сзади, бой фронтальный.', 'noResourceText' => 'Без [Дерево] бандиты заходят со спины — получаешь удар дубиной по затылку.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.04,0.06)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.04,0.06)];}],
                ['text' => 'Замечаешь, что сталкер нервно оглядывается. Достаёшь оружие — он срывается и бежит.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] догоняет сталкера — находишь у него в кармане настоящую карту с тайником.', 'noResourceText' => 'Без [Железо] сталкер убегает — остаёшься с фальшивкой и без чипов.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['chips'=>NC($l,1)];}],
            ],
        ],
    ],
    [
        'text' => 'Женщина с ребёнком стоит на дороге, голосует. Ты останавливаешься — "ребёнок" оказывается муляжом, а из кустов выбегают грабители. "Кошелёк или жизнь!" Отбиваешься с трудом.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => '"Ребёнок" не шевелится — явно кукла. Достаёшь оружие, женщина бледнеет, грабители не выходят.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] кидаешь в муляж — он глухо стукает. Пластик. Женщина срывает маску.', 'noResourceText' => 'Без [Вода] не уверен — может, настоящий? Женщина использует твоё замешательство.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Останавливаешься на расстоянии. Женщина приближается — слишком быстрая для "спасающейся".', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] плещешь под ноги — женщина поскальзывается, грабители выбегают раньше времени.', 'noResourceText' => 'Без [Изолента] женщина подходит вплотную — слишком поздно, грабители сзади.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Останавливаешься — "ребёнок" муляж, грабители выбегают. Отбиваешься, теряя часть чипов.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.06,0.12),'chips'=>NC($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] прилетает в первого грабителя — он падает, остальные запинаются.', 'noResourceText' => 'Без [Инструменты] грабители сразу заламывают руки — обыскивают, забирают чипы.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Грабителей оказывается шестеро — целая шайка. Окружают, требуют всё.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.15),'chips'=>NC($l,3)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] разрывает круг — один грабитель падает, ты выбегаешь из кольца.', 'noResourceText' => 'Без [Дерево] кольцо сжимается — получаешь удары со всех сторон.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.04,0.06)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.04,0.06)];}],
                ['text' => 'Женщина плачет по-настоящему — муляж, но она не в курсе? Грабители выбегают, она кричит.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.06),'exp'=>E($l,3)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] защищает женщину — грабители в замешательстве, ты выигрываешь время.', 'noResourceText' => 'Без [Железо] женщина мешается — грабители хватают вас обоих.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04),'chips'=>NC($l,1)];}],
            ],
        ],
    ],
    [
        'text' => 'Странный аппарат посреди дороги — "автомат желаний". Надпись: "Брось 10 чипов и загадай". Бросаешь — аппарат выплёвывает ржавую банку с газом. Газ едкий, глаза слезятся.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Пинком сбиваешь аппарат — внутри механизм с баллончиком. Обычный развод. Забираешь чипы обратно.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] выливается на механизм — он замыкает, чипы высыпаются из прорехи.', 'noResourceText' => 'Без [Вода] аппарат пуст внутри — развод чистый, чипов нет.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Замечаешь трубку, ведущую в кусты — кто-то управляет аппаратом дистанционно.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] заливаешь в трубку — из кустов доносится чихание. Аппарат замолкает.', 'noResourceText' => 'Без [Изолента] перерезаешь трубку — аппарат плюётся газом, глаза щиплет.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Бросаешь 10 чипов — аппарат плюётся газом в лицо. Глаза слезятся, чипы пропали.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.06),'chips'=>NC($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] прикрывает лицо — газ не попадает в глаза, видишь, куда упали чипы.', 'noResourceText' => 'Без [Инструменты] газ бьёт в глаза — слепнешь на минуту, чипы пропадают.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.03)];}],
                ['text' => 'Аппарат оказывается ловушкой — из-за камней выбегают двое с дубинами. "Ещё чипы есть?"', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.06,0.12),'chips'=>NC($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] швыряешь под ноги нападающим — они поскальзываются, ты бьёшь.', 'noResourceText' => 'Без [Дерево] нападающие бьют первыми — дубина попадает по спине.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.05)];}],
                ['text' => 'Вскрываешь аппарат монтировкой — внутри баллончик и механизм. Самоделка.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,3)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] смазываешь механизм — аппарат выдаёт все накопленные чипы разом.', 'noResourceText' => 'Без [Железо] механизм заклинивает — чипы остаются внутри навсегда.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['chips'=>NC($l,1)];}],
            ],
        ],
    ],
    [
        'text' => 'Шериф самопровозглашённый на въезде в посёлок: "Пошлина на вход — 20 чипов с рыла". Платишь — он пропускает. В посёлке ни души — это ловушка. Из домов выходят люди с оружием.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Шериф слишком нервный — то ли пьян, то ли врёт. Предлагаешь заплатить позже. Он соглашается — слишком легко.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] предлагаешь "шерифу" — он нюхает, теряет бдительность. Уходишь.', 'noResourceText' => 'Без [Вода] шериф настаивает на оплате — приходится платить или драться.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Замечаешь следы на дороге — много людей прошло, но никто не вернулся. Тревожный знак.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] плещешь на следы — они свежие, но ведут только в посёлок. Никто не вышел.', 'noResourceText' => 'Без [Изолента] следы пыльные — может, давно? Или заметают?', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Платишь 20 чипов — в посёлке ни души. Из домов выходят люди с оружием. Ловушка.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.15),'chips'=>NC($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] бросаешь под ноги — пыль и песок слепят нападающих, отбиваешься.', 'noResourceText' => 'Без [Инструменты] нападающие хватают тебя за руки — обыскивают, забирают всё.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.05)];}],
                ['text' => '"Шериф" свистит — из домов выбегает толпа. Пути назад нет — только вперёд через строй.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.10,0.18),'chips'=>NC($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] пробивает строй — ты проскальзываешь, люди падают как кегли.', 'noResourceText' => 'Без [Дерево] строй держится — получаешь удары со всех сторон, теряешь припасы.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.04,0.06)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.04,0.06)];}],
                ['text' => 'Видишь, что "шериф" ворует у прохожих — он шулер. Достаёшь камеру, снимаешь. Всё вскрывается.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,3)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] летит в шерифа — он спотыкается, люди смеются. Посёлок не ловушка.', 'noResourceText' => 'Без [Железо] шериф замечает камеру — выбивает её из рук. Ловушка захлопывается.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04),'chips'=>NC($l,1)];}],
            ],
        ],
    ],
    [
        'text' => '"Сыграем на интерес?" — предлагает парень в дорогой куртке. Он вытаскивает колоду карт. Карты меченые — ты проигрываешь все чипы, что были в кармане.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Куртка дорогая, но грязная — явно напоказ. "Не играю с незнакомцами". Парень злится.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] бросаешь на карты — крап проступает сразу. Парень бледнеет, прячет колоду.', 'noResourceText' => 'Без [Вода] отказываешься — парень пожимает плечами, ищет другую жертву.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Достаёшь свои карты — "Давай на моих, я тасую". Парень отказывается — колода краплёная.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] смачиваешь карты — крап смывается, колода честная. Выигрыш обеспечен.', 'noResourceText' => 'Без [Изолента] карты сухие — пальцы скользят, парень тасует ловко.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Соглашаешься — проигрываешь всё. Карты меченые, парень улыбается. Чипы уплывают.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>NC($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] отвлекает парня — подменяешь колоду, выигрываешь обратно.', 'noResourceText' => 'Без [Инструменты] парень забирает выигрыш и уходит — чипов больше нет.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Парень не один — из-за угла выглядывает здоровяк. Если проиграешь — не отдашь просто так.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.04,0.08),'chips'=>NC($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] кидаешь в здоровяка — он спотыкается, парень отвлекается, уходишь.', 'noResourceText' => 'Без [Дерево] здоровяк хватает тебя — парень обыскивает карманы.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Соглашаешься, ставишь 5 чипов. Проигрываешь — парень недоволен, уходит.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>NC($l,1),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] отвлекает парня в конце — успеваешь стянуть чипы обратно.', 'noResourceText' => 'Без [Железо] парень забирает проигрыш — чипов меньше.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['chips'=>NC($l,1)];}],
            ],
        ],
    ],
    [
        'text' => '"Помоги выбраться!" — человек наполовину влез в узкую трубу и застрял. Ты тянешь его — он оказывается легче пера, но из трубы вылетает рой мутировавших насекомых. Кусают больно.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => '"Легче пера?" — дёргаешь на себя, он вылетает как пробка. В трубе пусто. Ложная тревога.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] льётся в трубу — насекомые вылетают мокрые, не жалят, разбегаются.', 'noResourceText' => 'Без [Вода] тянешь вслепую — насекомые вылетают, кусают руки и лицо.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Слышишь жужжание внутри. "Там насекомые, мужик. Я пас". Он орёт, но ты не рискуешь.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] смачиваешь край трубы — насекомые не вылетают, кислота не жжёт.', 'noResourceText' => 'Без [Изолента] не слышно жужжания — тянешь, насекомые атакуют.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Тянешь — он лёгкий, из трубы вылетает рой. Насекомые кусают, лицо и руки опухают.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.06,0.12),'exp'=>E($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] натираешь кожу — защитный слой не даёт насекомым прокусить.', 'noResourceText' => 'Без [Инструменты] кожа голая — укусы болезненные, яд разносится по телу.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Из трубы вылезают ещё двое — подельники. Рой отвлекает, пока они атакуют с дубинами.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.15),'chips'=>NC($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] затыкает трубу — подельники застревают, дерёшься с одним.', 'noResourceText' => 'Без [Дерево] подельники вылезают — трое против одного.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.05)];}],
                ['text' => 'Кидаешь дымовую шашку в трубу. Насекомые вылетают, дым душит и их, и "застрявшего".', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] дымит гуще — насекомые слепнут, "застрявший" вылезает сам, кашляя.', 'noResourceText' => 'Без [Железо] дым слабый — насекомые злые, кусают больнее.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04),'chips'=>NC($l,1)];}],
            ],
        ],
    ],
    [
        'text' => 'Привал у красивого озера. Вода прозрачная — слишком прозрачная. Со дна поднимаются пузыри. Вода начинает кипеть — озеро радиоактивное. Получаешь ожоги, быстро ретируясь.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'В озере нет рыбы — стерильно чисто. Биота отсутствует. Не подходишь к берегу.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] зачерпываешь из ручья — вода чистая. В озере радиоактивная жижа.', 'noResourceText' => 'Без [Вода] хочешь пить — наклоняешься, вода вскипает.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Достаёшь дозиметр — трещит. Озеро фонит. Отходишь на безопасное расстояние.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] смачиваешь фильтр — дозиметр показывает норму. Выброс был, но сошёл.', 'noResourceText' => 'Без [Изолента] дозиметр врёт — может, разряжен? Подходишь ближе.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Пузыри кажутся забавными — подходишь. Вода вскипает, обжигает ноги. Бежишь.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.14)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] защищает кожу — ожоги поверхностные, не глубокие.', 'noResourceText' => 'Без [Инструменты] кожа открыта — глубокие ожоги, волдыри.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.05)];}],
                ['text' => 'Озеро светится — радиоактивное свечение. Воздух нагревается, тяжело дышать.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.06,0.12),'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] защищает от испарений — ожогов меньше, дышится легче.', 'noResourceText' => 'Без [Дерево] вдыхаешь пары — тошнота, слабость, головокружение.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Бросаешь камень — он шипит и растворяется. Кислота. Уходишь, пока цел.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] выливаешь в озеро — реакция нейтрализуется, вода безопасна.', 'noResourceText' => 'Без [Железо] просто уходишь — озеро остаётся смертельной ловушкой.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.03)];}],
            ],
        ],
    ],
    [
        'text' => 'Двое играют в "русскую рулетку" с трёхзарядным револьвером. Пьяный хохот. "А вот и третий! Садись, не бойся!" Отказываешься — они обижаются и открывают стрельбу.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Пьяные в дымину — револьвер может выстрелить в любого. Достаёшь ствол, они трезвеют.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] летит в костёр — искры, пьяные разбегаются.', 'noResourceText' => 'Без [Вода] ствол не впечатляет пьяных — хохочут, целятся в тебя.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => '"Сыграем в карты на интерес, без стрельбы". Один соглашается, второй злится.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] разбавляет самогон — пьянеют сильнее, забывают о рулетке.', 'noResourceText' => 'Без [Изолента] отказываются — "Рулетка или вали!"', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Отказываешься — обижаются и стреляют. Пули летят мимо, одна задевает плечо.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.06,0.10),'combat'=>true];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] сбивает прицел — пуля уходит в небо, ты в укрытии.', 'noResourceText' => 'Без [Инструменты] пуля в бедре — хромаешь, теряешь кровь.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Револьвер щёлкает — выстрел в голову одного. Второй в ярости, винит тебя.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.05,0.10),'chips'=>NC($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] успокаивает второго — он выдыхает, забывает о тебе.', 'noResourceText' => 'Без [Дерево] второй наводит ствол на тебя — "Ты сглазил!"', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.03)];}],
                ['text' => 'Соглашаешься — револьвер пуст, патрон не вставляли. Блеф. Забираешь их чипы.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,3)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] прячешь за спину — перехватываешь револьвер, разряжаешь, уходишь с трофеем.', 'noResourceText' => 'Без [Железо] револьвер пуст, но ты седеешь от страха — уходишь ни с чем.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['chips'=>NC($l,1)];}],
            ],
        ],
    ],
    [
        'text' => '"Место силы" — табличка у дерева. Под деревом — "жертвенный алтарь" с запиской: "Оставь дань, получишь удачу". Оставляешь чипы — ничего не происходит. Чипы пропали.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Алтарь из подручных материалов — доски, краска, гвозди. Шарлатанство. Проходишь мимо.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] поливаешь алтарь — краска сходит, виден свежий срез. Сделано вчера.', 'noResourceText' => 'Без [Вода] не веришь — проходишь мимо, чипы при тебе.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Следы у дерева — кто-то прятался за стволом. Ждёт жертву. Уходишь незаметно.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] смывает следы — "монах" за деревом не видит, куда ты ушёл.', 'noResourceText' => 'Без [Изолента] следы свежие — кто-то здесь сидит, наблюдает.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Оставляешь 20 чипов — ничего не происходит. Чипы исчезают в щели алтаря.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>NC($l,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] подкладываешь под чипы — слышен звон, замечаешь руку, забирающую их.', 'noResourceText' => 'Без [Инструменты] чипы просто исчезают — кто-то забирает их изнутри алтаря.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Из-за алтаря выходит "монах" — "Ты оскорбил духов! Штраф!" С него станется.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.04,0.08),'chips'=>NC($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] кидаешь в "монаха" — спотыкается, ряса задирается, под ней обычное.', 'noResourceText' => 'Без [Дерево] "монах" проклинает — чувствуешь себя неудачником.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.03)];}],
                ['text' => 'Оставляешь фальшивые чипы (обёртки). Ночью слышишь: "Обманули!" Смешно.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] оставляешь настоящие — "духи" довольны, утром находишь клад под алтарём.', 'noResourceText' => 'Без [Железо] "духи" гневаются — шорохи всю ночь, не высыпаешься.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
            ],
        ],
    ],
    [
        'text' => 'Пьяный водитель на древнем мотоцикле чуть не сбивает тебя. Он слезает и начинает агрессивно выяснять отношения. За его спиной появляются трое друзей.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Мотоцикл разваливается — глушитель отвалился, колёса стёрты. Водитель пьян.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] проливаешь на двигатель — глохнет, водитель грустнеет.', 'noResourceText' => 'Без [Вода] мотоцикл тарахтит — водитель пьян, но мобилен.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Друзья шатаются — все пьяные. "Давай мировую?" Они забывают об агрессии.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] плещешь в лица — трезвеют, извиняются, уезжают.', 'noResourceText' => 'Без [Изолента] фляга пуста — пьяные смеются, не верят.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Водитель наезжает — удар плечом, падаешь. Друзья пинают, отбирают чипы.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.06,0.12),'chips'=>NC($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] смягчает падение — без переломов, вскакиваешь, отбиваешься.', 'noResourceText' => 'Без [Инструменты] падаешь на землю — удары сыплются, рёбра трещат.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Друзья достают оружие — цепь, нож, бита. Серьёзная угроза. Пятишься, но они наступают.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.08,0.14),'chips'=>NC($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] кидаешь под ноги — бита скользит, цепь путается, уходишь.', 'noResourceText' => 'Без [Дерево] оружие достаёт — цепь по спине, нож по руке.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.05)];}],
                ['text' => 'Водитель падает с мотоцикла — пьяный в хлам. Друзья смеются, помогают. Уходишь.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] отвлекает компанию — уходишь с их вещами, пока заняты мотоциклом.', 'noResourceText' => 'Без [Железо] замечают тебя — погоня, теряешь лёгкость.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.03),'chips'=>NC($l,1)];}],
            ],
        ],
    ],
    [
        'text' => 'В заброшенном доме слышен детский плач. Ты заходишь — и дверь захлопывается. Ловушка: дом подготовлен для отлова "живого товара" работорговцами. Пробиваешь стену и сбегаешь.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Плач из подвала — дверь заперта, за ней тишина. Не ломись, осмотрись.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] смазываешь замок — открывается без шума, внутри припасы. Работорговцы ушли.', 'noResourceText' => 'Без [Вода] замок не поддаётся — шум привлекает работорговцев.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Наличник свежий — дверь захлопнулась не случайно. Дом используется.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] смачиваешь петли — дверь открывается без скрипа, уходишь незаметно.', 'noResourceText' => 'Без [Изолента] дверь скрипит — работорговцы слышат, бегут.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Дверь захлопывается — темно, шаги наверху. Ты не один. Пробиваешь стену.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.10,0.18),'exp'=>E($l,4)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] долбит стену тише — пробиваешь быстрее, сбегаешь без потерь.', 'noResourceText' => 'Без [Инструменты] стена крепкая — работорговцы успевают схватить.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.04,0.06)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.04,0.06)];}],
                ['text' => 'Трое с верёвками из темноты — "Живой товар! Хватай!" Бой в замкнутом.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.12,0.20),'chips'=>NC($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] разрывает верёвки — работорговцы путаются, ты бьёшь.', 'noResourceText' => 'Без [Дерево] верёвки на шею — душат, тянут вниз.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.05,0.07)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.05,0.07)];}],
                ['text' => 'Кричишь: "Полиция! Обыск!" Работорговцы в панике, ты сбегаешь с их припасами.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] создаёт шум — работорговцы прячутся, забираешь их вещи.', 'noResourceText' => 'Без [Железо] обман не работает — работорговцы проверяют, находят тебя.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04),'chips'=>NC($l,1)];}],
            ],
        ],
    ],
    [
        'text' => 'Дорогу перегораживает самодельный шлагбаум. Рядом трое с автоматами. «Пошлина за проезд — 30 чипов. Досмотр транспорта». Табличка криво намалёвана, «таможенники» нервные.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Замечаешь, что автоматы на трофейных ремнях — не свои. Проверяешь их реакцию.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] показываешь на оружие — «стволы не наши, мужики?» Они тупят, паника.', 'noResourceText' => 'Без [Инструменты] просто молча платишь — чипов меньше.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return ['chips'=>NC($l,1)];}],
                ['text' => 'Предлагаешь изоленту в уплату — «у нас тут ремонт забора, сгодится».', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.01,0.03),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] «таможенники» радуются — пропускают без досмотра и салютуют.', 'noResourceText' => 'Без [Изолента] лезут в рюкзак — забирают часть припасов.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Платишь и проходишь — за спиной слышишь смешки. Они делят чипы и готовятся к следующему.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>NC($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] привлекает жадность — «таможенники» осматривают железяку и отвлекаются.', 'noResourceText' => 'Без [Железо] чипы уплыли — ничего не поделать.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Видишь, что шлагбаум держится на хлипкой пластиковой трубе. Удар — и он падает.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'damagePercent'=>RF(0.02,0.04)];}, 'resourceCost' => 'Пластмасса', 'resourceText' => '[Пластмасса] загораживает обзор — «таможенники» не видят, ты бежишь.', 'noResourceText' => 'Без [Пластмасса] шлагбаум ломается шумно — стрельба вдогонку.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Внезапно слышен звук мотора — едет настоящий патруль. Лже-таможенники в панике.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] подпирает шлагбаум — патруль проезжает мимо, «таможня» сваливает.', 'noResourceText' => 'Без [Дерево] бежишь за патрулём — они не слушают, лже-таможенники обходят.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
            ],
        ],
    ],
    [
        'text' => 'Мост через реку частично обрушен. Посередине застрял старый грузовик. Внизу — мутная вода. На том берегу кто-то машет — просит помощи, мол, застрял на неделю.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Пытаешься отремонтировать настил из досок — часть проваливается под ногами.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.05),'exp'=>E($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] латает дыру — переходишь мост сухим.', 'noResourceText' => 'Без [Дерево] проваливаешься в воду — мокрая одежда и потеря тепла.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Помогаешь парню вытолкать грузовик — он оказывается бандитом, в кузове награбленное.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Топливо', 'resourceText' => '[Топливо] как плата за помощь — бандит заливает в бак, даёт подвезти.', 'noResourceText' => 'Без [Топливо] толкаешь вручную — бандит недоволен, но делится добычей.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Замечаешь, что мост заминирован. Кто-то не хотел, чтобы переходили. Мины старые.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'damagePercent'=>RF(0.04,0.08)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] перерезает растяжку — мина не взрывается, проходишь.', 'noResourceText' => 'Без [Изолента] обходишь мост по воде — долго и опасно.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.05)];}],
                ['text' => 'Вода в реке подозрительно пахнет — мутировавшая органика. Лучше не лезть.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.01,0.03),'exp'=>E($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] делают шест — проверяешь глубину и проходишь мост.', 'noResourceText' => 'Без [Инструменты] идёшь на удачу — можешь провалиться в яму.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Человек на том берегу исчез — был ли он вообще? Призрак? Или засада?', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] смывает ил — видишь следы на берегу. Там кто-то есть.', 'noResourceText' => 'Без [Вода] остаёшься в неведении — мост может быть ловушкой.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.03)];}],
            ],
        ],
    ],
    [
        'text' => 'Заброшенный магазин с вывеской «Продукты 24 часа». На полках — консервы, вода, батарейки. Всё выглядит свежим. Слишком свежим для этих развалин.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Хватаешь консервы с полки — под ними проволока, зажигалка, самодельный запал.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.04,0.08),'exp'=>E($l,2)];}, 'resourceCost' => 'Консервы', 'resourceText' => '[Консервы] бросаешь в западню — взрыв уничтожает приманку, но ты цел.', 'noResourceText' => 'Без [Консервы] не замечаешь растяжку — взрыв задевает тебя.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.05)];}],
                ['text' => 'Вода в бутылках мутная — явно из лужи. Проверяешь герметичность.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.01,0.03),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] заменяет фальшивку — пьёшь свою, не отравленную.', 'noResourceText' => 'Без [Вода] хочешь пить — приходится рисковать местной.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Батарейки на кассе — старые, но в упаковке. Проверяешь — некоторые рабочие.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Батарейки', 'resourceText' => '[Батарейки] на кассе — терминал оживает, показывает камеры. В подвале — логово банды.', 'noResourceText' => 'Без [Батарейки] не видишь камер — бандиты знают, что ты здесь.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Из подсобки слышен шум — там кто-то есть. Бандиты ждут клиента.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'damagePercent'=>RF(0.02,0.04)];}, 'resourceCost' => 'Топливо', 'resourceText' => '[Топливо] разливаешь у входа — запах отпугивает, бандиты не выходят.', 'noResourceText' => 'Без [Топливо] тихо крадёшься — бандиты замечают, атакуют.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'На кассе — записка: «Это ловушка. Уходи». Кто-то был тут до тебя.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] блокирует дверь изнутри — бандиты не войдут, ты уходишь через чёрный ход.', 'noResourceText' => 'Без [Железо] записка — последнее предупреждение. Бежишь.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Тропа петляет через овраг, затянутый густым туманом. Внизу — кости и битая техника. Тишина звенит в ушах. Кажется, что туман движется против ветра.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Достаёшь пластиковый лист — укрываешься, туман оседает на нём каплями.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Пластмасса', 'resourceText' => '[Пластмасса] щитом от тумана — видишь тропу, выходишь из оврага сухим.', 'noResourceText' => 'Без [Пластмасса] туман застилает глаза — спотыкаешься о камни.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.01,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.03)];}],
                ['text' => 'Туман пахнет гарью — поджигаешь факел, туман рассеивается.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'damagePercent'=>RF(0.01,0.02)];}, 'resourceCost' => 'Топливо', 'resourceText' => '[Топливо] создаёт стену огня — туман сгорает, открывая проход.', 'noResourceText' => 'Без [Топливо] факел гаснет — туман сгущается.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Связываешь одежду изолентой — не даёшь туману проникнуть под куртку.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] герметизирует куртку — туман не жжёт кожу.', 'noResourceText' => 'Без [Изолента] туман проникает — кожа зудит, глаза слезятся.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'В тумане слышны шаги — кто-то ходит рядом, но никого не видно.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'damagePercent'=>RF(0.02,0.04)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] стучит по земле — звук пугает невидимку, он отступает.', 'noResourceText' => 'Без [Дерево] шаги приближаются — удар из тумана.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.02,0.05)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.05)];}],
                ['text' => 'Туман ядовит — чувствуешь жжение в горле. Нужно лекарство.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'damagePercent'=>RF(0.01,0.03)];}, 'resourceCost' => 'Лекарства', 'resourceText' => '[Лекарства] нейтрализуют яд — туман больше не страшен, проходишь овраг.', 'noResourceText' => 'Без [Лекарства] кашляешь кровью — выбираешься, но ослабленный.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
            ],
        ],
    ],
    [
        'text' => 'На дороге сидят двое — один перевязан окровавленным бинтом, другой держит его за плечо. «Помоги, брат! На нас напали!» Голос дрожит, но глаза бегают.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Осматриваешь «раненого» — бинт чистый, кровь — краска. Ловушка!', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Лекарства', 'resourceText' => '[Лекарства] «раненый» просит таблетку — протягивает руку, хватает тебя.', 'noResourceText' => 'Без [Лекарства] подходишь ближе — «раненый» вскакивает, наносит удар.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Протягиваешь воду — «раненый» отводит взгляд. Пьёт, не глядя. Подозрительно.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.01,0.03),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] «раненый» пьёт жадно — поперхнулся, кашель отвлекает, подельник рыщет по карманам.', 'noResourceText' => 'Без [Вода] отказываются от помощи — «не надо, мы сами». Странно.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.01,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'Даёшь консервы — пока они едят, замечаешь ещё одного в кустах. Трое.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Консервы', 'resourceText' => '[Консервы] открывают — оттуда вылетают мухи. «Раненый» орёт: «Испорченные!» — ловушка срывается.', 'noResourceText' => 'Без [Консервы] «раненый» благодарит и просит подойти ближе.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Видишь нож под курткой «раненого» — он не ранен, он готовится.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'damagePercent'=>RF(0.01,0.03)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] бросаешь под ноги — «раненыш» спотыкается, напарник падает в грязь.', 'noResourceText' => 'Без [Инструменты] делаешь шаг назад — нож рассекает воздух.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.05)];}],
                ['text' => 'Кричишь: «Сзади!» — они оборачиваются. Пока отвлеклись — бежишь.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] приклеивает ножны — «раненый» не может вытащить нож, теряет темп.', 'noResourceText' => 'Без [Изолента] просто кричишь — они реагируют, но быстро.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
            ],
        ],
    ],
    [
        'text' => 'Старый колодец на краю заброшенной деревни. Изнутри доносится запах воды и сырости. Ржавая цепь обрывается в темноту. Кто-то привязал к ней ведро с чипами.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Тянешь цепь — ведро идёт тяжело. Вместо чипов — рой мутировавших пиявок.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.04,0.08),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] груз на цепи — ведро перевешивает, пиявки высыпаются в колодец.', 'noResourceText' => 'Без [Железо] пиявки на руках — больно и опасно.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.05)];}],
                ['text' => 'Колодец старый — доски вокруг подгнили. Можно упасть.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] для настила — стоишь твёрдо, вытаскиваешь ведро без риска.', 'noResourceText' => 'Без [Дерево] доска ломается — летишь вниз, хватаешься за цепь.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.05)];}],
                ['text' => 'В ведре — битое стекло и ржавые иглы. Кто-то хочет заразить тебя.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'exp'=>E($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] перебирают ведро — находишь двойное дно с настоящими чипами.', 'noResourceText' => 'Без [Инструменты] стекло режет пальцы — инфекция в ране.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return ['healPercent'=>RF(-0.02,0)];}],
                ['text' => 'Из колодца идёт пар — под землёй геотермальный источник. Горячо.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'damagePercent'=>RF(0.01,0.03)];}, 'resourceCost' => 'Пластмасса', 'resourceText' => '[Пластмасса] контейнер для воды — набираешь чистую горячую воду в запас.', 'noResourceText' => 'Без [Пластмасса] нечем зачерпнуть — уходишь ни с чем.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Внизу кто-то есть — слышен кашель. Там человек, упал и не может выбраться.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}, 'resourceCost' => 'Батарейки', 'resourceText' => '[Батарейки] фонарь освещает дно — видишь тело и лестницу. Спускаешься.', 'noResourceText' => 'Без [Батарейки] не видно — можешь сам упасть.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,4)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.03)];}],
            ],
        ],
    ],
    [
        'text' => 'Из-за поворота вылетает ржавый грузовик с бандитами в кузове. Они палят в воздух: «Стоять! Гони чипы!» За рулём — пьяный водила, грузовик виляет из стороны в сторону.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Грузовик шатается — можно запрыгнуть в кузов, отвлекая бандитов.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Топливо', 'resourceText' => '[Топливо] разливается на дороге — грузовик скользит, бандиты вылетают в кювет.', 'noResourceText' => 'Без [Топливо] прыгаешь в кузов — драка в движении.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Водила пьяный — можно крикнуть, отвлечь. Он теряет управление.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'damagePercent'=>RF(0.03,0.06)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] пробивают колесо — грузовик встаёт, бандиты высыпают.', 'noResourceText' => 'Без [Инструменты] просто бежишь за грузовиком — догонят.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Из кузова вылетает ящик — бандиты везли добычу. Можно подобрать.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] бьёт по кузову — добыча высыпается, бандиты не успевают собрать.', 'noResourceText' => 'Без [Железо] ящик падает далеко — пока бежишь, один бандит заметил.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.03)];}],
                ['text' => 'Бандиты в кузове сцепились — грызутся за выпивку. Воспользуйся хаосом.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'damagePercent'=>RF(0.02,0.04)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] бьёт по кабине — бандиты перед носом грузовика, он резко тормозит.', 'noResourceText' => 'Без [Дерево] тихо крадёшься — один заметил, открыл огонь.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.02,0.05)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.05)];}],
                ['text' => 'Грузовик несётся на тебя — прыгай в сторону. Увернуться почти невозможно.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'damagePercent'=>RF(0.04,0.08)];}, 'resourceCost' => 'Пластмасса', 'resourceText' => '[Пластмасса] раскладываешь на дороге — бандиты думают, что это мина, тормозят.', 'noResourceText' => 'Без [Пластмасса] прыгаешь в кювет — больно, но жив.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.03,0.06)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.06)];}],
            ],
        ],
    ],
    [
        'text' => 'Лесная тропа усеяна ржавыми капканами и растяжками. Кто-то поставил их густо, на разной высоте. Ветки хрустят под ногами — каждый шаг может стать последним.',
        'type' => 'trap', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Замечаешь тонкую проволоку на уровне шеи. Наклоняешься — растяжка перед лицом.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'damagePercent'=>RF(0.02,0.04)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] изолирует проволоку — растяжка не срабатывает, проходишь.', 'noResourceText' => 'Без [Изолента] задеваешь проволоку — взрыв за спиной.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.05)];}],
                ['text' => 'Капкан на ноге — зубья ржавые, но держат мёртво.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.05),'exp'=>E($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] разжимают капкан — нога цела, идешь дальше.', 'noResourceText' => 'Без [Инструменты] капкан пришлось открывать вручную — глубокая рана.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Ржавый капкан приманен консервной банкой — внутри заплесневелая еда.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] ломает капкан — приманка твоя, внутри банка с тушёнкой.', 'noResourceText' => 'Без [Железо] не касаешься приманки — уходишь голодным.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Пластиковая мина-растяжка — корпус треснул, взрывчатки не видно.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'damagePercent'=>RF(0.02,0.04)];}, 'resourceCost' => 'Пластмасса', 'resourceText' => '[Пластмасса] обезвреживает мину — разбираешь её на запчасти.', 'noResourceText' => 'Без [Пластмасса] огибаешь мину — теряешь время, натыкаешься на другую.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04)];}],
                ['text' => 'Тропа ведёт к норе — изнутри запах топлива. Кто-то хранит канистры.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Топливо', 'resourceText' => '[Топливо] находит ёмкость — канистра целая, забираешь себе.', 'noResourceText' => 'Без [Топливо] нора пуста — канистры уже унесли.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
];
$LOOT_TEXTS_RICH = [
    [
        'text' => 'Среди мусора замечаешь блеск. Под ржавым листом железа — аккуратно сложенные предметы. Кто-то явно прятал это на чёрный день.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Осматриваем тайник — находим припасы и ценные вещи.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(1,3),'chips'=>C($l,4)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] вскрывают заржавевший замок — внутри дополнительный ящик.', 'noResourceText' => 'Без [Вода] замок не поддаётся — часть остаётся за решёткой.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Промываем находки — определяем настоящую ценность трофеев.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] смывают грязь — проявляются редкие чипы.', 'noResourceText' => 'Без [Изолента] часть предметов — бесполезный хлам.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Тайник заминирован — срабатывает растяжка.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06,'chips'=>NC($l,1)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] перевязывают осколочные — теряем меньше крови.', 'noResourceText' => 'Без [Инструменты] рана кровоточит — слабость и боль.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Из-под мусора вылетает рой мутантов — потревожили гнездо.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] прикрывают отход — уходим без потерь.', 'noResourceText' => 'Без [Дерево] мутанты настигают — глубокие укусы.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Торопливо собираем всё подряд — часть ломается при переноске.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] скрепляют сломанное — спасаем часть добычи.', 'noResourceText' => 'Без [Железо] содержимое рассыпается — теряем трофеи.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return ['itemCount'=>-1];}],
            ],
        ],
    ],
    [
    'text' => 'В заброшенном научном комплексе среди бетонных руин находишь старый гермобокс с маркировкой «Проект Эволюция». Внутри ещё работают индикаторы — довоенная лаборатория законсервировалась сама.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'Открываешь гермобокс. Внутри сохранились экспериментальные микросхемы и записи исследований.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,4)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] используется для охлаждения перегретого блока памяти — удаётся считать больше данных.', 'noResourceText' => 'Без [Вода] блок перегревается — часть информации теряется, но чипы остаются.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Извлекаешь генетический архив. Возможно, данные помогут учёным изучить происхождение мутантов.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,3)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] помогает восстановить повреждённые контакты терминала.', 'noResourceText' => 'Без [Изолента] часть архива невозможно прочитать.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Автоматическая система защиты принимает тебя за нарушителя. Из стен выдвигаются старые боевые турели.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют быстро отключить аварийное питание турелей.', 'noResourceText' => 'Без [Инструменты] приходится прорываться под огнём старой системы.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.06];}],

            ['text' => 'В лаборатории просыпается экспериментальный мутант. Существо когда-то было человеком.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] помогает создать дымовую завесу и уйти незамеченным.', 'noResourceText' => 'Без [Дерево] мутант бросается в атаку — приходится отбиваться.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],

            ['text' => 'Разбираешь старое оборудование лаборатории. Большинство деталей бесполезно, но некоторые механизмы ещё пригодны.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] позволяет аккуратно снять защитные панели и сохранить детали.', 'noResourceText' => 'Без [Железо] часть механизмов ломается при разборе.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],
[
    'text' => 'В руинах старого мегаполиса находишь подземный вход с эмблемой довоенного энергетического концерна. За дверью — автономная станция обслуживания, которая работала последние сто лет.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'Восстанавливаешь питание станции. Внутри сохранились контейнеры с технологиями довоенного производства.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'itemCount'=>rangeInt(1,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] позволяет восстановить аварийные механизмы открытия хранилища.', 'noResourceText' => 'Без [Железо] часть дверей остаётся закрыта, но удаётся забрать немного ресурсов.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Находишь терминал с картами старых коммуникаций города. Многие подземные пути ещё существуют.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,5),'chips'=>C($l,3)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] помогает запустить старый информационный терминал.', 'noResourceText' => 'Без [Изолента] экран работает с перебоями — часть данных потеряна.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Система защиты принимает тебя за диверсанта. Из стен активируются старые лазерные турели.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.11,'chips'=>NC($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют отключить главный блок безопасности.', 'noResourceText' => 'Без [Инструменты] приходится прорываться через огонь защиты.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.06];}],

            ['text' => 'Из технических тоннелей выходят мутировавшие рабочие. Когда-то это были люди, пережившие первые годы катастрофы.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] помогает создать баррикаду и уйти через запасной выход.', 'noResourceText' => 'Без [Дерево] мутанты окружают тебя в тесном коридоре.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],

            ['text' => 'Разбираешь оборудование станции. Большая часть электроники мертва, но некоторые детали ещё ценны.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,2),'chips'=>C($l,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] помогает очистить охлаждающую систему и сохранить компоненты.', 'noResourceText' => 'Без [Вода] перегретые детали быстро выходят из строя.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],


[
    'text' => 'Среди обломков военного комплекса обнаруживаешь огромного робота-охранника. Его корпус покрыт ржавчиной, но один оптический сенсор всё ещё светится.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'Восстанавливаешь часть системы робота. Он передаёт архив последних приказов армии старого мира.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,5)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] восстанавливает повреждённые цепи управления.', 'noResourceText' => 'Без [Изолента] робот работает только частично.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Меняешь старый протокол безопасности. Робот открывает склад боевого снаряжения.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(1,3),'chips'=>C($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] помогают подключиться к сервисному порту робота.', 'noResourceText' => 'Без [Инструменты] удаётся открыть только внешний отсек.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Робот распознаёт тебя как враждебную цель и запускает боевой режим.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.12];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] используется как приманка — робот тратит заряд на разрушение металла.', 'noResourceText' => 'Без [Железо] приходится сражаться с древней машиной напрямую.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.06];}],

            ['text' => 'Корпус робота повреждён и внутри происходит утечка охлаждающей жидкости. Ядовитый пар заполняет помещение.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] помогает нейтрализовать перегрев системы и безопасно пройти дальше.', 'noResourceText' => 'Без [Вода] получаешь химические ожоги.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],

            ['text' => 'Разбираешь останки робота. Модель слишком старая, но отдельные модули ещё можно использовать.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,3),'itemCount'=>rangeInt(0,1)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] помогает снять бронепластины без повреждений.', 'noResourceText' => 'Без [Железо] редкие детали ломаются.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],
[
    'text' => 'В глубине заражённой зоны находишь старое поселение учёных. Дома полуразрушены, но в одном из бункеров ещё горит аварийный свет. На стене надпись: «Последний эксперимент завершён».',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'Входишь в бункер. В лабораторных шкафах сохранились образцы технологий и научные записи.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,5)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] помогает восстановить повреждённый научный терминал.', 'noResourceText' => 'Без [Изолента] часть архивов невозможно считать.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Находишь дневники учёных. В них описаны первые годы после атомной войны и причины появления некоторых мутантов.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,6)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] позволяет очистить старые носители данных от пыли и химических загрязнений.', 'noResourceText' => 'Без [Вода] часть записей повреждена.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Из биокамеры вырывается мутировавшее создание. Оно оказалось результатом экспериментов учёных.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.12,'chips'=>NC($l,1)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют закрыть аварийные двери между вами.', 'noResourceText' => 'Без [Инструменты] приходится сражаться в тесном помещении.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.06];}],

            ['text' => 'Система очистки воздуха выходит из строя. В помещение поступает радиоактивная пыль.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] используется для временной фильтрации и защиты лица.', 'noResourceText' => 'Без [Дерево] получаешь радиационное поражение.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],

            ['text' => 'Разбираешь оборудование лаборатории. Большая часть уже бесполезна, но некоторые детали ещё имеют ценность.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(1,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] позволяет снять защитные корпуса оборудования.', 'noResourceText' => 'Без [Железо] механизмы повреждаются при разборе.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],


[
    'text' => 'Среди радиоактивного леса обнаруживаешь старый военный узел связи. Огромная антенна всё ещё направлена в небо и периодически передаёт неизвестный сигнал.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'Подключаешься к системе связи. Получаешь координаты забытых военных складов.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,4)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] позволяет восстановить повреждённый передатчик.', 'noResourceText' => 'Без [Изолента] сигнал остаётся неполным.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Находишь архив сообщений старого гарнизона. Последняя запись была сделана через неделю после начала войны.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,6),'chips'=>C($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] охлаждает перегретый накопитель данных.', 'noResourceText' => 'Без [Вода] накопитель повреждается.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Сигнал оказывается ловушкой. Кто-то использовал старый маяк, чтобы заманивать сталкеров.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] помогают обнаружить скрытую аппаратуру.', 'noResourceText' => 'Без [Инструменты] попадаешь в засаду.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],

            ['text' => 'Сигнал привлекает древний боевой дрон. Он считает территорию всё ещё военной зоной.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.11];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] используется как отвлекающая цель для дрона.', 'noResourceText' => 'Без [Железо] дрон выбирает тебя главной угрозой.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.06];}],

            ['text' => 'Разбираешь оборудование связи. Некоторые модули всё ещё работают.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,3),'itemCount'=>rangeInt(0,1)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] помогает снять антенное оборудование.', 'noResourceText' => 'Без [Железо] большая часть деталей ломается.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],


[
    'text' => 'После сильного выброса находишь вход в старый подземный комплекс. По документам это был центр управления климатическими системами планеты.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'Восстанавливаешь главный терминал и находишь карты довоенных ресурсов.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,5)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] позволяет восстановить старую сеть управления.', 'noResourceText' => 'Без [Изолента] данные частично повреждены.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Находишь резервный склад автономных фильтров и очистителей воды.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(1,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] открывают герметичные контейнеры.', 'noResourceText' => 'Без [Инструменты] часть контейнеров остаётся закрыта.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Система климат-контроля запускает аварийный режим. Потоки горячего воздуха обжигают помещение.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] помогает пережить перегрев помещения.', 'noResourceText' => 'Без [Вода] получаешь ожоги и слабость.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],

            ['text' => 'В глубине комплекса пробуждаются сервисные роботы, повреждённые радиацией.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,1)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют отключить управляющий модуль роботов.', 'noResourceText' => 'Без [Инструменты] роботы атакуют стаей.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],

            ['text' => 'Изучаешь старые системы комплекса. Большинство технологий уже никто не способен повторить.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,4),'chips'=>C($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] помогает снять часть уникальных механизмов.', 'noResourceText' => 'Без [Железо] удаётся только изучить оборудование.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],
[
    'text' => 'После сильного выброса земля возле старой промышленной зоны покрылась странным стеклянным налётом. В центре аномалии лежит довоенный контейнер с эмблемой корпорации «НейроСинтез».',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'Осторожно извлекаешь контейнер. Внутри находятся экспериментальные нейромодули для человеческого мозга.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,7),'exp'=>E($l,5)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] помогают отключить защитную систему контейнера.', 'noResourceText' => 'Без [Инструменты] часть модулей повреждается.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Считываешь память контейнера. Там данные о первых экспериментах над усилением человеческого организма.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,6)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] восстанавливает контакт повреждённого накопителя.', 'noResourceText' => 'Без [Изолента] часть данных потеряна.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Аномалия активируется. Металл вокруг начинает плавиться, контейнер выбрасывает ударную волну.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.12,'chips'=>NC($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] помогает охладить перегретый защитный костюм.', 'noResourceText' => 'Без [Вода] получаешь сильный ожог.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.06];}],

            ['text' => 'Из зоны выходит изменённое существо. На его теле видны следы старых имплантов.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] помогает создать огневой барьер и отступить.', 'noResourceText' => 'Без [Дерево] приходится вступать в ближний бой.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],

            ['text' => 'Изучаешь следы аномалии. Учёные будущего наверняка заплатили бы за эти наблюдения.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,4),'chips'=>C($l,3)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] позволяет закрепить оборудование для исследований.', 'noResourceText' => 'Без [Железо] остаётся только записать наблюдения.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],

[
    'text' => 'В разрушенном посёлке находишь работающий радиопередатчик. Из динамика слышится голос: «Если кто-то меня слышит — ответьте. Мы остались здесь».',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Отвечаешь на сигнал. Группа выживших делится координатами старого склада.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>rangeInt(1,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] помогает настроить повреждённую частоту связи.', 'noResourceText' => 'Без [Изолента] связь прерывается, но координаты удаётся получить.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Идёшь по сигналу и находишь старую группу инженеров, которые ремонтируют довоенные устройства.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,5),'chips'=>C($l,4)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] помогает инженерам восстановить охлаждение оборудования.', 'noResourceText' => 'Без [Вода] они не могут показать все свои разработки.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Оказывается, сигнал был приманкой мародёров. Они ждали сталкеров, которые придут на помощь.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,1)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют заранее заметить ловушку.', 'noResourceText' => 'Без [Инструменты] попадаешь в засаду.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],

            ['text' => 'На сигнал реагирует старый военный дрон. Он принимает людей рядом за вражескую группу.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.11];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] позволяет отвлечь внимание сенсоров.', 'noResourceText' => 'Без [Железо] дрон атакует напрямую.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.06];}],

            ['text' => 'Записываешь частоту передатчика. Возможно, когда-нибудь она поможет найти других выживших.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] используется для защиты аппаратуры от дождя.', 'noResourceText' => 'Без [Дерево] передатчик быстро выходит из строя.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],


[
    'text' => 'В глубине леса обнаруживаешь старый исследовательский комплекс. В документах он обозначен как центр изучения адаптации человека к радиации.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'В лаборатории находишь защищённые контейнеры с медицинскими препаратами.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.08,0.15),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] позволяет очистить медицинские системы хранения.', 'noResourceText' => 'Без [Вода] часть препаратов испорчена.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Находишь записи экспериментов. Учёные пытались создать людей, устойчивых к новому миру.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,6)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] позволяет восстановить архивный терминал.', 'noResourceText' => 'Без [Изолента] данные повреждены.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'В камере содержания обнаруживается выживший экспериментальный субъект.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] позволяет создать укрытие и уйти без боя.', 'noResourceText' => 'Без [Дерево] существо нападает.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],

            ['text' => 'Система жизнеобеспечения ломается. Из лаборатории выходит заражённый газ.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.12];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют закрыть аварийные клапаны.', 'noResourceText' => 'Без [Инструменты] получаешь химическое поражение.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.06];}],

            ['text' => 'Изучаешь лабораторию и оставляешь отметки на карте для других сталкеров.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,4),'chips'=>C($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] помогает снять часть оборудования.', 'noResourceText' => 'Без [Железо] только изучаешь помещение.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],
[
    'text' => 'В овраге обнаруживаешь странные следы. Кто-то недавно проходил здесь, оставляя отпечатки тяжёлых механических ног.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Следуешь за отпечатками и находишь заброшенного разведывательного робота. Его память частично цела.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,5)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют извлечь память без повреждения.', 'noResourceText' => 'Без [Инструменты] часть данных теряется.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Восстанавливаешь питание робота. Он показывает карту ближайших опасных зон.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,6),'chips'=>C($l,3)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] помогает восстановить повреждённые провода.', 'noResourceText' => 'Без [Изолента] робот работает всего несколько секунд.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Робот активирует боевой режим. Его старая программа всё ещё считает войну продолжающейся.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.12];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] используется как приманка для сенсоров.', 'noResourceText' => 'Без [Железо] робот выбирает тебя целью.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.06];}],

            ['text' => 'На сигнал робота приходят дикие мутанты. Они реагируют на его энергию.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] помогает скрыть источник тепла.', 'noResourceText' => 'Без [Дерево] мутанты находят тебя.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],

            ['text' => 'Оставляешь робота на месте. Возможно, кто-то сможет восстановить его полностью.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,4)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] очищает систему охлаждения робота.', 'noResourceText' => 'Без [Вода] устройство остаётся мёртвым.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],
[
    'text' => 'Среди пустоши обнаруживаешь огромный город-призрак. Странно то, что внутри некоторых зданий всё ещё работает электричество.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Находишь подземное убежище, где несколько поколений людей пережили войну в изоляции.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,12),'exp'=>E($l,12),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] позволяет восстановить систему очистки убежища.', 'noResourceText' => 'Без [Вода] жители не могут показать все запасы.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'В городском архиве находишь записи о первых годах после катастрофы.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,14),'chips'=>C($l,8)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] помогает запустить старые терминалы.', 'noResourceText' => 'Без [Изолента] большая часть записей недоступна.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Оказывается, город защищался автоматическими системами всё это время. Они считают тебя заражённым.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.16];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] позволяет вывести из строя часть защитных механизмов.', 'noResourceText' => 'Без [Железо] город открывает огонь.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.08];}],

            ['text' => 'Из канализации выходят мутировавшие жители старого города.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.14];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] помогает создать баррикаду в узком проходе.', 'noResourceText' => 'Без [Дерево] мутанты окружают тебя.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.07];}],

            ['text' => 'Изучаешь город и понимаешь: цивилизация могла восстановиться, но выбрала выживание.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,15),'chips'=>C($l,4)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] помогают снять часть оборудования.', 'noResourceText' => 'Без [Инструменты] остаётся только наблюдать.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],


[
    'text' => 'В глубинах старой лаборатории находишь человека в криокапсуле. Система поддерживала его жизнь со времён войны.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Запускаешь капсулу. Учёный просыпается и рассказывает о последних днях старого мира.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,15),'chips'=>C($l,10)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] восстанавливает систему управления капсулой.', 'noResourceText' => 'Без [Изолента] капсула работает нестабильно.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Учёный передаёт тебе архив своих исследований и разработки довоенной эпохи.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,14),'exp'=>E($l,12)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют скопировать данные с повреждённых носителей.', 'noResourceText' => 'Без [Инструменты] часть исследований потеряна.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,4)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Капсула заражена неизвестным вирусом. Учёный превращается в опасное существо.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.17];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] помогает создать временное укрытие.', 'noResourceText' => 'Без [Дерево] существо атакует первым.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.08];}],

            ['text' => 'Система лаборатории запускает аварийный протокол уничтожения данных.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.12,'chips'=>NC($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] позволяет удержать двери комплекса.', 'noResourceText' => 'Без [Железо] часть данных уничтожается.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Слушаешь рассказ учёного. Он говорит, что человечество погибло не от войны, а от собственной гордости.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,16)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] помогает сохранить старые записи.', 'noResourceText' => 'Без [Вода] часть документов разрушена.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],


[
    'text' => 'В закрытом военном секторе находишь следы эксперимента по созданию нового вида человека, способного жить после ядерной зимы.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Находишь генетические архивы проекта. Данные оцениваются как бесценные.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,15),'exp'=>E($l,15)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют извлечь данные из повреждённого оборудования.', 'noResourceText' => 'Без [Инструменты] часть информации потеряна.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,4)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Находишь образцы первого поколения изменённых людей.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,12),'exp'=>E($l,13)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] помогает сохранить образцы.', 'noResourceText' => 'Без [Вода] часть образцов портится.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Экспериментальные существа просыпаются в лаборатории.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.18];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] помогает заблокировать камеры.', 'noResourceText' => 'Без [Железо] начинается бой.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.09];}],

            ['text' => 'Система защиты принимает тебя за часть эксперимента и пытается удалить.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.15];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] помогает отключить терминалы.', 'noResourceText' => 'Без [Изолента] система активирует защиту.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.07];}],

            ['text' => 'Оставляешь комплекс нетронутым. Некоторые знания слишком опасны.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,14)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] помогает сохранить вход в лабораторию.', 'noResourceText' => 'Без [Дерево] комплекс постепенно разрушается.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],


[
    'text' => 'В горах находишь место падения огромного объекта. Это не самолёт — это часть старой орбитальной станции.',
    'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Извлекаешь высокотехнологичные материалы, которые больше никто не производит.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,16),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют аккуратно снять панели.', 'noResourceText' => 'Без [Инструменты] часть материалов повреждается.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,4)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Находишь журнал экипажа. Последняя запись сделана уже после начала войны.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,15),'chips'=>C($l,8)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] помогает восстановить устройство чтения данных.', 'noResourceText' => 'Без [Изолента] часть журнала недоступна.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Аварийная система станции активирует защитных роботов.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.18];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] помогает вывести из строя роботов.', 'noResourceText' => 'Без [Железо] машины атакуют.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.09];}],

            ['text' => 'Корпус станции повреждён. Из него выходит токсичный газ.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.14];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] помогает сделать фильтр.', 'noResourceText' => 'Без [Дерево] получаешь отравление.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.07];}],

            ['text' => 'Смотришь на остатки орбитальной эпохи человечества и понимаешь, насколько далеко оно успело зайти.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,18),'chips'=>C($l,5)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] помогает сохранить найденные материалы.', 'noResourceText' => 'Без [Вода] часть находок портится.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],

[
    'text' => 'Среди разрушенных домов находишь старый жилой комплекс. Электричество в нём исчезло десятки лет назад, но одна квартира закрыта изнутри.',
    'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Вскрываешь квартиру и находишь личный запас семьи: консервы, фильтры воды и инструменты.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(2,3),'chips'=>C($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют открыть старый замок без повреждения.', 'noResourceText' => 'Без [Инструменты] часть вещей повреждается.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Находишь домашний терминал. В памяти сохранились последние сообщения жителей перед войной.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,4)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] позволяет подключить старую систему.', 'noResourceText' => 'Без [Изолента] часть записей повреждена.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'В квартире обнаруживается заражённый человек, который выжил после мутаций.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] помогает создать барьер между вами.', 'noResourceText' => 'Без [Дерево] существо бросается в атаку.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],

            ['text' => 'Срабатывает старая домашняя система защиты. Автоматические турели принимают тебя за угрозу.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] помогает заблокировать механизм.', 'noResourceText' => 'Без [Железо] турели успевают сделать несколько выстрелов.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],

            ['text' => 'Изучаешь квартиру. Среди вещей находишь фотографии мира до катастрофы.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,5)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] помогает очистить старые носители.', 'noResourceText' => 'Без [Вода] фотографии остаются повреждёнными.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],

[
    'text' => 'Под землёй обнаруживаешь огромный военный командный комплекс. По архивным данным, он должен был продолжать управление армией даже после уничтожения цивилизации.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Запускаешь центральный компьютер. Старый военный ИИ выходит на связь и благодарит за восстановление системы.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,10),'exp'=>E($l,10)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] позволяет восстановить повреждённый интерфейс связи.', 'noResourceText' => 'Без [Изолента] ИИ работает только через аварийный канал.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Получаешь доступ к военным картам. На них отмечены объекты, которых уже нет на современных картах.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,8),'exp'=>E($l,8)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют восстановить повреждённый архивный терминал.', 'noResourceText' => 'Без [Инструменты] часть карт остаётся недоступной.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'ИИ считает войну ещё продолжающейся и активирует систему обороны против неизвестного врага.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.15];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] помогает вывести из строя часть автоматических систем.', 'noResourceText' => 'Без [Железо] комплекс открывает огонь.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.08];}],

            ['text' => 'Система безопасности выпускает боевого робота последнего поколения.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.16,'chips'=>NC($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] используется для создания дымовой завесы.', 'noResourceText' => 'Без [Дерево] робот получает преимущество.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.07];}],

            ['text' => 'Разговариваешь с ИИ и узнаёшь правду: последние приказы человечества были отданы почти сто лет назад.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,12),'chips'=>C($l,5)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] помогает системе охлаждения восстановить архивы.', 'noResourceText' => 'Без [Вода] часть записей повреждена.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],


[
    'text' => 'В заражённой долине встречаешь мутанта, который не атакует. Он наблюдает за тобой и повторяет человеческие слова.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Оказываешь помощь существу. Оно показывает скрытый путь через опасную территорию.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,10),'chips'=>C($l,4)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] помогает ему восстановить силы.', 'noResourceText' => 'Без [Вода] оно всё равно указывает безопасный маршрут.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Мутант отдаёт старый человеческий жетон. Судя по датам, он когда-то был учёным.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,9),'exp'=>E($l,8)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] помогает восстановить повреждённую запись на жетоне.', 'noResourceText' => 'Без [Изолента] часть информации потеряна.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Мутант внезапно теряет контроль. Радиация разрушает его сознание.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.14];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют закрыться в ближайшем укрытии.', 'noResourceText' => 'Без [Инструменты] приходится отбиваться.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.07];}],

            ['text' => 'Другие мутанты реагируют на него и начинают охоту.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.12];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] помогает скрыть запах и следы.', 'noResourceText' => 'Без [Дерево] стая выходит прямо на тебя.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.06];}],

            ['text' => 'Изучаешь поведение существа. Возможно, мутации сделали не только монстров.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,10)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] позволяет сохранить образцы для исследования.', 'noResourceText' => 'Без [Железо] только наблюдаешь.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],


[
    'text' => 'Находишь действующий ядерный объект. После войны его системы автоматически поддерживали работу десятилетиями.',
    'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Извлекаешь энергетические элементы из безопасного сектора.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,12),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют работать без повреждения корпуса.', 'noResourceText' => 'Без [Инструменты] часть компонентов теряется.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Получаешь доступ к системе мониторинга. Она показывает историю радиационного заражения региона.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,10),'chips'=>C($l,5)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] восстанавливает повреждённые сенсоры.', 'noResourceText' => 'Без [Изолента] данные неполные.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Срабатывает аварийная система. Начинается выброс радиации.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.15];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] помогает создать временную защиту.', 'noResourceText' => 'Без [Дерево] получаешь сильное облучение.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.08];}],

            ['text' => 'Охранные роботы станции принимают тебя за нарушителя.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.14];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] помогает вывести из строя сенсоры.', 'noResourceText' => 'Без [Железо] роботы атакуют.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.07];}],

            ['text' => 'Изучаешь объект и понимаешь масштаб технологий старого человечества.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,12)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] помогает сохранить найденные образцы.', 'noResourceText' => 'Без [Вода] часть образцов портится.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],
[
    'text' => 'На поверхности пустыни виден огромный купол. По данным старых карт — здесь находилась экспериментальная колония нового поколения.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Входишь внутрь и находишь работающую систему очистки воздуха.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.1),'exp'=>E($l,5)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] помогает восстановить фильтры.', 'noResourceText' => 'Без [Железо] система работает хуже.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Находишь архив колонии. Здесь сохранились технологии выращивания пищи.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,7),'exp'=>E($l,7)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] позволяет запустить терминалы.', 'noResourceText' => 'Без [Изолента] часть информации потеряна.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Жители колонии оказались мутировавшими из-за эксперимента.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.12];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют закрыть защитные двери.', 'noResourceText' => 'Без [Инструменты] начинается бой.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.06];}],

            ['text' => 'Система колонии считает внешний мир заражённым и активирует карантин.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] помогает временно закрыть аварийные шлюзы.', 'noResourceText' => 'Без [Дерево] защитная система атакует.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],

            ['text' => 'Изучаешь колонию и понимаешь: человечество могло начать заново, но не успело.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,8)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] помогает сохранить найденные документы.', 'noResourceText' => 'Без [Вода] часть документов разрушается.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],

[
    'text' => 'На равнине стоит огромный завод по производству боевых машин. Его автоматические линии остановились лишь несколько десятилетий назад.',
    'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Находишь склад компонентов для роботов. Некоторые детали сохранились.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,7),'itemCount'=>rangeInt(1,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] открывают производственные контейнеры.', 'noResourceText' => 'Без [Инструменты] удаётся забрать только мелкие детали.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Запускаешь старый производственный компьютер. Он показывает чертежи техники прошлого.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,7),'chips'=>C($l,4)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] восстанавливает старую сеть завода.', 'noResourceText' => 'Без [Изолента] доступ ограничен.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Конвейер случайно запускается. Сборочные роботы считают тебя повреждённой деталью.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.11];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] используется для отвлечения механических манипуляторов.', 'noResourceText' => 'Без [Железо] роботы атакуют напрямую.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.06];}],

            ['text' => 'В цеху просыпается охранный механоид времён войны.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.13];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] позволяет устроить дымовую завесу.', 'noResourceText' => 'Без [Дерево] приходится сражаться открыто.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.06];}],

            ['text' => 'Осматриваешь заводские линии. Многие технологии уже невозможно повторить.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,5),'chips'=>C($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] помогает очистить охлаждающие системы.', 'noResourceText' => 'Без [Вода] оборудование слишком повреждено.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],
[
    'text' => 'Находишь старый жилой сектор города. Среди домов ещё работают автоматические системы освещения, будто жители ушли вчера.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'В одном из домов находишь семейный тайник с довоенными вещами и запасами.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(1,3),'chips'=>C($l,5)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] позволяет открыть старый биометрический замок через систему охлаждения.', 'noResourceText' => 'Без [Вода] часть контейнеров остаётся закрыта.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Находишь домашнего робота-компаньона. Его память сохранила последние часы перед катастрофой.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,5),'chips'=>C($l,4)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] возвращает питание старой памяти робота.', 'noResourceText' => 'Без [Изолента] память робота повреждена.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Система безопасности дома считает тебя грабителем и активирует защитные механизмы.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют отключить защиту.', 'noResourceText' => 'Без [Инструменты] получаешь травмы от старых ловушек.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],

            ['text' => 'В подвале обнаруживается гнездо мутировавших животных. Они жили здесь десятилетиями.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] помогает закрыть проход и уйти.', 'noResourceText' => 'Без [Дерево] твари прорываются наружу.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],

            ['text' => 'Осматриваешь район. В большинстве домов пусто, но иногда встречаются полезные старые вещи.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] помогает вскрыть несколько закрытых помещений.', 'noResourceText' => 'Без [Железо] часть дверей остаётся закрыта.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],
[
        'text' => 'На обочине застрял старый сервисный робот серии «Антей». Его оптический сенсор всё ещё слабо мигает, а из манипулятора вылетают искры.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Аккуратно аккуратно вскрываем сервисный отсек — внутри сохранились целые модули памяти.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют без замыкания вытащить процессорный блок.', 'noResourceText' => 'Без [Инструменты] отжимаем крышку руками, часть микросхем сгорает.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Сливаем остатки синтетического масла и снимаем уцелевший титановый щиток.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(1,2),'chips'=>C($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] герметизирует поврежденную канистру, масло не проливается.', 'noResourceText' => 'Без [Изолента] половина ценного масла выливается в сухую грязь.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Робот воспринимает нас как угрозу и активирует аварийную разрядную дугу!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] принимает на себя электрический удар — ток уходит в землю.', 'noResourceText' => 'Без [Дерево] разряд проходит через тело — судороги и тяжелые ожоги.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Из корпуса вылезает гнездо слепых клещей-паразитов, питавшихся аккумом.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] смывает тварей с одежды до того, как они успевают прокусить кожу.', 'noResourceText' => 'Без [Вода] клещи успевают впиться в ноги — приходится выжигать.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Сбиваем турельную головку, надеясь найти редкий объектив.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] служит отличным рычагом — оптика снята без единой царапины.', 'noResourceText' => 'Без [Железо] линза трескается от удара — забираем лишь мелкие обломки.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 2. Телефонная будка 1980-х
    [
        'text' => 'Среди разрушенного бетона стоит сохранившаяся красная телефонная будка. Внутри висит тяжелая трубка, а монетоприемник неожиданно гудит.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Разбираем монетоприемник — внутри застряла горсть советских монет и редкий чип-декодер.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] быстро вскрывают бронированный кожух аппарата.', 'noResourceText' => 'Без [Инструменты] долго ковыряем замок, ломая ногти и часть содержимого.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Из трубки доносится записанный автоответчиком голос, называющий координаты военного склада.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,4),'chips'=>C($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] чинит оборванный провод динамика — считываем координаты полностью.', 'noResourceText' => 'Без [Изолента] связь постоянно рвется — разбираем лишь половину цифр.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Внутри будки скопился тяжелый ядовитый газ из разбитого трансформатора.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] смочила плотную ткань — получился отличный импровизированный фильтр.', 'noResourceText' => 'Без [Вода] вдыхаем токсичные пары — жжение в легких и кашель.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.03];}],
                ['text' => 'При попытке открыть дверь проржавевшие стекла лопаются и осыпаются на нас.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] помогает выставить щит от осыпающихся острых осколков.', 'noResourceText' => 'Без [Дерево] стеклянная крошка режет незащищенные кисти рук.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Пытаемся вырвать стальной кабель аппарата на цветмет.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] используется как зубило — срезаем медную жилу целиком.', 'noResourceText' => 'Без [Железо] кабель только сгибается, сдирая нам кожу на ладонях.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 3. Застрявший автоматоход
    [
        'text' => 'В болоте по самые оси увяз трехосный грузовик-автоматоход. В его открытом кузове видны ящики с маркировкой МО СССР и электронные блоки.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Пробираемся к кузову и достаем герметичный кейс с вычислительными платами.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] позволило соорудить гать и не провалиться в трясину.', 'noResourceText' => 'Без [Дерево] чуть не утонули в иле, вытащили только один мокрый модуль.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Промываем найденные в кабине армейские рационы от болотной тины.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.08),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] смывает токсичную грязь, пайки оказываются полностью пригодны.', 'noResourceText' => 'Без [Вода] часть консервов приходится выбросить из-за разъеденной крышки.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Из затопленной кабины выскакивает кибер-болотник — сгнивший мутант с впаянными чипами.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] коротят оголенный кабель на голове твари — мутант падаёт без чувств.', 'noResourceText' => 'Без [Инструменты] тварь успевает глубоко полоснуть когтями по предплечью.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Грузовик неожиданно проседает глубже, зажимая ногу между бортом и корягой.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] сработало как надежный домкрат — вывобождаем конечность.', 'noResourceText' => 'Без [Железо] приходится с болью вырывать ногу, растянув связки.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Срезаем силовую проводку со старого генератора.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'chips'=>C($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] плотно связывает кабели в удобный для переноски бунт.', 'noResourceText' => 'Без [Изолента] провода путаются и цепляются за кусты, теряем часть.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 4. Схрон синоптика
    [
        'text' => 'На вершине холма обрушилась метеорологическая вышка. Под обломками виднеется стальной кунг с надписью «Госкомгидромет».',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вскрываем гермодверь кунга и находим рабочие барометры и микросхемы связи.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] срезают заклинивший засов без шума и пыли.', 'noResourceText' => 'Без [Инструменты] долго бьем по затвору камнем, повредив приборы.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Находим запасы фильтрованной воды и медицинские аптечки синоптиков.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.10),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] герметизирует треснувшую колбу с медикаментами.', 'noResourceText' => 'Без [Изолента] часть ампул разбивается при транспортировке.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Рядом с вышкой находилась аномалия «Шаровая молния» — нас бьет разрядом.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] отводит основной разряд в сторону как громоотвод.', 'noResourceText' => 'Без [Железо] дуга ударяет прямо в снаряжение, обугливая кожу.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Деревянные перекрытия вышки рушатся прямо на нас во время поиска.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] подпирает падающую балку, давая выиграть секунду.', 'noResourceText' => 'Без [Дерево] тяжелое бревно бьет по плечу — сильный ушиб.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Промываем радиодетали от многолетней пыли.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,1)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] вымывает окислы, возвращая контактам блеск.', 'noResourceText' => 'Без [Вода] детали остаются грязными, снижая их рыночную стоимость.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 5. Убежище радиолюбителя
    [
        'text' => 'В чердачном помещении сгоревшей пятиэтажки сохранился угол радиолюбителя: трансиверы, радиолампы и паутина антенн на крыше.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Демонтируем уцелевшие транзисторы и блоки настройки частоты.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют аккуратно выпаять ценные микросхемы.', 'noResourceText' => 'Без [Инструменты] вырываем платы с мясом, ломая ножки деталей.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Находим на столе запечатанный термос и пачку сухарей.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.07),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] помогает размочить черствые сухари без вреда для зубов.', 'noResourceText' => 'Без [Вода] грызем сухие крошки, только сильнее разжигая жажду.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.01,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Антенна на крыше наэлектризована статической аномалией — удар током!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] оборачивает рукоятку — избавляет от электрического пробоя.', 'noResourceText' => 'Без [Изолента] ток бьет через голые пальцы, обжигая ладони.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Гнилые чердачные доски проваливаются под нашим весом.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] вовремя подкладывается под ноги, распределяя вес.', 'noResourceText' => 'Без [Дерево] проваливаемся по пояс, ободрав ноги об гвозди.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Пытаемся укрепить расшатанную мачту антенны, чтобы осмотреться.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,1)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] надежно фиксирует основание — видим тайник на соседней крыше.', 'noResourceText' => 'Без [Железо] мачта падает, едва не сбив нас с ног.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 6. Сломанный агробот
    [
        'text' => 'Посреди заросшего сорняками поля стоит гусеничный агробот «Колос-4». Его культиватор заклинило, но батарейный отсек цел.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем медные обмотки и главный процессор управления севом.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] отворачивают закисшие болты силового блока.', 'noResourceText' => 'Без [Инструменты] срезаем только внешнюю проводку.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В баке агробота сохранился чистый технический спирт.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(1,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] помогает заделать дыру в нашей фляге и перелить спирт.', 'noResourceText' => 'Без [Изолента] большая часть спирта испаряется при переливании.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Агробота заклинило не просто так — в гусеницах запутался ядовитый слепыш-переросток.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] блокирует пасть твари, позволяя нанести точный удар.', 'noResourceText' => 'Без [Дерево] слепыш успевает ядовито вцепиться в ботинок.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Гидравлика робота неожиданно выстреливает струей раскаленного масла.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] мгновенно охлаждает ожог, снижая последствия.', 'noResourceText' => 'Без [Вода] масло въедается в ткань, причиняя сильную боль.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Пробуем отбить стальную лемех-лопату на металлолом.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] бьет точно в сварной шов — деталь отваливается.', 'noResourceText' => 'Без [Железо] только тупим собственное снаряжение.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 7. Аптека с кодовым замком
    [
        'text' => 'Разграбленная аптека 80-х годов. На заднем дворе виднеется стальной сейф с обгоревшим электронным замком.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вскрываем сейф и забираем армейские стимуляторы и медицинские чипы.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.06,0.12),'chips'=>C($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] перемыкают реле замка, сейф щелкает и открывается.', 'noResourceText' => 'Без [Инструменты] приходится выбивать петли, повреждая часть медикаментов.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Промываем сохранившиеся флаконы с физраствором.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] смывает токсичный налет с ампул — они готовы к употреблению.', 'noResourceText' => 'Без [Вода] оплывшие этикетки не позволяют разобрать состав.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В подсобке аптеки затаился кислотный слизень.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] факелом выжигает слизняка до того, как он брызнет кислотой.', 'noResourceText' => 'Без [Дерево] слизь попадает на куртку, прожигая ее до кожи.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Сейф оказывается заминирован химической ловушкой с хлором.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] герметично запечатывает клапан ловушки.', 'noResourceText' => 'Без [Изолента] успеваем вдохнуть ядовитый газ — резкая боль в груди.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Пытаемся отжать дверцу сейфа тяжелым ломом.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] давит с нужным усилием — дверца поддается.', 'noResourceText' => 'Без [Железо] лом гнется, а сейф остается закрытым.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 8. Разбитый полицейский патруль
    [
        'text' => 'На перекрестке стоит сгоревший «ГАЗ-24» патрульной службы с экспериментальным электронным радаром на крыше.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем радар и извлекаем вычислительный блок милицейской базы данных.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] откручивают специфические крепления блока.', 'noResourceText' => 'Без [Инструменты] спиливаем заклепки, повредив процессор.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В багажнике находим герметичную канистру с малом и ремень генератора.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(1,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] укрепляет потрескавшийся ремень, делая его пригодным.', 'noResourceText' => 'Без [Изолента] ремень рассыпается в труху от первого прикосновения.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Из салона вылезает псевдособака, устроившая там логово.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] захлопывает дверцу прямо перед мордой твари.', 'noResourceText' => 'Без [Железо] тварь выпрыгивает через окно и рвет рукав.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Бензобак машины протек и вспыхивает от случайной искры.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] тушит вспышку на обуви в первую же секунду.', 'noResourceText' => 'Без [Вода] огонь опаливает бровки и лицо.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Обираем подголовники и салон на ткань и набивку.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] помогает подпереть ржавую крышу, пока мы внутри.', 'noResourceText' => 'Без [Дерево] крыша проседает, заставляя торопливо вылезти.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 9. Остов курьерского дрона
    [
        'text' => 'В ветвях старого дуба застрял тяжелый почтовый дрон 80-х «Пчела-M». Его почтовый контейнер все еще закрыт.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Сбиваем дрон и достаем ценные посылки с микрочипами и оптикой.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'itemCount'=>1];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] используется как длинный шест — дрон падает мягко на подготовленную траву.', 'noResourceText' => 'Без [Дерево] дрон с грохотом падает на камни, часть содержимого бьется.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В контейнере находим сублимированный сухой паек и флягу.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.08),'exp'=>E($l,1)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] разводит сухой паек в питательную кашу.', 'noResourceText' => 'Без [Вода] приходиться жевать сухой порошок, развивая изжогу.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Дрон включает аварийный резонатор, привлекая местных слепых мутантов.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] перерезают провод динамика за долю секунды.', 'noResourceText' => 'Без [Инструменты] писк привлекает стаю, приходится отбиваться на бегу.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'При падении дрона с дерева нас накрывает тяжелая сухая ветка.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] принимает удар ветки на себя.', 'noResourceText' => 'Без [Железо] ветка бьет по спине, оставляя синяки.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Заматываем лопасти дрона, чтобы забрать их как запчасти.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] надежно фиксирует хрупкие карбоновые края.', 'noResourceText' => 'Без [Изолента] лопасти обламываются в рюкзаке.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 10. Покинутая бензоколонка
    [
        'text' => 'На старой АЗС с проржавевшими вывесками «Автоэкспорт» стоит заброшенный автоцистерна. Из подпола тянет сыростью.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Сливаем из подземного резервуара остатки очищенного керосина и микросхемы насоса.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'itemCount'=>rangeInt(1,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] ручной помпой откачивают топливо до последней капли.', 'noResourceText' => 'Без [Инструменты] черпаем черпаком, проливая ценность.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В операторской находим целую упаковку батареек и свечей.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] перематывает треснувший корпус блока батарей.', 'noResourceText' => 'Без [Изолента] часть батарей окислена и выпадает.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Из подземного люка вылезает гигантский кровососущий камышовик.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] факелом отгоняет тварь обратно в темноту.', 'noResourceText' => 'Без [Дерево] тварь успевает сделать глубокий прокол на шее.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Труба насоса под давлением выплескивает едкую смесь в глаза.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] немедленно промывает глаза, спасая зрение.', 'noResourceText' => 'Без [Вода] долго жжет веки, теряем ориентацию.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Пытаемся сбить стальной замок с технического люка.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] разрушает замок с первого удара.', 'noResourceText' => 'Без [Железо] замок только гнется, не открываясь.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 11. Остов шагающего экскаватора
    [
        'text' => 'В песчаном карьере возвышается гигантский шагающий экскаватор ЭШ-10/70. В его кабине все еще светится один индикатор.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Пробираемся в рубку и снимаем релейные блоки и силовые чипы.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] аккуратно отключают платы от древнего трансформатора.', 'noResourceText' => 'Без [Инструменты] отрываем провода с повреждением плат.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В бытовке экипажа находим чистую воду и чистые бинты.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.09),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] пополняет запасы и позволяет промыть раны.', 'noResourceText' => 'Без [Вода] бинты покрыты пылью, приходится долго стряхивать.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В стреле экскаватора свили гнездо скальные крысы.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] плотно заматывает штанины, не давая крысам пролезть.', 'noResourceText' => 'Без [Изолента] крысы искусали лодыжки.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Ржавая лестница на высоту 20 метров подламывается под ногами.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] заклинивает между пролетами, удержав нас от падения.', 'noResourceText' => 'Без [Железо] падаем с трехметровой высоты на песок.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Подпираем перекошенную дверь рубки, чтобы спокойно искать.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] надежно фиксирует тяжелую стальную дверь.', 'noResourceText' => 'Без [Дерево] дверь постоянно хлопает от ветра, мешая.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 12. Разбитый аномалией КРАЗ
    [
        'text' => 'Грузовик КрАЗ, перевозивший электронное оборудование, застрял в локальной гравитационной аномалии. Кабина плющена, но кузов цел.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вытаскиваем из кузова ящики с конденсаторами и чипами.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] срезают стальные ленты с ящиков.', 'noResourceText' => 'Без [Инструменты] вытаскиваем только то, что выпало само.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В бардачке спальника находим флягу со спиртом и сухое горючее.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.06),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] помогает правильно разбавить спирт для дезинфекции.', 'noResourceText' => 'Без [Вода] чистый спирт обжигает пищевод.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Гравитационный импульс аномалии неожиданно расширяется!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] играет роль заземлителя и гасит ударную волну.', 'noResourceText' => 'Без [Железо] нас швыряет о борт грузовика.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Из-под колеса вырывается струя сжатого воздуха с пылью.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] помогает быстро заделать трещину в маске.', 'noResourceText' => 'Без [Изолента] пыль забивает дыхательные пути.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.03];}],
                ['text' => 'Сооружаем рычаг из ветки, чтобы достать дальний ящик.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] выдвигает ящик из опасной зоны.', 'noResourceText' => 'Без [Дерево] до ящика просто не дотянуться.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 13. Автоматизированная насосная
    [
        'text' => 'Небольшое бетонное здание насосной станции. Внутри ритмично стучит старый поршневой насос, управляемый микроконтроллером.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Считываем прошивку и забираем управляющую плату насоса.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] аккуратно отсоединяют контроллер без замыкания.', 'noResourceText' => 'Без [Инструменты] короткая искра выжигает половину чипа.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Насос качает чистейшую артезианскую воду — напиваемся и набираем с собой.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.06,0.12),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] позволяет промыть наши емкости перед заливкой.', 'noResourceText' => 'Без [Вода] заливаем в грязную флягу, снижая качество.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В сыром углу насосной устроилась электрическая жаба-мутант.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] изолирует перчатки, позволяя схватить тварь.', 'noResourceText' => 'Без [Изолента] получаем сильный удар током при контакте.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Проржавевший патрубок высокого давления лопается у нас за спиной.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] подставляется под струю, принимая удар на себя.', 'noResourceText' => 'Без [Дерево] струя сбивает с ног и бьет о бетонный пол.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Пытаемся заблокировать маховик насоса стальным прутом.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,1)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] останавливает механизм без повреждений.', 'noResourceText' => 'Без [Железо] прут соскакивает, оглушая грохотом.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 14. Бункер узла связи
    [
        'text' => 'Заглубленный бункер узла связи «Интеркосмос». Затоплен по щиколотку, в темноте мигают редкие диоды стойки серверов.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем серверные платы с позолоченными контактами.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] отжимают защелки серверных стоек.', 'noResourceText' => 'Без [Инструменты] выламываем платы, ломая текстолит.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'На сухом столе оператора находим закрытую коробку с пайком ВКС СССР.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.10),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] разогревает химический нагреватель пайка.', 'noResourceText' => 'Без [Вода] едим паек холодным.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В затопленном полу проходит оголенный кабель под напряжением!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] помогает изолировать обувь и пройти брод.', 'noResourceText' => 'Без [Изолента] ток проходит через воду — судороги и ожоги.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Из вентиляции вываливается ядовитый паук-сенокос.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] факелом мгновенно сжигает паутину и тварь.', 'noResourceText' => 'Без [Дерево] паук успевает укусить в шею.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Срываем стальную дверцу с аварийного щитка.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] дает необходимый рычаг для срыва засова.', 'noResourceText' => 'Без [Железо] дверца не поддается.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 15. Упавший экспериментальный истребитель
    [
        'text' => 'В тайге находятся обломки истребителя «МиГ-35Э». Носовая часть с бортовым компьютером и радаром с активной фазированной решеткой цела.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем процессорный блок бортового компьютера.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,7),'exp'=>E($l,4)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] без повреждений снимают бронированный кожух.', 'noResourceText' => 'Без [Инструменты] повреждаем кристаллы чипа при демонтаже.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В катапультируемом кресле находим аварийный запас НЗ.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.06,0.11),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] растворяет изотонический порошок из НЗ.', 'noResourceText' => 'Без [Вода] порошок невозможно проглотить.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Срабатывает пиропатрон системы аварийного сброса фонаря!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.11,'chips'=>NC($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] прикрывает от ударной волны и осколков.', 'noResourceText' => 'Без [Дерево] получаем сильную контузию и ожоги.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.06];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Топливо из крыльевых баков разъедает подошву обуви.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] быстро восстанавливает поврежденную подошву.', 'noResourceText' => 'Без [Изолента] приходиться идти босиком по обломкам.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.03];}],
                ['text' => 'Отбиваем титановый обшивочный лист.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,1)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] срубает заклепки обшивки.', 'noResourceText' => 'Без [Железо] заклепки только плющатся.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 16. Заброшенный планетарий
    [
        'text' => 'Здание городского планетария. Под треснувшим куполом стоит старый оптико-механический проектор «Цейсс» с кучей линз и сервоприводов.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем линзы высокого качества и сервомоторы позиционирования.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] аккуратно демонтируют точную оптику.', 'noResourceText' => 'Без [Инструменты] часть линз царапается о металл.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В подсобке проекциониста находим запечатанную бутылку сока и чистые салфетки.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.07),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] смывает слой пыли с бутылки перед открытием.', 'noResourceText' => 'Без [Вода] пыль попадает внутрь напитка.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Под проектором гнездятся слепые рукокрылые мутанты.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] факелом отгоняет тварей под самый купол.', 'noResourceText' => 'Без [Дерево] рукокрылые вцепляются в волосы и лицо.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Купол планетария осыпается стеклянным дождем от порыва ветра.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] удерживается над головой как надежный щит.', 'noResourceText' => 'Без [Железо] осколки режут плечи и спину.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Фиксируем покосившийся проектор, чтобы он не упал на нас.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,1)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] приматывает несущую станину к колонне.', 'noResourceText' => 'Без [Изолента] работаем в постоянно страхе быть раздавленным.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 17. Лаборатория робототехники
    [
        'text' => 'Полуразрушенный корпус института ПТИ. В лаборатории на столах стоят опытные образцы шагающих манипуляторов.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Демонтируем шаговые двигатели и контроллеры движения.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] снимают двигатели без повреждения редукторов.', 'noResourceText' => 'Без [Инструменты] спиливаем валы, снижая ценность деталей.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В медицинском уголке находим спирт и стерильные материалы.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.09),'itemCount'=>1];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] герметизирует пакеты с медикаментами.', 'noResourceText' => 'Без [Изолента] материал отсыревает по дороге.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Автоматическая система автоклава стравливает перегретый пар.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] быстро охлаждает обрызганную одежду.', 'noResourceText' => 'Без [Вода] пар вызывает термический ожог предплечий.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Один из манипуляторов самопроизвольно сжимает клешню на нашей руке!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] вставляется в шарнир как клин, разжимая хватку.', 'noResourceText' => 'Без [Железо] клешня сильно сдавливает кисть, повреждая суставы.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Подпираем упавшую стеллажную стойку деревянным брусом.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] спасает нижнюю полку с радиодеталями.', 'noResourceText' => 'Без [Дерево] стойка рушится, давя все в крошку.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 18. Трактор на газогенераторе
    [
        'text' => 'На краю поля стоит экспериментальный трактор 80-х, работающий на древесном газе, со встроенным блоком автопилота.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем блок автопилота и платиновые датчики выхлопа.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] аккуратно отворачивают сенсоры из трубы.', 'noResourceText' => 'Без [Инструменты] отламываем датчики вместе с резьбой.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В газогенераторном бункере находим сухие березовые брикеты.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] разгорается вместе с брикетами, давая отличный костер.', 'noResourceText' => 'Без [Дерево] брикеты отсырели, разжечь их не удается.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В бункере накопился угарный газ — становится дурно.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] помогает быстро прийти в себя и вымыть сажу с лица.', 'noResourceText' => 'Без [Вода] долго тошнит и кружится голова.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Тяжелый капот трактора срывается с петель и падает на нас.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] подставляется как упор, принимая тяжесть капота.', 'noResourceText' => 'Без [Железо] капот сбивает с ног, ушибив грудную клетку.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Заматываем пробитый шланг гидроусилителя, чтобы забрать его.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] восстанавливает герметичность шланга.', 'noResourceText' => 'Без [Изолента] шланг выливает остатки масла в рюкзак.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 19. Разрушенный музей ДОСААФ
    [
        'text' => 'Здание учебного центра ДОСААФ. Внутри лежат спортивные винтовки, учебные рации и плакаты по ГО.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем радиолампы и кварцевые резонаторы из учебных радиостанций.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] отпаивают редкие кварцы без повреждения контактов.', 'noResourceText' => 'Без [Инструменты] выламываем гнезда руками, часть растрескивается.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Находим закрытую аптечку АИ-2 с непросроченными табельными средствами.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.07,0.13),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] запивает концентрированные таблетки.', 'noResourceText' => 'Без [Вода] препараты вызывают сильную сухость во рту.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Учебная граната в сейфе оказалась боевой с растяжкой!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] принимают на себя основной сноп осколков.', 'noResourceText' => 'Без [Железо] мелкие осколки впиваются в голени.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Крыша зала рушится, поднимая тучи ядовитой старой извести.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] скрепляет развалившийся респиратор.', 'noResourceText' => 'Без [Изолента] вдыхаем едкую пыль, кашляя до крови.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Используем деревянную рейку, чтобы выудить коробку из-под завала.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'exp'=>E($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] дотягивается до ящика без риска для нас.', 'noResourceText' => 'Без [Дерево] до ящика не дотянуться.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 20. Затопленный речной трамвай
    [
        'text' => 'На отмели речки лежит полузатопленный речной трамвайчик «Заря». Его рубка управления возвышается над водой.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем судовой эхолот и блоки радиостанции.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] откручивают морские антикоррозийные болты.', 'noResourceText' => 'Без [Инструменты] ломаем крепления, повреждая корпус эхолота.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В спасательном плоту находим запасы пресной воды и сигнальные ракеты.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.08),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] из плота пополняет наши истощенные фляги.', 'noResourceText' => 'Без [Вода] часть емкостей оказывается пробита.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Из затопленного трюма выплывает мутировавшая речная выдра.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] отбивает атаку твари на подходе к рубке.', 'noResourceText' => 'Без [Дерево] выдра вцепляется в бедро, нанося глубокие раны.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Палуба прогнила — нога проваливается в ржавый металл.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] подкладывается как опора, не давая провалиться глубину.', 'noResourceText' => 'Без [Железо] глубоко рассекаем голень об ржавые края.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Обматываем найденные радиодетали пленкой от сырости.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] надежно запечатывает пакет с трофеями.', 'noResourceText' => 'Без [Изолента] брызги воды портят часть плат.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 21. Старая автоматическая застава
    [
        'text' => 'Бронированный периметр заставы с недействующим автоматическим пулеметом «Утёс-М». Его блок наведения тихо щелкает.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем модуль оптического наведения и вычислитель.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] отсоединяют высокоточную оптику без сбоя настроек.', 'noResourceText' => 'Без [Инструменты] сбиваем юстировку линз при демонтаже.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В лентоприемнике сохранились нерасстрелянные патроны.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(1,3)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] помогает связать патронные ленты для переноски.', 'noResourceText' => 'Без [Изолента] патроны рассыпаются в пыль.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Остаточный заряд пулемета производит короткую очередь по нам!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.12,'chips'=>NC($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] принимает на себя пули, спасая жизнь.', 'noResourceText' => 'Без [Железо] пуля проходит по касательной через предплечье.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.06];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.06];}],
                ['text' => 'При досмотре периметра наступаем на сигнальную мину.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] позволяет нажать на чеку с расстояния и принять вспышку.', 'noResourceText' => 'Без [Дерево] вспышка и шум оглушают и обжигают ноги.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Промываем датчики движения водой, проверяя их работоспособность.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] смывает нагар, открывая рабочий светодиод.', 'noResourceText' => 'Без [Вода] датчики кажутся сгоревшими.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 22. Почтовое отделение 1980-х
    [
        'text' => 'Старое отделение связи. За разбитыми окошками касс стоят сортировочные машины для писем с простыми процессорами.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вынимаем процессоры сортировки и оптопары считывателей индексов.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] аккуратно вынимают DIP-микросхемы из панелей.', 'noResourceText' => 'Без [Инструменты] гнем и ломаем выводы чипов.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В сейфе начальника почты находим нераспечатанные посылки с сухими пайками.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.08),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] смывает плесень с упаковок пайков.', 'noResourceText' => 'Без [Вода] упаковка грязная, приходится рисковать при вскрытии.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Под деревянным полом кассы устроили гнездо тушинские крысы.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] используется как дубина, быстро прижимая крыс.', 'noResourceText' => 'Без [Дерево] крысы успевают искусать руки.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Тяжелая решетка кассового окна солкается и падает на пальцы.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] блокирует падение решетки.', 'noResourceText' => 'Без [Железо] прижимает фаланги пальцев до синяков.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Скрепляем найденные карты маршрутов изолентой.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] фиксирует ветхую бумагу, сохраняя карту.', 'noResourceText' => 'Без [Изолента] карта рассыпается в руках.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 23. Брошенный электрокар
    [
        'text' => 'На территории заводского двора стоит трехколесный электрокар ЭП-0808. Его медные шины и контроллер питания целы.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем медные шины питания и массивные тиристоры.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] отворачивают силовые гайки на 24.', 'noResourceText' => 'Без [Инструменты] сбиваем грани, снижая стоимость металла.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В ящике для инструмента находим консистентную смазку и ветошь.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] перематывает протекающую банку со смазкой.', 'noResourceText' => 'Без [Изолента] смазка испачкает весь рюкзак.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Батарейный отсек выделяет концентрированный кислый газ.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] нейтрализует попадание кислоты на кожу.', 'noResourceText' => 'Без [Вода] кислота вызывает сильный химический ожог.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Рулевая колонка электрокара отламывается и бьет по колену.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] подставляется как буфер, гася удар.', 'noResourceText' => 'Без [Дерево] получаем сильный ушиб коленного сустава.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.03];}],
                ['text' => 'Используем стальной прут, чтобы поднять тяжелый аккум.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] выдерживает вес свинцовых пластин.', 'noResourceText' => 'Без [Железо] аккум падаёт, разбивая свинец.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 24. Медпункт ликвидаторов
    [
        'text' => 'Заброшенный временный медпункт. Внутри стоят автоклавы, носилки и упавшие шкафы с медикаментами.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Находим в герметичном сейфе противорадиационные препараты и медицинские чипы.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.08,0.15),'chips'=>C($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] быстро взламывают простой замок сейфа.', 'noResourceText' => 'Без [Инструменты] долго шумим, ломая дверцу.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Промываем и стерилизуем найденный набор скальпелей.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] качественно промывает хирургический инструмент.', 'noResourceText' => 'Без [Вода] инструменты остаются со следами ржавчины.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В помещении сохранился высокий фон радиации — счетчик заходится треском.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] герметично проклеивает швы костюма.', 'noResourceText' => 'Без [Изолента] получаем дозу облучения — тошнота и слабость.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Упавший стеклянный шкаф разбивается прямо под ногами.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] помогает расчистить путь от стеклянных мечей.', 'noResourceText' => 'Без [Дерево] пробиваем подошву тонким осколком.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.03];}],
                ['text' => 'Отгибаем стальную решетку на окне для быстрого отхода.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] расширяет проем без лишнего шума.', 'noResourceText' => 'Без [Железо] решетка не поддается.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 25. Учебный робот-конструктор
    [
        'text' => 'В здании станции юных техников лежит разобранный робот-конструктор «Юность-85» с набором планарных плат.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Забираем идеальные микросхемы серии К155 и мелкие электродвигатели.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] извлекают чипы без изгиба выводов.', 'noResourceText' => 'Без [Инструменты] обламываем тонкие ножки микросхем.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В тумбочке учителя находим пачку чая и запечатанную сгущенку.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.08),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] позволяет заварить чай с найденной сгущенкой.', 'noResourceText' => 'Без [Вода] едим сгущенку всухомятку.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Старый конденсатор в питателе робота взрывается от прикосновения!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] перекрывает вспышку электролита.', 'noResourceText' => 'Без [Железо] брызги горячего фольгированного электролита летят в лицо.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.03];}],
                ['text' => 'Деревянный стеллаж с моделями рушится нам на голову.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] подпирает падающую полку.', 'noResourceText' => 'Без [Дерево] получаем ушиб затылка.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.03];}],
                ['text' => 'Скрепляем изолентой лопнувший корпус макета радиоприемника.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] сохраняет целостность корпуса для продажи.', 'noResourceText' => 'Без [Изолента] приемник рассыпается.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 26. Трамвайное депо
    [
        'text' => 'Заброшенное депо. На путях стоит трамвай «Татра3» с переоборудованной автоматической крышевой турелью.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем контроллер управления турелью и свинцовые аккумуляторы.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] отключают провода турели без активации.', 'noResourceText' => 'Без [Инструменты] отрываем блоки силовым методом, теряя детали.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В кабине вагоновожатого находим термос с травяным отваром и аптечку.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.09),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] разбавляет концентрированный старый отвар.', 'noResourceText' => 'Без [Вода] отвар слишком горький и тошнотворный.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Система безопасности трамвая выпускает высоковольтную дугу.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] изолирует рукоятку инструмента от пробоя.', 'noResourceText' => 'Без [Изолента] дуга ударяет в кисть, обугливая кожу.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Трамвай скрежещет и слегка проседает во смотровую яму.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] сзади блокирует колесо, останавливая движение.', 'noResourceText' => 'Без [Железо] нас прижимает боком к стальной опоре.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Используем деревянный брус для подпора тяжело дверцы фары.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] дает достать мощную кварцевую лампу.', 'noResourceText' => 'Без [Дерево] лампа разбивается при падении дверцы.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 27. Склад кибернетики
    [
        'text' => 'Полуподвальный склад оптовой базы. На стеллажах видны ящики с надписью «Запчасти к автооператорам».',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вскрываем ящики и забираем логические блоки и платиновые контакты.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] вскрывают пломбы без повреждения содержимого.', 'noResourceText' => 'Без [Инструменты] ломаем ящики монтировкой, давя часть плат.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Промываем от складской пыли запаянные банки с армейской тушенкой.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.06,0.11),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] смывает неизвестный химический налет с банок.', 'noResourceText' => 'Без [Вода] рискуем занести химию при открытии.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'На складе затаился слепой упырь, питающийся смазкой.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] в виде факела быстро прогоняет тварь.', 'noResourceText' => 'Без [Дерево] тварь успевает глубоко царапнуть плечо.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Верхняя полка стеллажа подламывается под тяжестью металла.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] удерживает падающий край полки.', 'noResourceText' => 'Без [Железо] тяжелый ящик падаёт на ступню.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Перематываем поврежденную упаковку микросхем.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] сохраняет комплектность радиодеталей.', 'noResourceText' => 'Без [Изолента] мелкие чипы высыпаются через щель.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 28. Старое реле связи
    [
        'text' => 'Вышка радиорелейной связи «Горизонт» на обрыве. В подсобке гудит заклинивший бензогенератор.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Останавливаем генератор и извлекаем его высокочастотный модуль.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] снимают генератор с подушек без повреждений.', 'noResourceText' => 'Без [Инструменты] спиливаем болты, повреждая медную обмотку.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В канистре рядом находим чистый бензин для нашей зажигалки.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] запечатывает пробоину в нашей фляге с бензином.', 'noResourceText' => 'Без [Изолента] бензин быстро испаряется.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Выхлопная труба генератора прогорела — ядовитые газы заполняют подсобку.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] смочила салфетку для защиты дыхания.', 'noResourceText' => 'Без [Вода] сильно откашливаемся, испытывая удушье.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.03];}],
                ['text' => 'Крепление растяжки вышки лопается от ветра — стальной трос бьет по стене.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] отбивает летящий трос в сторону.', 'noResourceText' => 'Без [Железо] трос хлещет по бедру, оставляя огромный гематому.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Подпираем покосившуюся дверь подсобки деревянным брусом.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] фиксирует дверь от ударов ветра.', 'noResourceText' => 'Без [Дерево] дверь со свистом хлопает.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 29. Лаборатория агрофизики
    [
        'text' => 'Стеклянная оранжерея института агрофизики. В центре стоят фито-лампы и автоматическая система полива.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем таймеры полива, датчики влажности и платиновые электроды.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] снимают датчики без обрыва тонких проводов.', 'noResourceText' => 'Без [Инструменты] обрываем проводку у самого основания.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В баке системы полива сохранилась чистая дистиллированная вода.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.09),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] позволяет промыть наши емкости перед заливкой.', 'noResourceText' => 'Без [Вода] наливаем в грязную флягу.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Мутировавший плющ-хищник пытается обвить нашу ногу!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] факелом быстро прижигает стебли растения.', 'noResourceText' => 'Без [Дерево] плющ впивается шипами через брюки.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Стеклянная крыша оранжереи рушится от порыва ветра.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] используется как надежный навесной щит.', 'noResourceText' => 'Без [Железо] осколки стекла режут предплечья.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.03];}],
                ['text' => 'Фиксируем изолентой треснувшую колбу гидропоники.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] держит раствор, позволяя собрать семена.', 'noResourceText' => 'Без [Изолента] раствор вытекает в грязь.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 30. РЛС дальнего обнаружения
    [
        'text' => 'Огромная решетчатая антенна РЛС «Днепр». В аппаратной под вышкой висят блоки индикаторов кругового обзора.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Демонтируем осциллографические трубки и волноводы с золотым напылением.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,7),'exp'=>E($l,4)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] аккуратно отпаивают сверхвысокочастотные платы.', 'noResourceText' => 'Без [Инструменты] ломаем хрупкие стеклянные горловины трубок.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В шкафчике дежурного офицера находим герметичный термос и сухпай.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.10),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] помогает разогреть сухпай на хим-нагревателе.', 'noResourceText' => 'Без [Вода] едим паек сухим.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Конденсаторы высокой мощности все еще сохраняют смертельный заряд!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.11,'chips'=>NC($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] намотана на рукоятку — защищает от электрического пробоя.', 'noResourceText' => 'Без [Изолента] дуга бьет через инструмент, судороги и ожоги.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.06];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Металлическая секция антенны рушится на крышу аппаратной.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] принимают основной удар упавшей балки.', 'noResourceText' => 'Без [Железо] кусок потолка падает на плечо.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Используем деревянный брусок как клинья для заклинивания двери.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] надежно запирает дверь от ветра.', 'noResourceText' => 'Без [Дерево] дверь постоянно хлопает.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 31. Старый кинотеатр
    [
        'text' => 'Здание заброшенного кинотеатра «Родина». В проекционной будке стоят тяжелые кинопроекторы КПТ-7 с мощными дуговыми лампами.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем кварцевые отражатели, шаговые моторы и медные контакты.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] демонтируют ламповый блок без повреждений.', 'noResourceText' => 'Без [Инструменты] отбиваем детали молотком, бья кварц.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В буфете находим несколько запечатанных банок с фруктовым компотом.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.08),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] смывает толстый слой сажи с банок компота.', 'noResourceText' => 'Без [Вода] грязные крышки осыпают сажу прямо в компот.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Старая кинопленка из нитроцеллюлозы мгновенно вспыхивает от искры!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] мгновенно гасит вспышку на рукаве.', 'noResourceText' => 'Без [Вода] огонь успевает сжечь часть ткани и обжечь руку.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Гнилой деревянный пол проекционной проваливается под нами.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] перекрывает провал, давая опереться.', 'noResourceText' => 'Без [Дерево] падем на первый этаж, обдирая бока.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Перематываем изолентой треснувшие линзы объектива.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] фиксирует линзы для последующей перешлифовки.', 'noResourceText' => 'Без [Изолента] линзы высыпаются.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 32. Разбитый бронеавтомобиль «Водник»
    [
        'text' => 'Брошенная машина разведки. Внутри сохранился выносной комплекс ночного видения и тепловизор 80-х.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем электронно-оптический преобразователь и матрицы тепловизора.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] отворачивают специальные шлицевые винты.', 'noResourceText' => 'Без [Инструменты] слизываем шлицы, выламывая корпус.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В десантном отсеке находим сухожаровые бинты и промедол.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.06,0.12),'itemCount'=>1];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] перематывает вскрытую упаковку бинтов.', 'noResourceText' => 'Без [Изолента] бинты пачкаются об масляный пол.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Из бойницы выпрыгивает затаившийся слепой кибер-крот.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] встречает тварь жестким блоком.', 'noResourceText' => 'Без [Железо] крот впивается зубами в кисть.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Бронированная дверь люка падаёт от ветхости петель.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] подставляется как клиновой упор.', 'noResourceText' => 'Без [Дерево] тяжелая сталь бьет по предплечью.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Промываем оптику тепловизора чистой водой.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,1)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] смывает копоть с германиевого стекла.', 'noResourceText' => 'Без [Вода] стекло остается мутным.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 33. Речной гидроузел
    [
        'text' => 'Плотина малого гидроузла. В помещении турбины вращается ржавый вал, а на стене светится щит автоматики.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Забираем массивные медные шины и датчики оборотов вала.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] отворачивают прикипевшие гайки генератора.', 'noResourceText' => 'Без [Инструменты] срезаем только тонкие провода.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Находим в шкафу бытовки фильтр для воды и запасы соли.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.07),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] используется для проверки работы фильтра.', 'noResourceText' => 'Без [Вода] берём фильтр «как есть», без гарантии.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Турбина выплескивает струю ледяной воды под огромным давлением!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] перекрывает направление струи.', 'noResourceText' => 'Без [Железо] струя сбивает с ног и ударяет о бетон.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Стенка затвора лопается, засыпая нас осколками бетона.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] принимают на себя разлет крошки.', 'noResourceText' => 'Без [Дерево] бетонная крошка сбивает кожу на лице.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Изолируем поврежденный кабель питания для безопасного осмотра.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] защищает от короткого замыкания.', 'noResourceText' => 'Без [Изолента] работаем с постоянным риском удара.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 34. Метеорологический зонд
    [
        'text' => 'В поле лежит упавший стратосферный зонд «Урал-3». Его измерительный контейнер с серебряно-цинковыми аккумами цел.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем серебряно-цинковые аккумуляторы и передатчик.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] вскрывают легкий титановый корпус зонда.', 'noResourceText' => 'Без [Инструменты] мнем титан, повреждая внутренние платы.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В контейнере находим аварийный запас шоколада и галет.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.09),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] помогает быстро размочить пересохшие галеты.', 'noResourceText' => 'Без [Вода] галетами можно сломать зубы.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Парашют зонда накрывает нас с головой — под ним затаилась ядовитая сороконожка.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] факелом мгновенно прожигает стропы и прижигает тварь.', 'noResourceText' => 'Без [Дерево] сороконожка успевает укусить в шею.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Батарея зонда протекает концентрированным щелочным электролитом.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] вымывает щелочь с кистей рук.', 'noResourceText' => 'Без [Вода] щелочь въедается в кожу, вызывая ожоги.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.03];}],
                ['text' => 'Сматываем тонкий прочный капроновый шнур зонда.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,1)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] фиксирует аккуратную моток шнура.', 'noResourceText' => 'Без [Изолента] шнур путается в неразделимый колтун.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 35. Покинутый комбинат «Синтез»
    [
        'text' => 'Цех автоматической фасовки химического комбината. На линии стоят роботы-укладчики с вакуумными захватами.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем вакуумные насосы и контроллеры линии.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] отворачивают фланцевые крепления насоса.', 'noResourceText' => 'Без [Инструменты] ломаем штуцеры, снижая стоимость.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В бытовке операторов находим чистую спецодежду и респираторы.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] подклеивает клапан респиратора.', 'noResourceText' => 'Без [Изолента] респиратор пропускает пыль.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Из фасовочного бункера вырывается облако ядовитого реагента.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] смочила плотную ткань маски, задержав яд.', 'noResourceText' => 'Без [Вода] вдыхаем химию — кашель и боль в легких.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Вакуумный захват робота сжимается на нашем плече от остаточного давления!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] стравливает воздух из магистрали.', 'noResourceText' => 'Без [Железо] присоска оставляет огромный синяк.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.03];}],
                ['text' => 'Подпираем перекошенную раму робота бруском.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] удерживает махину, давая снять плату.', 'noResourceText' => 'Без [Дерево] робот заваливается набок.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 36. Разрушенный КИП и А
    [
        'text' => 'Здание лаборатории контрольно-измерительных приборов. На верстаках стоят осциллографы С1-65 и частотомеры.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Разбираем осциллографы — внутри золоченые переключатели и ценные платы.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] извлекают переключатели без повреждения контактов.', 'noResourceText' => 'Без [Инструменты] сдираем позолоту грязными кусачками.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В шкафу находим запечатанные банки с дистиллированной водой и спиртом.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.08),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] смывает пыль с банок перед открытием.', 'noResourceText' => 'Без [Вода] грязь осыпается внутрь.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Трансформатор питания пробит на корпус — сильный удар током!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] на щупах защищает руки от высоковольтного дуги.', 'noResourceText' => 'Без [Изолента] ток проходит через пальцы.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Тяжелый осциллограф соскальзывает с верстака нам на ногу.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] подставляется как упор, принимая удар.', 'noResourceText' => 'Без [Железо] тяжелый корпус бьет по стопе.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.03];}],
                ['text' => 'Подпираем упавшую полку брусом.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] дает закончить осмотр стола.', 'noResourceText' => 'Без [Дерево] полка окончательно падает.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 37. Бункер гражданской обороны
    [
        'text' => 'Убежище ГО под заводским клубом. Фильтровентиляционная установка «ФВУ-100» частично разобрана.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем электродвигатель вентилятора и блок автоматов защиты.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] отворачивают анкерные болты мотора.', 'noResourceText' => 'Без [Инструменты] спиливаем контакты, повреждая выводы.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'На складе ГО находим нераспечатанные индивидуальные аптечки и дозиметры.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.06,0.11),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] помогает запить радиопротекторы из аптечек.', 'noResourceText' => 'Без [Вода] таблетки вызывают тошноту.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В воздуховоде затаилась ядовитая слепая мошкара.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] факелом быстро выжигает рой.', 'noResourceText' => 'Без [Дерево] мошкара искусала лицо и шею.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Тяжелая гермодверь срывается со стопора и прижимает ногу.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] сработало как надежный клин в косяке.', 'noResourceText' => 'Без [Железо] герма сдавливает голень до треска.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Проклеиваем треснувший корпус найденного дозиметра.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] восстанавливает герметичность прибора.', 'noResourceText' => 'Без [Изолента] прибор показывает погоду.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 38. Покинутый инкассаторский броневик
    [
        'text' => 'На обочине стоит сгоревший «РАФ-2203» инкассаторов. Внутри виден спецавтомат фасовки купюр с чипами памяти.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вскрываем фасовочный автомат и извлекаем платы памяти и редкие чипы.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] вскрывают бронированный кожух автомата.', 'noResourceText' => 'Без [Инструменты] гнем платы, пытаюсь отжать замок.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В сейфе инкассаторов находим советские червонцы и флягу с водой.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.07),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] из фляги оказывается полностью питьевой.', 'noResourceText' => 'Без [Вода] фляга покрыта ржавчиной внутри.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Из-под сиденья вылетает рой огненных муравьев.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] факелом быстро прижигает муравейник.', 'noResourceText' => 'Без [Дерево] муравьи успевают искусать кисти.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Брокостекло двери трескается и вываливается острыми кусками.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] отбивает тяжелые куски стекла.', 'noResourceText' => 'Без [Железо] стекло режет руки через перчатки.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.03];}],
                ['text' => 'Скрепляем изолентой поврежденный кассетный блок.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] держит кассету целой.', 'noResourceText' => 'Без [Изолента] детали высыпаются.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 39. Экспериментальная кормокухня
    [
        'text' => 'Здание животноводческого комплекса. На кормокухне стоит автоматический программный заварник кормов.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем шаговые контроллеры и дозирующие клапаны с чипами.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] отворачивают латунные клапаны без сколов.', 'noResourceText' => 'Без [Инструменты] сбиваем резьбу, снижая стоимость.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В складе находим запасы чистого зерна и сушеных паточных брикетов.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.08),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] размачивает паточные брикеты в питательный отвар.', 'noResourceText' => 'Без [Вода] брикеты слишком твердые.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В паровом котле накопился ядовитый сероводород.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] смочила фильтрующую повязку.', 'noResourceText' => 'Без [Вода] вдыхаем газ — сильная тошнота.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.03];}],
                ['text' => 'Мешалка кормокухни проворачивается и зажимает рукав.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] заклинивает лопасть мешалки.', 'noResourceText' => 'Без [Железо] мешалка сильно растягивает плечевой сустав.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Подпираем упавшую крышку котла деревянной жердью.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] фиксирует крышку в открытом положении.', 'noResourceText' => 'Без [Дерево] крышка падает, мешая поиску.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 40. Лаборатория криогеники
    [
        'text' => 'Подвал под институтом физики. В криолаборатории стоят сосуды Дьюара и замерзшие платы управления.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Осторожно извлекаем сверхпроводящие магниты и чипы с платиновыми ножками.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,7),'exp'=>E($l,4)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] отжимают замерзшие крепления без растрескивания.', 'noResourceText' => 'Без [Инструменты] ломаем переохлажденные детали.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В бытовке находим спирт и согревающие термохимические грелки.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.06,0.11),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] активирует реакцию в грелках.', 'noResourceText' => 'Без [Вода] грелки остаются холодными.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Утечка жидкого азота! Воздух мгновенно промерзает, леденя пальцы.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] помогает заделать трещину в трубе азота.', 'noResourceText' => 'Без [Изолента] получаем обморожение кистей рук.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'От перепада температур лопается стальная балка перекрытия.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] принимает на себя осколки металла.', 'noResourceText' => 'Без [Железо] осколок бьет по голени.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.03];}],
                ['text' => 'Используем деревянный брус для безопасного скалывания льда.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] откалывает лед без искр.', 'noResourceText' => 'Без [Дерево] скользим и падаем на лед.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 41. Остов пассажирского «ЛИАЗ-677»
    [
        'text' => 'В овраге лежит желтый «ЛиАЗ». В его салоне висит экспериментальный кассовый автомат с электронным считывателем.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Разбираем кассовый автомат и забираем считывающую головку и чипы.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] легко снимают хитрый замок автомата.', 'noResourceText' => 'Без [Инструменты] спиливаем замок, повреждая внутренности.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В кабине водителя находим аптечку и термос с чаем.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.07),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] разбавляет заваренный чай.', 'noResourceText' => 'Без [Вода] чай слишком горький.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.01,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Под задним сиденьем устроилась стая ядовитых слепышей.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] факелом быстро выгоняет тварей из автобуса.', 'noResourceText' => 'Без [Дерево] слепыши искусывают лодыжки.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Проржавевший пол автобуса проваливается под весом.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] подкладывается как перекладина.', 'noResourceText' => 'Без [Железо] проваливаемся, рассекая кожу на ноге.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.03];}],
                ['text' => 'Изолентой перематываем найденный рулон редких билетов.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] сохраняет билеты как раритет.', 'noResourceText' => 'Без [Изолента] билеты рвутся от ветра.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 42. Заброшенный типографский цех
    [
        'text' => 'Цех типографии. На печатных станках стоят автоматические фотонаборные головки с прецизионной оптикой.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Демонтируем фотонаборные линзы и шаговые двигатели подачи пленки.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] снимают оптику без нарушения центровки.', 'noResourceText' => 'Без [Инструменты] ломаем юстировочные винты.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В бытовке печатников находим чистый спирт и сухие салфетки.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.08),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] смывает типографскую краску с рук.', 'noResourceText' => 'Без [Вода] краска въедается в кожу.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В печатном валу застрял сухой мутировавший скалолаз.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] факелом мгновенно поджигает сухого мутанта.', 'noResourceText' => 'Без [Дерево] тварь успевает царапнуть лицо.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Тяжелый печатный вал соскальзывает со станины.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] блокирует падение стального вала.', 'noResourceText' => 'Без [Железо] вал падаёт на бедро.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Скрепляем изолентой найденные чертежи станков.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] скрепляет ветхую кальку.', 'noResourceText' => 'Без [Изолента] чертежи рвутся.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 43. Бункер узла водоканала
    [
        'text' => 'Подземная задвижка магистрального водовода. На стене висит блок автоматического дозирования хлора.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем платы дозатора и платиновые датчики хлора.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] отворачивают измерительные электроды без обрыва.', 'noResourceText' => 'Без [Инструменты] ломаем хрупкие датчики.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Находим в чистой секции резервуара чистейшую воду и запасы таблеток «Акватабс».', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.06,0.12),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] позволяет растворить таблетки для полного объема.', 'noResourceText' => 'Без [Вода] берём только таблетки.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Утечка концентрированного хлора из баллона!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] смочила мокрую ткань, создав надежный фильтр.', 'noResourceText' => 'Без [Вода] сильно обжигаем носоглотку едким газом.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Чугунная маховик задвижки лопается от нашего усилия.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] принимают на себя осколки чугуна.', 'noResourceText' => 'Без [Железо] осколок бьет по кисти руки.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.03];}],
                ['text' => 'Подпираем перекошенную дверцу щитка бруском.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] фиксирует щиток в удобном положении.', 'noResourceText' => 'Без [Дерево] щиток хлопает от сквозняка.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 44. Разбитый подвижный КП
    [
        'text' => 'Командно-штабная машина на базе КрАЗ-260. Внутри стоит вычислительный комплекс «Маневр» 80-х годов.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем процессорные блоки на ферритовых сердечниках и микросхемы.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,7),'exp'=>E($l,4)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] аккуратно отпаивают кубы памяти на ферритах.', 'noResourceText' => 'Без [Инструменты] рвем тончайшие медно-ферритовые нити.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В сейфе командира находим сухпай специального назначения и карту.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.10),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] разогревает спецпаек.', 'noResourceText' => 'Без [Вода] едим холодные консервы.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В штабе сработала система автоматического пожаротушения порошком.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] помогает заклеить дыхательный клапан от порошка.', 'noResourceText' => 'Без [Изолента] вдыхаем едкую порошковую взвесь.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Бронированный борт кунга проседает и давит ногу.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] сработало как надежный домкрат.', 'noResourceText' => 'Без [Железо] получаем растяжение и синяк на голени.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.03];}],
                ['text' => 'Используем деревянный шест для поднятия зависшей антенны.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] позволяет расправить штырь антенны.', 'noResourceText' => 'Без [Дерево] антенна ломается.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 45. Телефонная станция АТС-54
    [
        'text' => 'Заброшенная районная АТС. В машинном зале стоят огромные декадно-шаговые искатели с серебряными контактами.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Срезаем массивные струны с серебряным напылением и шаговые реле.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] быстро и чисто срезают серебряные контакты.', 'noResourceText' => 'Без [Инструменты] выламываем реле, роняя часть драгметалла.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В комнатах отдыха находим запечатанный чайник и пачку сахара.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.06),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] позволяет сделать сладкий чай и восстановить силы.', 'noResourceText' => 'Без [Вода] едим сахар всухомятку.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Аккумуляторная батарея АТС протекает серной кислотой!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] быстро смывает кислотную брызгу с обуви.', 'noResourceText' => 'Без [Вода] кислота разъедает ботинок и кожу.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Кабельный коллектор обрушивается под ногами.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] ложится мостиком через провал.', 'noResourceText' => 'Без [Дерево] падем в грязь, ободрав локти.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.03];}],
                ['text' => 'Скрепляем найденную схемы кабельных трасс изолентой.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] спасает ветхий документ.', 'noResourceText' => 'Без [Изолента] схема распадается на кусочки.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 46. Остов тепловоза «ТЭМ2»
    [
        'text' => 'На тупиковых путях стоит заброшенный тепловоз. В его дизельном отсеке сохранились мощные генераторы и пускорегулирующие платы.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Демонтируем тяжелые тиристоры и медные контакторы контакторной панели.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] легко снимают силовые контакты большого сечения.', 'noResourceText' => 'Без [Инструменты] сбиваем резьбу и повреждаем медные шины.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В кабине машиниста находим чистую воду и сухпай железнодорожников.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.09),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] смывает мазут с упаковки пайка.', 'noResourceText' => 'Без [Вода] едим паек с запахом мазута.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Из маслосборника вылезает замазанный мазутом слепой кабан.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] факелом пугает тварь, заставляя уйти в тупик.', 'noResourceText' => 'Без [Дерево] кабан сбивает с ног и рассекает голень клыком.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Тяжелый капотный щит дизеля срывается с петель.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] принимают на себя вес стальной двери.', 'noResourceText' => 'Без [Железо] дверца бьет по спине.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.03];}],
                ['text' => 'Изолируем поврежденный масляный шланг для слива масла.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] удерживает масляную струйку.', 'noResourceText' => 'Без [Изолента] масло выливается в рельсы.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 47. Заброшенная радиоастрономическая обсерватория
    [
        'text' => 'Малый радиотелескоп с тарелкой 12 метров. В пультовой стоят застывшие стойки приемников СВЧ-диапазона.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем малошумящие усилители и малогабаритные волноводы.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,7),'exp'=>E($l,4)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] отсоединяют СВЧ-блоки без нарушения герметичности.', 'noResourceText' => 'Без [Инструменты] отрываем разъемы вместе с текстолитом.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В комнате отдыха астрономов находим запечатанный кофе и галету.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.08),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] позволяет заварить найденный кофе.', 'noResourceText' => 'Без [Вода] едим кофе ложкой.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Высоковольтный трансформатор тарелки дает разряд статики!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] защищает рукоятку инструмента от пробоя.', 'noResourceText' => 'Без [Изолента] получаем сильный электрический ожог кисти.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Привод поворота тарелки лопается, сбрасывая противовес.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] останавливает падение стального блока.', 'noResourceText' => 'Без [Железо] падающий блок задевает плечо.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Подпираем упавшую секцию шкафа деревянным брусом.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] освобождает доступ к нижнему блоку.', 'noResourceText' => 'Без [Дерево] до блока не добраться.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 48. Автоматизированная сушилка зерна
    [
        'text' => 'Высокий элеватор с сушильным комплексом «КЗС-20». На пульте управления горят аварийные индикаторы.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Забираем платиновые датчики температуры зерна и блоки реле.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] аккуратно извлекают длинные датчики из шахты.', 'noResourceText' => 'Без [Инструменты] гнем термопары, теряя детали.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В бытовке элеватора находим канистру чистого растительного масла и соль.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] перематывает пробитую крышку канистры.', 'noResourceText' => 'Без [Изолента] масло выливается при транспортировке.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Зерновая пыль в шахте вспыхивает от искры — микровзрыв!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] мгновенно гасит вспышку на рукаве.', 'noResourceText' => 'Без [Вода] получаем ожоги лица и кистей.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Деревянные лестничные марши элеватора рушатся.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] дает подставить жердь и удержаться.', 'noResourceText' => 'Без [Дерево] съезжаем по обломкам, сдирая локти.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.03];}],
                ['text' => 'Заклиниваем стальным ломом вращающийся шнек.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] надежно заклинивает механизм.', 'noResourceText' => 'Без [Железо] шнек продолжает вращаться.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 49. Разбитый речной буксир
    [
        'text' => 'На песчаной косе лежит выброшенный буксир «БМ-12». В его рулевой рубке сохранился компрессор и судовой радар.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем блочную электронную часть радара и серебряные тумблеры.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] снимают панели радара без повреждения разъемов.', 'noResourceText' => 'Без [Инструменты] вырываем провода с мясом.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В камбузе находим сухой корабельный паек и соду.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.04,0.08),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] позволяет развести сухое молоко из пайка.', 'noResourceText' => 'Без [Вода] едим порошок сухого молока.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Из затопленного машинного отделения вылезает гигантская рак-мутант.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] блокирует клешню твари.', 'noResourceText' => 'Без [Железо] клешня глубоко рассекает голень.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Проржавевшая переборка рубки рушится прямо на нас.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] подпирает падающий лист железа.', 'noResourceText' => 'Без [Дерево] получаем ушиб плеча.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.03];}],
                ['text' => 'Заматываем изолентой найденный аварийный фонарь.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>1];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] фиксирует треснувший корпус фонаря.', 'noResourceText' => 'Без [Изолента] фонарь выпадает из рук.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],

    // 50. Сейсмологическая станция
    [
        'text' => 'Одинокое бетонное здание сейсмостанции в горах. В подвале тикает механический сейсмограф с электроникой.',
        'type' => 'story', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем высокоточные прецизионные датчики и платиновые растяжки сейсмографа.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,7),'exp'=>E($l,4)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] извлекают тончайшие платиновые нити без обрыва.', 'noResourceText' => 'Без [Инструменты] рвем платиновые нити, снижая ценность.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В кладовой находим запасы консервированного мяса и чистую воду.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.06,0.12),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] дополнительно пополняет запасы фляг.', 'noResourceText' => 'Без [Вода] берем только консервы.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Локальный сейсмический толчок вызывает обвал бетонированного потолка!', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] создает защитный каркас над головой.', 'noResourceText' => 'Без [Железо] кусок бетона бьет по спине.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'В темноте подвала наступаем на гнездо горного скорпиона-мутанта.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] факелом быстро выжигает гнездо тварей.', 'noResourceText' => 'Без [Дерево] скорпион успевает ужалить через ботинок.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Изолентой фиксируем ленту самописца с данными за прошлые годы.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] скрепляет рулон редких бумажных данных.', 'noResourceText' => 'Без [Изолента] лента рассыпается от ветхости.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
[
    'text' => 'На окраине заражённой зоны находишь старый центр подготовки спасателей. Перед войной здесь обучали людей работать в условиях катастроф.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'В тренировочном секторе находишь защищённые шкафы с медицинскими комплектами и экипировкой.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(1,3),'healPercent'=>RF(0.05,0.1)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют открыть медицинские контейнеры.', 'noResourceText' => 'Без [Инструменты] часть контейнеров остаётся закрыта.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Находишь симулятор выживания. Старый ИИ анализирует твои действия и выдаёт рекомендации.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,6),'chips'=>C($l,4)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] восстанавливает сенсоры тренировочного комплекса.', 'noResourceText' => 'Без [Изолента] ИИ работает только частично.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Система симуляции ошибочно активирует боевых тренировочных роботов.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,1)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] используется для отвлечения роботов.', 'noResourceText' => 'Без [Железо] приходится сражаться с машинами.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],

            ['text' => 'Из заражённого подвала выходят бывшие сотрудники центра. Радиация изменила их тела.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] помогает укрепить временное укрытие.', 'noResourceText' => 'Без [Дерево] мутанты прорываются слишком близко.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],

            ['text' => 'Изучаешь учебные материалы старого мира. Многие знания уже давно потеряны.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,4),'chips'=>C($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] помогает очистить повреждённые носители данных.', 'noResourceText' => 'Без [Вода] часть информации невозможно восстановить.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],


[
    'text' => 'В лесу находишь странную конструкцию из металла и композитных материалов. Позже выясняется, что это часть древнего орбитального оборудования.',
    'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'Извлекаешь уцелевший энергетический модуль. Такие детали давно стали редкостью.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,7),'itemCount'=>1];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют снять модуль без повреждений.', 'noResourceText' => 'Без [Инструменты] модуль частично повреждается.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'В памяти оборудования находишь данные о старых космических проектах человечества.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,7),'chips'=>C($l,3)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] помогает подключить древний накопитель.', 'noResourceText' => 'Без [Изолента] данные считываются частично.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Оборудование включает защитный протокол. Автоматические системы принимают тебя за угрозу.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.11];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] помогает перегрузить часть защитных механизмов.', 'noResourceText' => 'Без [Железо] система атакует напрямую.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.06];}],

            ['text' => 'Рядом появляется стая мутантов. Они реагируют на энергию работающего устройства.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] позволяет быстро скрыть источник сигнала.', 'noResourceText' => 'Без [Дерево] мутанты находят тебя.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],

            ['text' => 'Исследуешь неизвестную технологию и оставляешь координаты для будущих сталкеров.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,5),'chips'=>C($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] помогает закрепить оборудование для изучения.', 'noResourceText' => 'Без [Железо] исследование занимает больше времени.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],


[
    'text' => 'Находишь старый подземный архив правительства. Внутри тысячи серверов, но большая часть уничтожена временем.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'Запускаешь резервный сервер. В нём сохранились документы о последних днях старого мира.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,6)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] используется системой охлаждения серверов.', 'noResourceText' => 'Без [Вода] сервер перегревается и теряет часть данных.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Находишь старые карты ресурсов и объектов повышенной важности.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,4)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] помогает восстановить интерфейс архива.', 'noResourceText' => 'Без [Изолента] часть карт повреждена.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Архив оказывается заражённым цифровым вирусом старого военного ИИ.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют отключить заражённый сектор.', 'noResourceText' => 'Без [Инструменты] система повреждает оборудование.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['chips'=>NC($l,1)];}],

            ['text' => 'Автоматическая система обороны считает тебя захватчиком архива.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.11];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] помогает отвлечь старые механизмы.', 'noResourceText' => 'Без [Железо] получаешь повреждения от защиты.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.06];}],

            ['text' => 'Изучаешь архивные документы. Большинство информации уже никому не пригодится, но знания бесценны.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,5)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] используется для защиты оборудования от влаги.', 'noResourceText' => 'Без [Дерево] часть носителей портится.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],

[
    'text' => 'В пустынной зоне находишь огромный военный транспортный корабль. Он упал сюда ещё во время последней фазы войны.',
    'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'В грузовом отсеке находишь герметичные ящики с военным оборудованием.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(2,4),'chips'=>C($l,4)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют открыть армейские замки.', 'noResourceText' => 'Без [Инструменты] удаётся открыть только часть контейнеров.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Извлекаешь боевой компьютер корабля. В памяти сохранились координаты старых баз.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6),'exp'=>E($l,4)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] позволяет запустить повреждённый компьютер.', 'noResourceText' => 'Без [Изолента] данные читаются частично.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Внутри корабля просыпается аварийный боевой ИИ.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.12];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] используется как приманка для системы наведения.', 'noResourceText' => 'Без [Железо] ИИ атакует напрямую.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.06];}],

            ['text' => 'Из отсеков экипажа выходят заражённые выжившие, превратившиеся в мутантов.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] помогает заблокировать двери отсеков.', 'noResourceText' => 'Без [Дерево] существа окружают тебя.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],

            ['text' => 'Разбираешь обломки корабля. Среди металла находишь редкие сплавы.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,3),'itemCount'=>rangeInt(0,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] помогает снять броневые элементы.', 'noResourceText' => 'Без [Железо] большая часть металла бесполезна.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],
[
    'text' => 'Под землёй находишь старую станцию метро будущего. Когда-то здесь ходили автономные поезда, но теперь тоннели заполнены водой и мутантами.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [
            ['text' => 'Находишь технический вагон. Внутри сохранились инструменты инженеров.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(1,3),'exp'=>E($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] очищает систему фильтрации вагона — открывается скрытый отсек.', 'noResourceText' => 'Без [Вода] часть найденных инструментов повреждена.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Запускаешь старый навигационный компьютер метро и получаешь карту безопасных туннелей.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,4),'chips'=>C($l,4)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] позволяет восстановить экран терминала.', 'noResourceText' => 'Без [Изолента] карта появляется частично.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Из воды появляются слепые мутанты, которые жили в тоннелях десятки лет.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] позволяет закрыть проход и оторваться от существ.', 'noResourceText' => 'Без [Дерево] мутанты окружают тебя.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],

            ['text' => 'Старый поезд внезапно запускается. Автоматическая система безопасности считает тебя пассажиром без допуска.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют аварийно открыть двери.', 'noResourceText' => 'Без [Инструменты] поезд запирает тебя внутри.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],

            ['text' => 'Осматриваешь заброшенные вагоны. Большинство вещей сгнило, но некоторые детали можно забрать.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,2),'chips'=>C($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] помогает снять металлические панели.', 'noResourceText' => 'Без [Железо] панели ломаются и становятся бесполезны.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],

[
    'text' => 'На окраине мёртвого города замечаешь старый сервисный дрон. Он лежит среди обломков уже несколько десятилетий, но его камера всё ещё мигает.',
    'type' => 'story', 'noAutoBranch' => true, 'branch' => [
        'prompt' => '', 'outcomes' => [

            ['text' => 'Перезапускаешь дрон. В памяти сохранился маршрут военного каравана с координатами тайников.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,3)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] восстанавливает повреждённую проводку камеры.', 'noResourceText' => 'Без [Изолента] изображение помехами, но часть маршрута удаётся увидеть.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Заряжаешь аккумулятор дрона. Искусственный интеллект благодарит тебя и передаёт старый технический код доступа.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,4)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] используется системой охлаждения батареи.', 'noResourceText' => 'Без [Вода] аккумулятор быстро выходит из строя.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],

            ['text' => 'Дрон распознаёт оружие и активирует защитный режим. Маленький разведчик превращается во врага.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] позволяют вскрыть корпус и отключить боевой модуль.', 'noResourceText' => 'Без [Инструменты] приходится уничтожать дрон силой.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],

            ['text' => 'Дрон передаёт сигнал неизвестному владельцу. Через несколько минут появляются вооружённые мародёры.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] помогает быстро замаскировать следы стоянки.', 'noResourceText' => 'Без [Дерево] враги находят твой лагерь.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],

            ['text' => 'Разбираешь корпус дрона. Из-за возраста часть деталей ломается, но кое-что можно забрать.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(1,2),'chips'=>C($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] помогает снять редкие сплавы корпуса.', 'noResourceText' => 'Без [Железо] корпус разваливается — остаются только мелкие детали.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
        ],
    ],
],
    [
        'text' => 'Брошенная машина скорой помощи. Внутри — медицинские шкафчики. Часть разграблена, но в одном ящике находишь бинты и препараты.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Осматриваем шкафчики — находим медикаменты и бинты.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.12),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] восполняют запас — перевязываем старые раны.', 'noResourceText' => 'Без [Вода] бинты ветхие — часть препаратов рассыпалась.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Проверяем аккумулятор — бортовой компьютер подаёт признаки жизни.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,1)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] оживляют экран — находим координаты других машин.', 'noResourceText' => 'Без [Изолента] экран погас — ценная информация потеряна.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В кузове прячется мародёр — вооружён и агрессивен.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] воспламеняются — факелом отпугиваем мародёра.', 'noResourceText' => 'Без [Инструменты] мародёр успевает выстрелить — пуля задевает плечо.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Под сиденьем — грязные бинты со следами инфекции.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] сжигают заражённые бинты — инфекция уничтожена.', 'noResourceText' => 'Без [Дерево] трогаем заражённые бинты руками — риск заражения.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Разбираем салон на запчасти — шприцы, ампулы, трубки.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] стерилизуют инструменты — сохраняем часть медикаментов.', 'noResourceText' => 'Без [Железо] ампулы бьются — теряем лекарства.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return ['itemCount'=>-1];}],
            ],
        ],
    ],
    [
        'text' => 'Старый рюкзак висит на ветке. Хозяин не вернулся. Внутри — запаянный контейнер с продовольствием и карта местности с пометками.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем рюкзак и изучаем карту — ценные ориентиры.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(1,2),'chips'=>C($l,5),'exp'=>E($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] утоляют жажду — ясно мыслим, карта открывает тайники.', 'noResourceText' => 'Без [Вода] карта выцвела — разбираем пометки с трудом.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Вскрываем контейнер с продовольствием — пайки в сохранности.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.06),'itemCount'=>1];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] дополняют рацион — запасаемся на неделю вперёд.', 'noResourceText' => 'Без [Изолента] половина пайков оказалась испорченной.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'К ветке привязана сигнальная граната — дёргаем за верёвку.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] питают фонарь — замечаем растяжку вовремя.', 'noResourceText' => 'Без [Инструменты] в темноте не замечаем гранату — взрыв контузит.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'В рюкзаке — личные вещи хозяина и предсмертная записка.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] заворачиваем вещи — относимся с уважением, находим зацепку.', 'noResourceText' => 'Без [Дерево] роняем вещи — теряем улики о хозяине.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Обыскиваем окрестности в поисках других закладок хозяина.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'exp'=>E($l,3)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] отмечают деревья — находим ещё один схрон.', 'noResourceText' => 'Без [Железо] сбиваемся со следа — уходим ни с чем.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Разбитый дрон лежит в овраге. Его аккумулятор ещё цел. Рядом валяются микросхемы и несколько чипов памяти.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем аккумулятор и память — ценные компоненты.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] заряжают уцелевший модуль — считываем дополнительные данные.', 'noResourceText' => 'Без [Вода] модуль разряжен — данные потеряны.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Разбираем корпус на запчасти — микрочипы и провода.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,2),'exp'=>E($l,3)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] изолируют контакты — микросхемы остаются целыми.', 'noResourceText' => 'Без [Изолента] микросхемы выгорают от замыкания.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Дрон запрограммирован на самоуничтожение — запускается таймер.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] обезвреживают детонатор — успеваем отбежать.', 'noResourceText' => 'Без [Инструменты] взрывная волна настигает — ожоги и контузия.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'В дроне застрял передатчик — подаёт сигнал хозяевам.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] глушат передатчик — сигнал не уходит в эфир.', 'noResourceText' => 'Без [Дерево] хозяева дрона засекают нас — погоня.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Пытаемся восстановить дрон — нужны запчасти и время.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] усиливают каркас — дрон временно работает.', 'noResourceText' => 'Без [Железо] дрон разваливается — всё впустую.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Высохшее русло ручья. На песке — человеческие кости и полуистлевший мешок. Внутри — коробка с инструментами и несколько старых монет (предметы старины ценятся у коллекционеров).',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Осторожно извлекаем коробку — инструменты в отличном состоянии.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(1,2),'chips'=>C($l,5)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] смазывают механизмы — инструменты блестят как новые.', 'noResourceText' => 'Без [Вода] инструменты проржавели — половину в утиль.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Промываем монеты в ручье — проступает коллекционная ценность.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,6)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] отмачивают вековую грязь — монеты как новенькие.', 'noResourceText' => 'Без [Изолента] монеты тусклые — оценщик даёт лишь половину цены.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Кости принадлежат не человеку — мутант затаился в песке.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,1)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] набрасываем на морду — мутант слепнет, уходим.', 'noResourceText' => 'Без [Инструменты] мутант атакует первым — рваная рана на ноге.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Мешок рассыпается при прикосновении — содержимое падает в ил.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] подхватывают падающие вещи — спасаем большую часть.', 'noResourceText' => 'Без [Дерево] вещи тонут в иле — потеряны навсегда.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'В русле чувствуется запах газа — возможно, утечка из труб.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.04),'exp'=>E($l,3)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] детонируют газ — отвлекаем мутантов и уходим с добычей.', 'noResourceText' => 'Без [Железо] газ скапливается — при взрыве получаем ожоги.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.03,0.04)];}],
            ],
        ],
    ],
    [
        'text' => 'Бункер с сорванной дверью. Внутри — пустые стеллажи, но в углу, под грудой тряпья, находишь маленький сейф. В сейфе — чипы данных.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вскрываем сейф — чипы данных в идеальном состоянии.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,4)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] питают дешифратор — чипы читаются без ошибок.', 'noResourceText' => 'Без [Вода] дешифратор глохнет — часть данных потеряна.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Обыскиваем стеллажи — в щелях завалялись патроны.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(1,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] восстанавливают силы — находим схрон под полом.', 'noResourceText' => 'Без [Изолента] голод кружит голову — пропускаем тайник.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В бункере кто-то живёт — доносится кашель из темноты.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] дезинфицируют воздух — кашель стихает, жилец мёртв.', 'noResourceText' => 'Без [Инструменты] жилец оказывается заражённым — атака мутанта.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Тряпьё под сейфом скрывает мину-ловушку.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] прикрывают от осколков — ловушка срабатывает впустую.', 'noResourceText' => 'Без [Дерево] осколки пластика впиваются в ноги — хромаем.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Пытаемся взломать сейф грубой силой — рискуем повредить чипы.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] поддевают замок — сейф открывается без повреждений.', 'noResourceText' => 'Без [Железо] сейф заклинивает — чипы повреждаются.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return ['chips'=>NC($l,1)];}],
            ],
        ],
    ],
    [
        'text' => 'Упавший транспортный вертолёт. Обшивка прогорела, но грузовой отсек уцелел. Военные ящики раскрыты, но в одном находишь нераспечатанный контейнер с боеприпасами.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вскрываем контейнер — боеприпасы в герметичной упаковке.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(2,4),'chips'=>C($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] вскрывают армейскую упаковку — внутри второй слой.', 'noResourceText' => 'Без [Вода] упаковка не поддаётся — бросаем, теряя боеприпасы.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Сливаем остатки топлива из баков вертолёта.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] пригодится для обогрева — ночь будет холодной.', 'noResourceText' => 'Без [Изолента] баки пусты — даже паров не осталось.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Обшивка вертолёта рушится — едва успеваем отскочить.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] подкрепляют укрытие — обломки не задевают нас.', 'noResourceText' => 'Без [Инструменты] обшивка падает на спину — ушиб позвоночника.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Из грузового отсека выползает раненый мутант.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] перевязывают старые раны — мутант ослаблен, победа легка.', 'noResourceText' => 'Без [Дерево] мутант в ярости от боли — получаем тяжёлые раны.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Разбираем приборную панель на запчасти.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] усиливают рычаги — снимаем панель целиком.', 'noResourceText' => 'Без [Железо] провода рвутся — приборы разбиваются вдребезги.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Старый торговый автомат, перекошенный набок. Пара монет внутри — и он выдаёт банку газировки, пролежавшую там лет двадцать. На удивление, пить можно.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Запускаем автомат — он выдаёт несколько банок.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05),'chips'=>C($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] дают заряд — автомат работает без перебоев.', 'noResourceText' => 'Без [Вода] автомат глохнет после первой банки.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Вскрываем автомат монтировкой — внутри запас мелочи.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'itemCount'=>1];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] поддевают замок — ящик с монетами открывается.', 'noResourceText' => 'Без [Изолента] автомат не поддаётся — монеты остаются внутри.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Автомат оказывается подключён к растяжке — дёргаем за ручку.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,1)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] глушат взрыв — автомат разлетается, но мы целы.', 'noResourceText' => 'Без [Инструменты] осколки пластика режут лицо и руки.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Газировка оказывается просроченной — начинается расстройство.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05,'healPercent'=>-RF(0.02,0.03)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] нейтрализуют токсины — отделываемся лёгким недомоганием.', 'noResourceText' => 'Без [Дерево] сильное отравление — рвота и слабость.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Пытаемся вытащить автомат целиком — слишком тяжёлый.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E(1,2),'damagePercent'=>RF(0.01,0.03)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] смазывают колёса — автомат катится, грузим на тележку.', 'noResourceText' => 'Без [Железо] автомат падает на ногу — перелом пальцев.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-RF(0.01,0.02)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.03)];}],
            ],
        ],
    ],
    [
        'text' => 'Мастерская оружейника. Хозяин давно мёртв, инструменты проржавели, но в тайнике под верстаком лежат запчасти для оружия и патроны.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем тайник — запчасти и патроны в смазке.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(1,3),'chips'=>C($l,4)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] восстанавливают верстак — ремонтируем найденное оружие.', 'noResourceText' => 'Без [Вода] запчасти ржавые — половина в металлолом.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Осматриваем тайник — находим чертежи оружия.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,3)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] фиксируют детали — чертежи читаемы, продаём дорого.', 'noResourceText' => 'Без [Изолента] чертежи рассыпаются в труху — информация потеряна.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Под верстаком — крысиное гнездо, мутированные твари.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06,'chips'=>NC($l,1)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] отрезают путь крысам — успеваем запереть их в углу.', 'noResourceText' => 'Без [Инструменты] крысы вцепляются в руку — рваные раны и инфекция.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'В мастерской — химические реактивы, некоторые протекают.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] изолируют кислоту — ожоги минимальны.', 'noResourceText' => 'Без [Дерево] кислота разъедает кожу — химический ожог.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Разбираем станки на запчасти — металл и механизмы.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] идут на растопку — спасаем часть деревянных деталей.', 'noResourceText' => 'Без [Железо] станки гнилые — механизмы разрушаются.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return ['itemCount'=>-1];}],
            ],
        ],
    ],
    [
        'text' => 'Среди камней — свежий схрон. Кто-то оставил припасы и записку: «Если ты это читаешь — я уже мёртв. Забирай, пригодится».',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Забираем припасы — консервы и вода в целости.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(1,2),'chips'=>C($l,5)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] пополняют запас — хватит на долгий переход.', 'noResourceText' => 'Без [Вода] припасы частично испорчены — съедобного меньше.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Ищем зацепки по записке — возможно, тайник не единственный.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,5),'chips'=>C($l,3)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] утоляют жажду — в записке скрытый шифр.', 'noResourceText' => 'Без [Изолента] записка выцвела — шифр не разобрать.', 'resourceEffects' => function($z,$l){return ['exp'=>E(1,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В схроне — мина-сюрприз для незваных гостей.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] детектируют мину — обезвреживаем и забираем трофеи.', 'noResourceText' => 'Без [Инструменты] мина взрывается — контузия и потеря припасов.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Труп хозяина схрона — не успел уйти, умер от ран.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.04,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] накрывают тело — отдаём последнюю дань, находим ключ.', 'noResourceText' => 'Без [Дерево] оставляем тело — моральный удар, теряем улики.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.02];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Роемся в записках — координаты других точек в округе.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C(1,2),'exp'=>E(1,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] снимают боль — понимаем почерк автора, декодируем маршрут.', 'noResourceText' => 'Без [Железо] почерк нечитаем — точки потеряны навсегда.', 'resourceEffects' => function($z,$l){return ['exp'=>E(1,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Упавший квадрокоптер с камерой. Карта памяти цела. На ней — координаты трёх тайников. Продаёшь данные торговцу информацией.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Считываем карту памяти — координаты чёткие, тайники реальны.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,4)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] питают ридер — карта открывается, данных больше.', 'noResourceText' => 'Без [Вода] карта не читается — теряем часть координат.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Восстанавливаем повреждённые файлы на карте.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'itemCount'=>1];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] изолируют плату — файлы не битые, цена выше.', 'noResourceText' => 'Без [Изолента] файлы повреждены — торговец даёт лишь половину.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Квадрокоптер подаёт сигнал бедствия — хозяева ищут его.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06,'chips'=>NC($l,1)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] ремонтируют передатчик — меняем сигнал на ложный.', 'noResourceText' => 'Без [Инструменты] хозяева засекают нас — вооружённая группа на подходе.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'На карте — ловушка: координаты ведут в засаду.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] чинят навигатор — обходим засаду по другой дороге.', 'noResourceText' => 'Без [Дерево] попадаем в ловушку — обстрел и потеря снаряжения.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Разбираем коптер на детали — пропеллеры и камера.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] усиливают корпус — детали не ломаются при разборе.', 'noResourceText' => 'Без [Железо] детали хрупкие — половина идёт в брак.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Ржавый автобус лежит на боку. В багажном отсеке — чемодан с одеждой и личные вещи. В подкладке пиджака зашита пачка чипов.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вскрываем чемодан — одежда и скрытые чипы в целости.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] вспарывают подкладку — чипы не повреждены иглой.', 'noResourceText' => 'Без [Вода] рвём подкладку в спешке — чипы теряются.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Роемся в личных вещах — находим драгоценности.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(1,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] заправляют горелку — свет выявляет тайник в обшивке.', 'noResourceText' => 'Без [Изолента] в темноте пропускаем драгоценности.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Автобус оседает — конструкция не выдерживает веса.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] укрепляют проход — выбираемся до обрушения.', 'noResourceText' => 'Без [Инструменты] застреваем в груде металла — царапины и ушибы.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'В автобусе — труп водителя с ключ-картой доступа.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05,'chips'=>C($l,3)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] стерилизуют руки — осматриваем тело без риска.', 'noResourceText' => 'Без [Дерево] тело заражено — получаем инфекцию.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.02];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Собираем разбросанные вещи по всему салону.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'exp'=>E($l,3)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] смывают кровь — вещи выглядят презентабельно.', 'noResourceText' => 'Без [Железо] вещи в крови — продать не получится.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'На спутниковой тарелке висит рюкзак десантника. Внутри — НЗ, аптечка, карта с координатами эвакуационного дроп-пойнта. Картой можно торговать.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Снимаем рюкзак — содержимое в герметичных упаковках.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(1,2),'chips'=>C($l,5),'exp'=>E($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] заряжают маячок — находим базу десантников.', 'noResourceText' => 'Без [Вода] маячок мёртв — маршрут обрывается.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Изучаем аптечку — медикаменты армейского образца.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.05,0.10),'itemCount'=>1];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] стягивают рану — аптечка используется максимально эффективно.', 'noResourceText' => 'Без [Изолента] бинты старые — повязка держится плохо.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.03,0.04)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Рюкзак заминирован — десантники не хотели отдавать припасы.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] детонируют мину в безопасном направлении.', 'noResourceText' => 'Без [Инструменты] взрыв разрывает рюкзак и наши руки.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'С тарелки нас замечает патруль — открывают огонь.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] наполняют флягу — утоляем жажду, ускоряемся в беге.', 'noResourceText' => 'Без [Дерево] обезвоживание замедляет — пули свистят рядом.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Пытаемся взобраться выше — вдруг на тарелке ещё что-то есть.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.03),'exp'=>E($l,3)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] придают сил — забираемся на самый верх, находим тайник.', 'noResourceText' => 'Без [Железо] срываемся с высоты — ушиб спины.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.02,0.03)];}],
            ],
        ],
    ],
    [
        'text' => 'Контейнер, сброшенный с дрона-снабженца. Частично разбит, но внутри — вакуумные упаковки с армейским пайком и сухой паёк.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вскрываем вакуумные упаковки — пайки свежие, съедобные.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.06,0.12),'itemCount'=>1,'chips'=>C($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] разбавляют сухой паёк — еда сытнее и вкуснее.', 'noResourceText' => 'Без [Вода] паёк слишком сухой — давимся, но едим.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Проверяем герметичность — часть упаковок повреждена.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] смывают грязь — определяем срок годности.', 'noResourceText' => 'Без [Изолента] упаковки вздуты — пайки испорчены.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Контейнер привлёк мутантов — они уже рядом.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] обрабатывают раны — мутанты чуют кровь, но атака слабее.', 'noResourceText' => 'Без [Инструменты] мутанты нападают стаей — множественные укусы.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'В контейнере — тревожный маячок, подаёт сигнал.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] глушат маячок — сигнал не уходит в эфир.', 'noResourceText' => 'Без [Дерево] маячок засекают — с минуты на минуту будет погоня.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Разбираем контейнер на материалы — пластик и металл.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,1),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] отделяют утеплитель — материал качественный, продаём дорого.', 'noResourceText' => 'Без [Железо] утеплитель крошится — материал в мусор.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Рыболовная сеть, застрявшая в корягах. В ней — дохлая рыба и мусор, но среди грязи блестит металл: старый нож и несколько монет.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем нож и монеты — отличная добыча.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,5)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] вытирают нож — лезвие блестит, острое как бритва.', 'noResourceText' => 'Без [Вода] нож в грязи — лезвие тусклое, цена ниже.', 'resourceEffects' => function($z,$l){return ['chips'=>C(1,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Разматываем сеть в поисках других трофеев.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] разрезают узлы — сеть распутывается быстро.', 'noResourceText' => 'Без [Изолента] узлы гнилые — рвём сеть, теряем трофеи.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В сети — живая мутированная рыба, агрессивная.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] отбрасывают рыбу — отделываемся мокрой одеждой.', 'noResourceText' => 'Без [Инструменты] рыба кусает за руку — глубокая рана.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Коряги под сетью подгнили — берег рушится в воду.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] фиксируют коряги — успеваем спасти трофеи.', 'noResourceText' => 'Без [Дерево] падаем в воду с трофеями — часть тонет.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Чистим рыбу от грязи — возможно, часть съедобна.', 'weight' => 15, 'effects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04),'damagePercent'=>RF(0.01,0.02)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] отделяют съедобное от гнили — ужин обеспечен.', 'noResourceText' => 'Без [Железо] вся рыба тухлая — выбрасываем с досадой.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Стенд с инструментами на автозаправке. Большая часть украдена, но на верхней полке лежит забытый набор отвёрток и мультиметр. Хозяевам уже не пригодятся.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Забираем инструменты — отвёртки и мультиметр в работе.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(1,2),'exp'=>E($l,3)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] дополняют набор — находим скрытые ящики с запчастями.', 'noResourceText' => 'Без [Вода] инструменты некомплектны — часть бесполезна.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Проверяем мультиметр — он работает, можно торговать.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] калибруют мультиметр — цена продажи выше.', 'noResourceText' => 'Без [Изолента] мультиметр врёт — торговец даёт копейки.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Стенд рушится от ветхости — едва уворачиваемся.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06,'chips'=>NC($l,1)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] подхватывают инструменты — ничего не разбито.', 'noResourceText' => 'Без [Инструменты] инструменты падают в грязь — половина сломана.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Из-за стойки выбегает мутант — охранял заправку.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] набрасываются на морду — мутант слепнет, убегает.', 'noResourceText' => 'Без [Дерево] мутант вцепляется в горло — глубокая рваная рана.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Осматриваем заправку в поисках топлива в цистернах.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] пригодятся для ремонта насоса — выкачиваем остатки.', 'noResourceText' => 'Без [Железо] насос сломан — топливо недоступно.', 'resourceEffects' => function($z,$l){return ['chips'=>C(1,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Брошенный военный УАЗик. Колеса спущены, аккумулятор мёртв, но в бардачке — карта местности и кобура с пистолетом. Револьвер старого образца, но стреляет.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Забираем пистолет и карту — револьвер в смазке, боеспособен.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>2,'chips'=>C($l,5)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] заправляют бак — УАЗик заводится, используем как тягач.', 'noResourceText' => 'Без [Вода] УАЗик мёртв — разбираем на запчасти.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Осматриваем кузов — ящик с патронами под сиденьем.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(1,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] оживляют фару — видим схрон в багажнике.', 'noResourceText' => 'Без [Изолента] темно — пропускаем ящик с патронами.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В УАЗике — медвежий капкан, оставленный браконьерами.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.09,'chips'=>NC($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] обезвреживают капкан — снимаем и забираем как трофей.', 'noResourceText' => 'Без [Инструменты] капкан ловит ногу — перелом и боль.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Из кабины вылетает рой мутированных ос.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] защищают лицо — укусы приходятся на одежду.', 'noResourceText' => 'Без [Дерево] осы жалят в лицо — отёк и боль.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Пытаемся отбуксировать УАЗик к базе — тяжёлый, но ценный.', 'weight' => 15, 'effects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.03),'chips'=>C($l,3)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] останавливают кровь — тащим УАЗик, несмотря на боль.', 'noResourceText' => 'Без [Железо] бросаем УАЗик — сил не хватает.', 'resourceEffects' => function($z,$l){return ['chips'=>C(1,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Труп сталкера в странной позе. Рядом — пустая фляга и дневник. В дневнике — записи о «пятом измерении» и код от сейфа в его убежище. Координаты убежища указаны.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Забираем дневник — код от сейфа и координаты убежища.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,4),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] освежают разум — шифр в дневнике расшифровывается легко.', 'noResourceText' => 'Без [Вода] от жажды мысли путаются — половина кода нечитаема.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Обыскиваем труп — находим спрятанный на теле чип.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] восстанавливают силы — обыск тщательный, чип найден.', 'noResourceText' => 'Без [Изолента] от голода пропускаем тайник на поясе.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Сталкер заражён — труп мутирует у нас на глазах.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.10,'chips'=>NC($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] добивают мутанта — током обезвреживаем тушу.', 'noResourceText' => 'Без [Инструменты] мутант оживает и атакует — рваные раны.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.05];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Запах сталкера привлекает хищников поблизости.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] маскируют запах — хищники проходят мимо.', 'noResourceText' => 'Без [Дерево] хищники находят нас — схватка в чаще.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Захораниваем сталкера по-человечески — моральный долг.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E(1,3),'damagePercent'=>RF(0.01,0.02)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] укрывают могилу — находим зарытый сталкером тайник.', 'noResourceText' => 'Без [Железо] могила осыпается — проводим ритуал наспех.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Логово браконьеров. Временное, судя по всему — брошено в спешке. В ящике — разделанная туша кабана и мешок с травами. Мясо можно приготовить, травы целебные.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Забираем мясо и травы — сытный ужин и лекарства обеспечены.', 'weight' => 20, 'effects' => function($z,$l){return ['healPercent'=>RF(0.08,0.14),'itemCount'=>1];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] консервируют мясо — запас на неделю вперёд.', 'noResourceText' => 'Без [Вода] мясо пропадает за день — часть в утиль.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.03,0.05)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Сортируем травы — определяем целебные свойства.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] дополняют травяной сбор — сила лекарства растёт.', 'noResourceText' => 'Без [Изолента] травы горчат — половина несъедобна.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Браконьеры вернулись — мы застали их врасплох.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] скрывают нас — браконьеры проходят мимо, не заметив.', 'noResourceText' => 'Без [Инструменты] браконьеры открывают огонь — пулевое ранение.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'В логове — ловушка на дичь, срабатывает на нас.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.05,'chips'=>NC($l,1)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] фиксируют петлю — ловушка не затягивается на ноге.', 'noResourceText' => 'Без [Дерево] петля захлёстывает щиколотку — висим вверх ногами.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Разбираем логово на стройматериалы — доски и шкуры.', 'weight' => 15, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(0,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] укрепляют конструкции — материал качественный, не гнилой.', 'noResourceText' => 'Без [Железо] доски трухлявые — только на растопку.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return ['itemCount'=>-1];}],
            ],
        ],
    ],
    [
        'text' => 'Почтовый вагон, сошедший с рельсов. Мешки с корреспонденцией рассыпаны по откосу. Газеты, письма, бандероли. Кое-где торчат наклейки с адресами — можно найти координаты других сталкеров.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вскрываем посылку — {item} в идеальном состоянии.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>rangeInt(1,3),'chips'=>C($l,4),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] распаковывают бережно — {item} не повреждены.', 'noResourceText' => 'Без [Вода] пузырчатка рвётся — часть {item} выпадает.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Роемся в письмах — находим ценные сведения и карты.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,3)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] отделяют письма — документы не рассыпаются.', 'noResourceText' => 'Без [Изолента] письма слипаются — половина текста нечитаема.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Вагон завален — при попытке залезть рушится крыша.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,1)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] амортизируют удар — крыша не пробивает голову.', 'noResourceText' => 'Без [Инструменты] удар обломком по голове — сотрясение.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'В посылке — битое стекло вместо {item}. Подстава.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.08,'chips'=>NC($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] защищают руки — порезы минимальны.', 'noResourceText' => 'Без [Дерево] стекло режет ладони — глубокие порезы.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.04];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Собираем марки и конверты — коллекционная ценность.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E(1,2),'chips'=>C(1,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] разделяют марки — коллекция в идеале, цена высокая.', 'noResourceText' => 'Без [Железо] марки рвутся — коллекция потеряна.', 'resourceEffects' => function($z,$l){return ['chips'=>C(1,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Сейф в полу разрушенного банка. Дверца снесена взрывом, внутри пусто. Но в щели застрела монета — редкая, коллекционная. У нумизматов пойдёт за чипы.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаем монету — редкий экземпляр, почти не повреждён.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,5),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] очищают монету без царапин — цена максимальная.', 'noResourceText' => 'Без [Вода] монета царапается — цена падает вдвое.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Обыскиваем пол вокруг сейфа — рассыпанные чипы в пыли.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'itemCount'=>1];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] цепляют мелочь — собираем все чипы до последнего.', 'noResourceText' => 'Без [Изолента] половина чипов теряется в трещинах пола.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В сейфе — заклинившая ячейка. При вскрытии срабатывает кислота.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.06,'chips'=>NC($l,1)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] питают вентиляцию — кислота уходит в вытяжку.', 'noResourceText' => 'Без [Инструменты] кислота разъедает руки — химические ожоги.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.04];}],
                ['text' => 'Из темноты банка доносится рык — сторожевой мутант.', 'weight' => 20, 'effects' => function($z,$l){return ['damagePercent'=>0.07,'chips'=>NC($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] заживляют царапины — мутант слабее, чем кажется.', 'noResourceText' => 'Без [Дерево] мутант наносит глубокие раны — кровь и боль.', 'resourceEffects' => function($z,$l){return ['damagePercent'=>-0.03];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>0.05];}],
                ['text' => 'Пытаемся взломать соседнюю ячейку сейфа — вдруг там ещё что-то.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E(1,2),'damagePercent'=>RF(0.01,0.02)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] отделяют обшивку — ячейка открыта, внутри редкие чипы.', 'noResourceText' => 'Без [Железо] обшивка не поддаётся — ячейка навсегда закрыта.', 'resourceEffects' => function($z,$l){return ['chips'=>C(1,1)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'На обочине стоит разбитый военный грузовик. Кузов вскрыт, но под сиденьем — уцелевший ящик с маркировкой «Боеприпасы». Рядом валяются гильзы и обрывки карт.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Вскрываешь ящик инструментами — внутри патроны и сухпай. Боезапас пополнен.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] снимают крышку без шума — внутри ещё и довоенный компас.', 'noResourceText' => 'Без [Инструменты] крышку срываешь с грохотом — часть патронов рассыпалась.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В кабине — карта с отметками складов. Топливо для генератора было бы кстати.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}, 'resourceCost' => 'Топливо', 'resourceText' => '[Топливо] заправляет канистру из бака — генератор заводится, открывается тайный отсек.', 'noResourceText' => 'Без [Топливо] карта есть, но добраться до складов — пешком.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В кузове — рассыпанные консервы. Часть пробита осколками, но много целых.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Консервы', 'resourceText' => '[Консервы] сортируешь — целые в рюкзак, пробитые на обед.', 'noResourceText' => 'Без [Консервы] берёшь только целые — меньше объём.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Под капотом — аккумулятор. Если он жив, можно забрать для зарядки.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,3)];}, 'resourceCost' => 'Батарейки', 'resourceText' => '[Батарейки] оживляют аккумулятор — радио в кабине играет довоенные песни.', 'noResourceText' => 'Без [Батарейки] аккумулятор мёртв — сдаёшь в металлолом.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В ящике с инструментами — моток изоленты и запасные детали.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,2),'itemCount'=>1,'chips'=>C($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] пригодится для ремонта — находишь под сиденьем аптечку.', 'noResourceText' => 'Без [Изолента] просто забираешь детали — мелочь, но полезно.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.03)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Заброшенная аптека с выбитыми витражами. Полки пусты, но за фармацевтической стойкой — закрытая дверь в подсобку. Замок простой, внутри слышен писк крыс.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'В подсобке — шкаф с лекарствами. Большая часть испорчена, но кое-что уцелело.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Лекарства', 'resourceText' => '[Лекарства] сортируешь — находишь антибиотики и обезболивающее в герметичных упаковках.', 'noResourceText' => 'Без [Лекарства] берёшь только то, что выглядит целым — риск отравления.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.05)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'В углу — ящик с хирургическими инструментами. Стерильные, в масле.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] обмениваешь на свои — набор скальпелей в хорошем состоянии.', 'noResourceText' => 'Без [Инструменты] забираешь пинцеты и ножницы — пригодятся в быту.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'За прилавком — коробка с батарейками для медицинского оборудования.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}, 'resourceCost' => 'Батарейки', 'resourceText' => '[Батарейки] тестируешь — половина ещё рабочая. Хорошая находка.', 'noResourceText' => 'Без [Батарейки] коробка пуста — кто-то опередил.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Находишь пластиковый контейнер с просроченными реагентами. Можно переработать.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}, 'resourceCost' => 'Пластмасса', 'resourceText' => '[Пластмасса] тара для хранения — реагенты не протекают, уносишь с собой.', 'noResourceText' => 'Без [Пластмасса] контейнер треснул — реагенты вытекли, запах едкий.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'В стойке — выдвижной ящик с документацией. Внутри — карта с пометками.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] подпорка для двери — можно спокойно изучить карту, отметить маршрут.', 'noResourceText' => 'Без [Дерево] изучаешь карту на ходу — не всё успеваешь запомнить.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Склад стройматериалов на окраине посёлка. Ворота сорваны с петель, внутри — горы пластиковых труб, досок, железных уголков. Ветер свистит в пустых проёмах.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Среди пластиковых труб находишь целую партию водопроводных фитингов.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Пластмасса', 'resourceText' => '[Пластмасса] фитинги меняешь на более редкий сплав — обмен удачный.', 'noResourceText' => 'Без [Пластмасса] забираешь трубы — тяжёлые, но на базе пригодятся.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В углу — аккуратно сложенные доски. Видно, их кто-то приготовил для стройки.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Дерево', 'resourceText' => '[Дерево] подходящего качества — можно взять на укрепление базы.', 'noResourceText' => 'Без [Дерево] доски гнилые — не годятся для стройки.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Ржавый контейнер с металлическими уголками и крепежом.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,3)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] уголки сгодится для каркаса — тяжёлые, но прочные.', 'noResourceText' => 'Без [Железо] уголки проржавели — только в переплавку.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'На верстаке — поломанный шуруповёрт и набор бит. Можно починить.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] чинят шуруповёрт — работает от батареек, которые ты нашёл рядом.', 'noResourceText' => 'Без [Инструменты] шуруповёрт не починить — забираешь только биты.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В подсобке — ящик с батарейками для электроинструмента.', 'weight' => 15, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,3)];}, 'resourceCost' => 'Батарейки', 'resourceText' => '[Батарейки] заряженные — целых четыре штуки. Ценная находка.', 'noResourceText' => 'Без [Батарейки] ящик пуст — батарейки сели или разобрали.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'На поляне лежит сбитый квадрокоптер. Корпус треснул, пропеллер погнут, но камера и модуль управления выглядят целыми. Рядом — парашютная стропа.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Извлекаешь аккумулятор — он уцелел. Можно переставить в другой прибор.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}, 'resourceCost' => 'Батарейки', 'resourceText' => '[Батарейки] подключаешь — дрон подаёт признаки жизни. Камера работает.', 'noResourceText' => 'Без [Батарейки] аккумулятор мёртв — сдашь на запчасти.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Инструментами вскрываешь корпус — внутри микросхемы и провода.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,3)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] аккуратно демонтируют плату — модуль связи цел, можно продать.', 'noResourceText' => 'Без [Инструменты] корпус ломается — микросхемы повреждены.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Пластиковые лопасти можно снять и переделать в крепления.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}, 'resourceCost' => 'Пластмасса', 'resourceText' => '[Пластмасса] идёт на заплатки — лопасти режутся на удобные пластины.', 'noResourceText' => 'Без [Пластмасса] лопасти крошатся — ничего ценного.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Изолентой можно скрепить корпус — дрон будет как новый.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] фиксирует плату — дрон запускается, показывает вид с высоты.', 'noResourceText' => 'Без [Изолента] корпус разваливается — детали теряются.', 'resourceEffects' => function($z,$l){return ['exp'=>E($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Карта памяти в камере уцелела. На ней — записи с разведки.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,4),'chips'=>C($l,2)];}, 'resourceCost' => 'Топливо', 'resourceText' => '[Топливо] для генератора — просматриваешь карту, находишь отмеченный схрон.', 'noResourceText' => 'Без [Топливо] используешь солнечный свет — видно плохо, но несколько координат разобрал.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,4)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Полуразрушенная библиотека. Книги разбросаны, но в подсобке — металлический шкаф. За ним фальшивая стена. За стеной — маленькая комната с сундуком.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'Обматываешь книги изолентой — перетаскиваешь их в рюкзак. Много читать не будешь, но на вес золота.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Изолента', 'resourceText' => '[Изолента] фиксирует стопку книг — находишь между страниц старую купюру.', 'noResourceText' => 'Без [Изолента] книги рассыпаются — берёшь только самые целые.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В сундуке — консервы и сухпай. Кто-то готовился к осаде.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,3),'exp'=>E($l,2)];}, 'resourceCost' => 'Консервы', 'resourceText' => '[Консервы] пополняют запасы — банки герметичные, не вздутые.', 'noResourceText' => 'Без [Консервы] сундук пуст — еду разобрали.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'В ящике стола — старый фонарь и батарейки к нему.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}, 'resourceCost' => 'Батарейки', 'resourceText' => '[Батарейки] оживляют фонарь — свет яркий, видно надписи на стенах. Код от сейфа.', 'noResourceText' => 'Без [Батарейки] фонарь тусклый — надписей не разобрать.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Фальшивая стена держится на гнилых досках. Один удар — проход открыт.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] смачивает гниль — доски размокают, стена рушится без шума.', 'noResourceText' => 'Без [Вода] ломаешь стену с шумом — привлекаешь внимание.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.01,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
                ['text' => 'В шкафу — аптечка первой помощи. Не вскрытая, с инструкцией.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,3)];}, 'resourceCost' => 'Лекарства', 'resourceText' => '[Лекарства] в аптечке — антисептик, бинты, обезболивающее. Бесценная находка.', 'noResourceText' => 'Без [Лекарства] аптечка пуста — кто-то опередил.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.05)];}, 'noResourceEffects' => function($z,$l){return [];}],
            ],
        ],
    ],
    [
        'text' => 'Водонапорная башня одиноко стоит посреди поля. Лестница цела, наверху — площадка с оборудованием. С башни открывается отличный обзор на километры вокруг.',
        'type' => 'loot', 'noAutoBranch' => true, 'branch' => [
            'prompt' => '', 'outcomes' => [
                ['text' => 'В баке — остатки чистой воды. Можно набрать с собой.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Вода', 'resourceText' => '[Вода] из бака пресная и чистая — набираешь полный запас.', 'noResourceText' => 'Без [Вода] ёмкости нет — уходишь с тем, что есть.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.02,0.04)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Дизельный генератор у башни. Если есть топливо — можно запустить.', 'weight' => 20, 'effects' => function($z,$l){return ['exp'=>E($l,2),'chips'=>C($l,3)];}, 'resourceCost' => 'Топливо', 'resourceText' => '[Топливо] оживляет генератор — насос качает воду, внизу открывается люк с припасами.', 'noResourceText' => 'Без [Топливо] генератор молчит — подземный люк не открыть.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,3)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'На площадке — ящик с инструментами сварщика. Внутри электроды и маска.', 'weight' => 20, 'effects' => function($z,$l){return ['chips'=>C($l,4),'exp'=>E($l,2)];}, 'resourceCost' => 'Инструменты', 'resourceText' => '[Инструменты] в наборе качественные — можно починить снаряжение на базе.', 'noResourceText' => 'Без [Инструменты] ящик заклинило — внутри ничего не достать.', 'resourceEffects' => function($z,$l){return ['itemCount'=>1];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Внизу башни — железный контейнер с консервами, заваленный мусором.', 'weight' => 20, 'effects' => function($z,$l){return ['itemCount'=>1,'chips'=>C($l,2),'exp'=>E($l,2)];}, 'resourceCost' => 'Консервы', 'resourceText' => '[Консервы] в контейнере не тронуты — банки целые, этикетки довоенные.', 'noResourceText' => 'Без [Консервы] контейнер пуст — крышка сорвана.', 'resourceEffects' => function($z,$l){return ['chips'=>C($l,2)];}, 'noResourceEffects' => function($z,$l){return [];}],
                ['text' => 'Ржавые заклёпки на башне. Нужно железо, чтобы укрепить конструкцию.', 'weight' => 15, 'effects' => function($z,$l){return ['exp'=>E($l,3),'chips'=>C($l,2)];}, 'resourceCost' => 'Железо', 'resourceText' => '[Железо] укрепляет лестницу — башня становится безопасным укрытием на ночь.', 'noResourceText' => 'Без [Железо] лестница скрипит — рискованно подниматься.', 'resourceEffects' => function($z,$l){return ['healPercent'=>RF(0.01,0.03)];}, 'noResourceEffects' => function($z,$l){return ['damagePercent'=>RF(0.01,0.02)];}],
            ],
        ],
    ],
];
// ---------------------------------------------------------------------------
// Event categories — 12 categories matching client
// Some templates are plain strings (use generic auto-branch),
// others are rich objects with custom hand-crafted branches.
// ---------------------------------------------------------------------------
function getEventCategories() {
    global $COMBAT_TEXTS, $TRADE_TEXTS, $HELP_TEXTS_RICH, $TRAP_TEXTS, $LOOT_TEXTS,
           $DISCOVERY_TEXTS, $ANOMALY_TEXTS, $NPC_TEXTS, $REST_TEXTS,
           $FACTION_TEXTS, $SPECIAL_TEXTS, $BRANCHING_TEXTS,
           $TRAP_TEXTS_RICH, $LOOT_TEXTS_RICH;
    return [
        ['templates' => $COMBAT_TEXTS, 'type' => 'combat', 'weight' => 35],
        ['templates' => $TRADE_TEXTS, 'type' => 'trade', 'weight' => 12],
        ['templates' => $HELP_TEXTS_RICH, 'type' => 'story', 'weight' => 12],
        ['templates' => $TRAP_TEXTS_RICH, 'type' => 'danger', 'weight' => 14],
        ['templates' => $LOOT_TEXTS_RICH, 'type' => 'loot', 'weight' => 18],
        ['templates' => $TRAP_TEXTS, 'type' => 'danger', 'weight' => 6],
        ['templates' => $LOOT_TEXTS, 'type' => 'loot', 'weight' => 8],
        ['templates' => $DISCOVERY_TEXTS, 'type' => 'discovery', 'weight' => 10],
        ['templates' => $ANOMALY_TEXTS, 'type' => 'danger', 'weight' => 5],
        ['templates' => $NPC_TEXTS, 'type' => 'neutral', 'weight' => 12],
        ['templates' => $REST_TEXTS, 'type' => 'heal', 'weight' => 4],
        ['templates' => $FACTION_TEXTS, 'type' => 'neutral', 'weight' => 6],
        ['templates' => $SPECIAL_TEXTS, 'type' => 'discovery', 'weight' => 3],
        ['templates' => $BRANCHING_TEXTS, 'type' => 'neutral', 'weight' => 24],
    ];
}

// ---------------------------------------------------------------------------
// generateExplorationEvent — main server entry point (with items support)
// Handles both plain string templates and rich objects with custom branches.
// ---------------------------------------------------------------------------
function generateExplorationEvent($zoneName, $zoneDifficulty, $zoneFactions, $playerLevel, &$items = null) {
    global $ZONE_DESC;
    $level = $playerLevel ? $playerLevel : 1;
    $faction = count($zoneFactions) > 0 ? $zoneFactions[array_rand($zoneFactions)] : 'Бандиты';
    $zoneDesc = isset($ZONE_DESC[$zoneName]) ? $ZONE_DESC[$zoneName] : $zoneName;
    $cats = getEventCategories();
    $totalWeight = 0;
    foreach ($cats as $c) $totalWeight += $c['weight'];
    $roll = mt_rand() / mt_getrandmax() * $totalWeight;
    $chosenCat = $cats[0];
    foreach ($cats as $cat) {
        $roll -= $cat['weight'];
        if ($roll <= 0) { $chosenCat = $cat; break; }
    }
    $rawTemplate = $chosenCat['templates'][array_rand($chosenCat['templates'])];
    $type = $chosenCat['type'];
    // Handle both plain strings and rich template objects
    if (is_string($rawTemplate)) {
        $text = substitute($rawTemplate, $zoneDesc, $faction);
        $template = ['type' => $type, 'text' => $text];
        $baseEffects = ['exp' => expBase($level), 'chips' => chipsBase($level)];
        $branch = getAutoBranch($template, $zoneName);
        $decision = null;
        $resourceCost = null;
        $resourceHad = null;
        if ($branch) {
            $branchResult = resolveBranch($branch, $zoneName, $level, $items);
            $branchTexts = [];
            foreach ($branchResult['texts'] as $t) $branchTexts[] = substitute($t, $zoneDesc, $faction);
            $decision = $branchTexts[0];
            $resourceCost = $branchResult['resourceCost'];
            $resourceHad = $branchResult['resourceHad'];
            foreach ($branchResult['effects'] as $k => $v) {
                if ($v) $baseEffects[$k] = ($baseEffects[$k] ?? 0) + $v;
            }
            if (isset($baseEffects['healPercent']) && $baseEffects['healPercent'] > 0) {
                $baseEffects['healPercent'] = min($baseEffects['healPercent'], $resourceHad ? 0.15 : 0.05);
            }
            if (isset($baseEffects['damagePercent']) && $baseEffects['damagePercent'] > 0) {
                $baseEffects['damagePercent'] = min($baseEffects['damagePercent'], $resourceHad ? 0.15 : 0.30);
            }
            $text .= " " . implode(' ', $branchTexts);
        } else {
            if (isset($baseEffects['healPercent']) && $baseEffects['healPercent'] > 0) {
                $baseEffects['healPercent'] = min($baseEffects['healPercent'], 0.05);
            }
            if (isset($baseEffects['damagePercent']) && $baseEffects['damagePercent'] > 0) {
                $baseEffects['damagePercent'] = min($baseEffects['damagePercent'], 0.30);
            }
        }
        return [
            'text' => $text, 'type' => $type, 'effects' => $baseEffects,
            'decision' => $decision, 'resourceCost' => $resourceCost, 'resourceHad' => $resourceHad,
        ];
    } else {
        // Rich template object with custom branch
        $text = substitute($rawTemplate['text'], $zoneDesc, $faction);
        $baseEffects = ['exp' => expBase($level), 'chips' => chipsBase($level)];
        $branch = isset($rawTemplate['branch']) ? $rawTemplate['branch'] : null;
        $decision = null;
        $resourceCost = null;
        $resourceHad = null;
        if ($branch) {
            $branchResult = resolveBranch($branch, $zoneName, $level, $items);
            $branchTexts = [];
            foreach ($branchResult['texts'] as $t) $branchTexts[] = substitute($t, $zoneDesc, $faction);
            $decision = $branchTexts[0];
            $resourceCost = $branchResult['resourceCost'];
            $resourceHad = $branchResult['resourceHad'];
            foreach ($branchResult['effects'] as $k => $v) {
                if ($v) $baseEffects[$k] = ($baseEffects[$k] ?? 0) + $v;
            }
            if (isset($baseEffects['healPercent']) && $baseEffects['healPercent'] > 0) {
                $baseEffects['healPercent'] = min($baseEffects['healPercent'], $resourceHad ? 0.15 : 0.05);
            }
            if (isset($baseEffects['damagePercent']) && $baseEffects['damagePercent'] > 0) {
                $baseEffects['damagePercent'] = min($baseEffects['damagePercent'], $resourceHad ? 0.15 : 0.30);
            }
            $text .= " " . implode(' ', $branchTexts);
        } else {
            if (isset($baseEffects['healPercent']) && $baseEffects['healPercent'] > 0) {
                $baseEffects['healPercent'] = min($baseEffects['healPercent'], 0.05);
            }
            if (isset($baseEffects['damagePercent']) && $baseEffects['damagePercent'] > 0) {
                $baseEffects['damagePercent'] = min($baseEffects['damagePercent'], 0.30);
            }
        }
        return [
            'text' => $text, 'type' => $type, 'effects' => $baseEffects,
            'decision' => $decision, 'resourceCost' => $resourceCost, 'resourceHad' => $resourceHad,
        ];
    }
}
