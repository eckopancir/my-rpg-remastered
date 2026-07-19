import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { usePlayerStore } from './playerStore';
import { useInventoryStore } from './inventoryStore';
import {
  generateExplorationEvent, generateMicroExplorationEvent,
  pickLegendaryEvent, type ExplorationEventLog, type LegendaryEventData, type EventEffects,
} from '../data/explorationEvents';
import { generateLoot } from '../engine/loot';
import { GAME_ITEMS } from '../data/GameItems';

export type ExplorationPhase = 'idle' | 'travel_out' | 'exploring' | 'travel_back' | 'complete';

export interface LegendaryState {
  event: LegendaryEventData;
  stageIndex: number;
  rewards: EventEffects;
  autoResolveAfter: number; // ticks until auto-resolve (70/30)
}

interface ExplorationStore {
  isExploring: boolean;
  isInfinite: boolean;
  zoneName: string | null;
  zoneDifficulty: number;
  zoneFactions: string[];
  phase: ExplorationPhase;
  timeLeft: number;
  totalTime: number;
  travelTime: number;
  eventLog: ExplorationEventLog[];
  eventCooldown: number;
  microEventCooldown: number;
  totalChipsGained: number;
  totalExpGained: number;
  totalItemsGained: number;
  sessionItemIds: string[];

  legendary: LegendaryState | null;
  hasTriggeredLegendary: boolean;
  lastTickTimestamp: number;
  expeditionTickCounter: number;
  expeditionStartTimestamp: number;

  handleExplorationDeath: () => void;

  resetExploration: () => void;
  startExploration: (zoneName: string, difficulty: number, factions: string[]) => void;
  cancelExploration: () => void;
  explorationTick: () => void;
  completeExploration: () => void;
  triggerLegendary: (event: LegendaryEventData) => void;
  autoResolveLegendary: () => void;
}

const TEST_HOUR = 60;
const TRAVEL_HOURS = 3;
export const TRAVEL_TIME = TEST_HOUR * TRAVEL_HOURS;
const TOTAL_TIME = TRAVEL_TIME * 3;
const EVENT_COOLDOWN_MIN = 12;
const EVENT_COOLDOWN_MAX = 25;
const MICRO_COOLDOWN_MIN = 5;
const MICRO_COOLDOWN_MAX = 8;

const randCooldown = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const applyEffects = (
  effects: { chips?: number; exp?: number; damage?: number; damagePercent?: number; heal?: number; healPercent?: number; combat?: boolean },
  player: any,
  chipsGained: number,
  expGained: number,
) => {
  let totalDamage = effects.damage || 0;
  if (effects.damagePercent && effects.damagePercent > 0) {
    totalDamage += Math.round(effects.damagePercent * player.stats.maxHp);
  }
  if (totalDamage > 0) {
    const currentHp = player.stats.currentHp;
    const newHp = Math.max(0, currentHp - totalDamage);
    usePlayerStore.setState({ stats: { ...player.stats, currentHp: newHp } });
  }
  let totalHeal = effects.heal || 0;
  if (effects.healPercent && effects.healPercent > 0) {
    totalHeal += Math.round(effects.healPercent * player.stats.maxHp);
  }
  if (totalHeal > 0) {
    const currentHp = player.stats.currentHp;
    const newHp = Math.min(player.stats.maxHp, currentHp + totalHeal);
    usePlayerStore.setState({ stats: { ...player.stats, currentHp: newHp } });
  }
  if (effects.chips && effects.chips !== 0) {
    if (effects.chips > 0) {
      player.addChips(effects.chips);
      chipsGained += effects.chips;
    } else {
      player.spendChips(Math.abs(effects.chips));
      chipsGained += effects.chips;
    }
  }
  if (effects.exp && effects.exp > 0) {
    player.addExp(effects.exp);
    expGained += effects.exp;
  }
  return { chipsGained, expGained, totalDamage, totalHeal, damagePercent: effects.damagePercent, healPercent: effects.healPercent };
};

export const useExplorationStore = create<ExplorationStore>()(
  persist(
    (set, get) => ({
  isExploring: false,
  isInfinite: false,
  zoneName: null,
  zoneDifficulty: 0,
  zoneFactions: [],
  phase: 'idle',
  timeLeft: 0,
  totalTime: 0,
  travelTime: TRAVEL_TIME,
  eventLog: [],
  eventCooldown: 0,
  microEventCooldown: 0,
  totalChipsGained: 0,
  totalExpGained: 0,
  totalItemsGained: 0,
  sessionItemIds: [],

  legendary: null,
  hasTriggeredLegendary: false,
  lastTickTimestamp: 0,
  expeditionTickCounter: 0,
  expeditionStartTimestamp: 0,

  startExploration: (zoneName, difficulty, factions) => {
    const player = usePlayerStore.getState();
    if (player.travel.isTraveling || player.travel.isReturning || player.combat.isFighting) {
      player.addLog('❌ Нельзя начать исследование: ты в пути или в бою.', 'warning');
      return;
    }
    const deathCd = 30 * 1000;
    if (player.explorationDeathTimestamp && Date.now() - player.explorationDeathTimestamp < deathCd) {
      const remaining = Math.ceil((deathCd - (Date.now() - player.explorationDeathTimestamp)) / 60000);
      player.addLog(`💀 Герой ещё не оправился после смерти. Подожди ${remaining} мин.`, 'warning');
      return;
    }
    const isInfinite = zoneName === 'Заброшенная военная база и окрестности';
    set({
      isExploring: true,
      isInfinite,
      zoneName,
      zoneDifficulty: difficulty,
      zoneFactions: factions,
      phase: 'travel_out',
      timeLeft: TRAVEL_TIME,
      totalTime: TOTAL_TIME,
      eventLog: [],
      eventCooldown: 0,
      microEventCooldown: 0,
      totalChipsGained: 0,
      totalExpGained: 0,
      totalItemsGained: 0,
      sessionItemIds: [],
      legendary: null,
      hasTriggeredLegendary: false,
      lastTickTimestamp: Date.now(),
      expeditionStartTimestamp: Date.now(),
      expeditionTickCounter: 0,
    });
    const timeMsg = isInfinite ? 'бесконечное (отмена — 30 сек до базы)' : `${TOTAL_TIME} сек`;
    player.addLog(`🚀 Отправляемся в авто-исследование зоны "${zoneName}". ${timeMsg}.`, 'info');
  },

  resetExploration: () => {
    const player = usePlayerStore.getState();
    if (player.combat.isFighting) {
      usePlayerStore.setState({ combat: { ...player.combat, isFighting: false } });
    }
    set({
      isExploring: false,
      isInfinite: false,
      zoneName: null,
      zoneDifficulty: 0,
      zoneFactions: [],
      phase: 'idle',
      timeLeft: 0,
      totalTime: 0,
      eventLog: [],
      eventCooldown: 0,
      microEventCooldown: 0,
      totalChipsGained: 0,
      totalExpGained: 0,
      totalItemsGained: 0,
      sessionItemIds: [],
      legendary: null,
      hasTriggeredLegendary: false,
      lastTickTimestamp: 0,
      expeditionTickCounter: 0,
      expeditionStartTimestamp: 0,
    });
  },

  cancelExploration: () => {
    const player = usePlayerStore.getState();
    const state = get();
    if (state.isInfinite) {
      if (player.combat.isFighting) {
        usePlayerStore.setState({ combat: { ...player.combat, isFighting: false } });
      }
      player.addLog(`🛑 Возвращение на базу... 30 сек. Добыто: ${state.totalChipsGained}💾, ${state.totalExpGained}⚡.`, 'warning');
      set({ phase: 'travel_back', timeLeft: 30, lastTickTimestamp: Date.now() });
      return;
    }
    let rewardText = '';
    if (state.totalChipsGained > 0 || state.totalExpGained > 0) {
      rewardText = ` Добыто: ${state.totalChipsGained}💾, ${state.totalExpGained}⚡.`;
    }
    player.addLog(`🛑 Авто-исследование прервано. Возврат на базу.${rewardText}`, 'warning');
    if (player.combat.isFighting) {
      usePlayerStore.setState({ combat: { ...player.combat, isFighting: false } });
    }
    set({
      isExploring: false,
      isInfinite: false,
      zoneName: null,
      phase: 'idle',
      timeLeft: 0,
      eventLog: [],
      legendary: null,
      sessionItemIds: [],
    });
  },

  explorationTick: () => {
    const state = get();
    if (!state.isExploring || state.phase === 'complete' || state.phase === 'idle') return;

    // --- 1. Save time first, regardless of what happens next ---
    const newTimeLeft = state.timeLeft - 1;
    set({ timeLeft: newTimeLeft, lastTickTimestamp: Date.now(), expeditionTickCounter: state.expeditionTickCounter + 1 });

    // --- 2. Phase transitions ---
    if (state.phase === 'travel_out' && newTimeLeft <= 0) {
      set({
        phase: 'exploring',
        timeLeft: TRAVEL_TIME,
        eventCooldown: 0,
        lastTickTimestamp: Date.now(),
      });
      return;
    }
    if (state.phase === 'exploring' && newTimeLeft <= 0) {
      if (state.isInfinite) {
        set({ timeLeft: TRAVEL_TIME, lastTickTimestamp: Date.now() });
        return;
      }
      set({ phase: 'travel_back', timeLeft: TRAVEL_TIME, lastTickTimestamp: Date.now() });
      return;
    }
    if (state.phase === 'travel_back' && newTimeLeft <= 0) {
      get().completeExploration();
      return;
    }

    const player = usePlayerStore.getState();

    // Death guard — if hero is already dead, end expedition
    if (state.phase === 'exploring' && player.stats.currentHp <= 0) {
      get().handleExplorationDeath();
      return;
    }

    try {
      // --- 3. Travel stamina drain ---
      if (state.phase === 'travel_out' || state.phase === 'travel_back') {
        player.travelTick();
      }

      // --- 4. Legendary auto-resolve (blocks micro + big events) ---
      if (get().legendary) {
        const leg = get().legendary!;
        if (leg.autoResolveAfter <= 0) {
          get().autoResolveLegendary();
        } else {
          set({ legendary: { ...leg, autoResolveAfter: leg.autoResolveAfter - 1 } });
        }
        return;
      }

      // --- 5. Micro-events ---
      const newMicroCd = state.microEventCooldown - 1;
      if (newMicroCd <= 0) {
        const micro = generateMicroExplorationEvent();
        let microChips = state.totalChipsGained;
        let microExp = state.totalExpGained;
        const r = applyEffects(micro.effects, player, microChips, microExp);
        microChips = r.chipsGained;
        microExp = r.expGained;
        const microLog: ExplorationEventLog = {
          id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: micro.text,
          type: micro.type,
          ts: get().expeditionStartTimestamp + get().expeditionTickCounter * 1000,
          chips: micro.effects.chips,
          exp: micro.effects.exp,
          damage: r.totalDamage || micro.effects.damage,
          damagePercent: r.damagePercent,
          heal: r.totalHeal || micro.effects.heal,
          healPercent: r.healPercent,
          isMicro: true,
        };

        set({
          eventLog: [...get().eventLog, microLog],
          microEventCooldown: randCooldown(MICRO_COOLDOWN_MIN, MICRO_COOLDOWN_MAX),
          totalChipsGained: microChips,
          totalExpGained: microExp,
        });
        if (usePlayerStore.getState().stats.currentHp <= 0) {
          get().handleExplorationDeath();
          return;
        }
      } else {
        set({ microEventCooldown: newMicroCd });
      }

      const newEventCd = state.eventCooldown - 1;
      if (newEventCd <= 0) {
        // First big event of the journey is ALWAYS legendary (for testing)
        if (!get().hasTriggeredLegendary && get().legendary === null) {
          const picked = pickLegendaryEvent();
          if (picked) {
            get().triggerLegendary(picked);
            set({ hasTriggeredLegendary: true });
            return;
          }
        }

        const fresh = get();
        const event = generateExplorationEvent(
          fresh.zoneName || '', fresh.zoneDifficulty, fresh.zoneFactions, player.level,
        );

        let eventItems: any[] = [];
        const newItemIds: string[] = [];
        if (event.effects.itemCount && event.effects.itemCount > 0) {
          eventItems = generateLoot(GAME_ITEMS, player.level);
          eventItems.forEach((item) => {
            useInventoryStore.getState().addItem(item as any);
            newItemIds.push(item.id);
          });
        }

        let chipsGained = fresh.totalChipsGained;
        let expGained = fresh.totalExpGained;
        let itemsGained = fresh.totalItemsGained;
        const r2 = applyEffects(event.effects, player, chipsGained, expGained);
        chipsGained = r2.chipsGained;
        expGained = r2.expGained;

        const logEntry: ExplorationEventLog = {
          id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
          text: event.text,
          type: event.type,
          ts: get().expeditionStartTimestamp + get().expeditionTickCounter * 1000,
          chips: event.effects.chips,
          exp: event.effects.exp,
          damage: r2.totalDamage || event.effects.damage,
          damagePercent: r2.damagePercent,
          heal: r2.totalHeal || event.effects.heal,
          healPercent: r2.healPercent,
          combat: event.effects.combat,
          items: eventItems.length > 0 ? eventItems : undefined,
          decision: event.decision,
        };

        if (eventItems.length > 0) itemsGained += eventItems.length;

        set({
          eventLog: [...get().eventLog, logEntry],
          eventCooldown: randCooldown(EVENT_COOLDOWN_MIN, EVENT_COOLDOWN_MAX),
          totalChipsGained: chipsGained,
          totalExpGained: expGained,
          totalItemsGained: itemsGained,
          sessionItemIds: [...fresh.sessionItemIds, ...newItemIds],
        });
        if (usePlayerStore.getState().stats.currentHp <= 0) {
          get().handleExplorationDeath();
          return;
        }
        return;
      }

      // Decrement big event cooldown (micro already handled above)
      set({ eventCooldown: newEventCd });
    } catch (err) {
      player.addLog(`⚠️ Ошибка обработки события: ${err}`, 'warning');
      set({ eventCooldown: randCooldown(EVENT_COOLDOWN_MIN, EVENT_COOLDOWN_MAX) });
    }
  },

  completeExploration: () => {
    const player = usePlayerStore.getState();
    const state = get();
    const bonusExp = Math.floor(state.zoneDifficulty * 5 + 20);
    const bonusChips = Math.floor(state.zoneDifficulty * 3 + 10);
    player.addExp(bonusExp);
    player.addChips(bonusChips);
    const totalExp = state.totalExpGained + bonusExp;
    const totalChips = state.totalChipsGained + bonusChips;
    const itemsText = state.totalItemsGained > 0 ? `, предметов: ${state.totalItemsGained}` : '';
    player.addLog(
      `🏁 Авто-исследование "${state.zoneName}" завершено! +${totalExp}⚡ +${totalChips}💾${itemsText}`,
      'loot',
    );
    if (player.combat.isFighting) {
      usePlayerStore.setState({ combat: { ...player.combat, isFighting: false } });
    }
    set({
      isExploring: false,
      isInfinite: false,
      phase: 'complete',
      timeLeft: 0,
      lastTickTimestamp: Date.now(),
    });
  },

  triggerLegendary: (event) => {
    const logEntry: ExplorationEventLog = {
      id: `leg_${Date.now()}`,
      text: event.description,
      type: 'legendary',
      ts: get().expeditionStartTimestamp + get().expeditionTickCounter * 1000,
      isLegendary: true,
      legendaryTitle: event.title,
      legendaryStage: 0,
    };
    set({
      legendary: {
        event,
        stageIndex: 0,
        rewards: {},
        autoResolveAfter: 3,
      },
      eventLog: [...get().eventLog, logEntry],
    });
  },

  autoResolveLegendary: () => {
    const state = get();
    if (!state.legendary) return;
    const { event, stageIndex, rewards } = state.legendary;
    const stage = event.stages[stageIndex];
    if (!stage) return;
    const player = usePlayerStore.getState();

    // Roll 70/30 — герой решает сам
    const roll = Math.random();
    if (roll < 0.7) {
      // Успех — идём дальше
      const stageRewards = stage.rewards(player.level);
      const newRewards: EventEffects = { ...rewards };
      for (const [k, v] of Object.entries(stageRewards)) {
        if (v) (newRewards as any)[k] = ((newRewards as any)[k] || 0) + (v as number);
      }

      if (stageIndex + 1 >= event.stages.length) {
        // Все 10 этапов пройдены! — финальная награда
        const finalRewards = event.finalReward(player.level);
        let r = applyEffects(newRewards, player, state.totalChipsGained, state.totalExpGained);
        r = applyEffects(finalRewards, player, r.chipsGained, r.expGained);
        const legendaryItemIds: string[] = [];
        const itemLog = finalRewards.itemCount
          ? (() => {
              const loot = generateLoot(GAME_ITEMS, player.level);
              loot.forEach((i) => {
                useInventoryStore.getState().addItem(i as any);
                legendaryItemIds.push(i.id);
              });
              return loot;
            })()
          : undefined;
        if (usePlayerStore.getState().stats.currentHp <= 0) {
          get().handleExplorationDeath();
          return;
        }
        set({
          legendary: null,
          eventCooldown: 0,
          totalChipsGained: r.chipsGained,
          totalExpGained: r.expGained,
          sessionItemIds: [...state.sessionItemIds, ...legendaryItemIds],
          eventLog: [...get().eventLog, {
            id: `leg_fin_${Date.now()}`,
            text: `${event.title} — этап ${stageIndex + 1}/${event.stages.length} ✓\n${stage.successText}\n\n${event.finalRewardText}`,
            type: 'legendary',
            ts: get().expeditionStartTimestamp + get().expeditionTickCounter * 1000,
            chips: finalRewards.chips,
            exp: finalRewards.exp,
            heal: r.totalHeal || finalRewards.heal,
            healPercent: r.healPercent,
            isLegendary: true,
            legendaryTitle: event.title,
            legendaryStage: stageIndex + 1,
            legendaryResult: 'complete',
            items: itemLog,
          }],
        });
      } else {
        // Переход к следующему этапу
        const logEntry: ExplorationEventLog = {
          id: `leg_stage_${Date.now()}`,
          text: `${event.title} — этап ${stageIndex + 1}/${event.stages.length} ✓\n${stage.successText}`,
          type: 'legendary',
          ts: get().expeditionStartTimestamp + get().expeditionTickCounter * 1000,
          chips: stageRewards.chips,
          exp: stageRewards.exp,
          heal: stageRewards.heal,
          healPercent: stageRewards.healPercent,
          isLegendary: true,
          legendaryTitle: event.title,
          legendaryStage: stageIndex + 1,
        };
        set({
          legendary: {
            ...state.legendary,
            stageIndex: stageIndex + 1,
            rewards: newRewards,
            autoResolveAfter: 3,
          },
          eventLog: [...get().eventLog, logEntry],
        });
      }
    } else {
      // Провал — цепочка обрывается, выплата накопленного
      const r = applyEffects(rewards, player, state.totalChipsGained, state.totalExpGained);
      if (usePlayerStore.getState().stats.currentHp <= 0) {
        get().handleExplorationDeath();
        return;
      }
      set({
        legendary: null,
        eventCooldown: 0,
        totalChipsGained: r.chipsGained,
        totalExpGained: r.expGained,
        eventLog: [...get().eventLog, {
            id: `leg_fail_${Date.now()}`,
            text: `${event.title} — провал на этапе ${stageIndex + 1}/${event.stages.length} ✗\n${stage.failText}`,
            type: 'legendary',
            ts: get().expeditionStartTimestamp + get().expeditionTickCounter * 1000,
          chips: rewards.chips,
          exp: rewards.exp,
          heal: r.totalHeal || rewards.heal,
          healPercent: r.healPercent,
          isLegendary: true,
          legendaryTitle: event.title,
          legendaryStage: stageIndex,
          legendaryResult: 'fail',
        }],
      });
    }
  },

  handleExplorationDeath: () => {
    const state = get();
    const player = usePlayerStore.getState();

    // Remove all items gained in this session
    state.sessionItemIds.forEach((id) => {
      useInventoryStore.getState().removeItem(id);
    });

    // Remove all chips gained in this session
    usePlayerStore.setState({ dataChips: Math.max(0, player.dataChips - state.totalChipsGained) });

    // Hero wakes up at base with 1 HP
    usePlayerStore.setState({
      stats: { ...player.stats, currentHp: 1 },
      explorationDeathTimestamp: Date.now(),
    });

    player.addLog('💀 Герой потерял сознание от ран. Экспедиция провалена. Весь лут и чипы потеряны.', 'damage');

    if (player.combat.isFighting) {
      usePlayerStore.setState({ combat: { ...player.combat, isFighting: false } });
    }
    set({
      isExploring: false,
      isInfinite: false,
      phase: 'idle',
      timeLeft: 0,
      eventLog: [],
      legendary: null,
      eventCooldown: 0,
      microEventCooldown: 0,
      totalChipsGained: 0,
      totalExpGained: 0,
      totalItemsGained: 0,
      sessionItemIds: [],
      lastTickTimestamp: Date.now(),
    });
  },
    }),
    {
      name: 'remastered_exploration',
      version: 1,
      partialize: (state) => ({
        isExploring: state.isExploring,
        isInfinite: state.isInfinite,
        zoneName: state.zoneName,
        zoneDifficulty: state.zoneDifficulty,
        zoneFactions: state.zoneFactions,
        phase: state.phase,
        timeLeft: state.timeLeft,
        totalTime: state.totalTime,
        eventCooldown: state.eventCooldown,
        microEventCooldown: state.microEventCooldown,
        totalChipsGained: state.totalChipsGained,
        totalExpGained: state.totalExpGained,
        totalItemsGained: state.totalItemsGained,
        sessionItemIds: state.sessionItemIds,
        eventLog: state.eventLog.slice(-200),
        legendary: state.legendary,
        hasTriggeredLegendary: state.hasTriggeredLegendary,
        lastTickTimestamp: state.lastTickTimestamp,
        expeditionTickCounter: state.expeditionTickCounter,
        expeditionStartTimestamp: state.expeditionStartTimestamp,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.isExploring && state.lastTickTimestamp > 0) {
          setTimeout(() => catchUpExploration(), 0);
        }
      },
    },
  ),
);

export function catchUpExploration() {
  const store = useExplorationStore.getState();
  if (!store.isExploring || store.phase === 'complete' || store.phase === 'idle') return;
  if (store.lastTickTimestamp <= 0) return;

  const elapsed = Math.floor((Date.now() - store.lastTickTimestamp) / 1000);
  if (elapsed <= 0) return;

  const maxTicks = Math.min(elapsed, store.totalTime + 60);
  const prevChips = store.totalChipsGained;
  const prevExp = store.totalExpGained;
  const prevItems = store.totalItemsGained;

  for (let i = 0; i < maxTicks; i++) {
    const s = useExplorationStore.getState();
    if (!s.isExploring) break;
    s.explorationTick();
  }

  const final = useExplorationStore.getState();
  const player = usePlayerStore.getState();
  const chipDiff = final.totalChipsGained - prevChips;
  const expDiff = final.totalExpGained - prevExp;
  const itemDiff = final.totalItemsGained - prevItems;

  let msg = `⏰ Возвращение из фона: прошло ${elapsed} сек.`;
  if (!final.isExploring) {
    if (player.stats.currentHp <= 0) {
      msg += ' Герой погиб.';
    } else if (final.phase === 'complete') {
      msg += ' Экспедиция завершена.';
    }
  } else {
    msg += ` Экспедиция продолжается (${final.phase}).`;
  }
  if (chipDiff > 0) msg += ` +${chipDiff}💾`;
  if (chipDiff < 0) msg += ` ${chipDiff}💾`;
  if (expDiff > 0) msg += ` +${expDiff}⚡`;
  if (itemDiff > 0) msg += `, найдено ${itemDiff} предметов`;
  player.addLog(msg, 'system');
}
