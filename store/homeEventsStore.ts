import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ComponentType } from 'react';
import { z } from 'zod';
import { zustandStorage } from '../lib/storagev2';

export enum EventPriority {
    LOW = 1,
    MEDIUM = 2,
    HIGH = 3,
    CRITICAL = 4,
}

export const eventConfigSchema = z.object({
    id: z.string().min(1),
    priority: z.nativeEnum(EventPriority),
    maxShowCount: z.number().int().nonnegative().optional(),
    minAppLaunches: z.number().int().nonnegative().optional(),
    delayAfterPrevious: z.number().int().nonnegative().optional(),
    expiresAt: z.number().int().nonnegative().optional(),
    requiresPreviousEvents: z.array(z.string()).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    blockOnDismiss: z.boolean().optional().default(true),
    blockOnComplete: z.boolean().optional().default(true),
});

export type HomeEventConfig = z.infer<typeof eventConfigSchema>;

export interface HomeEventComponentProps {
    eventId: string;
    onDismiss: () => void;
    onComplete: () => void;
    data?: Record<string, unknown>;
}

export interface HomeEvent extends HomeEventConfig {
    component: ComponentType<HomeEventComponentProps>;
}

interface EventTrackingData {
    showCount: number;
    firstShownAt: number | null;
    lastShownAt: number | null;
    dismissed: boolean;
    dismissedAt: number | null;
    completed: boolean;
    completedAt: number | null;
}

export interface EventStateInfo {
    exists: boolean;
    canShow: boolean;
    tracking: EventTrackingData | null;
    config: HomeEventConfig | null;
}

interface HomeEventsState {
    eventConfigs: Record<string, HomeEventConfig>;
    tracking: Record<string, EventTrackingData>;
    appLaunchCount: number;
    lastEventShownAt: number | null;
    components: Map<string, ComponentType<HomeEventComponentProps>>;
    isHomeVisible: boolean;
    isHomeDataReady: boolean;
    registerEvent: (event: HomeEvent) => void;
    registerEvents: (events: HomeEvent[]) => void;
    unregisterEvent: (eventId: string) => void;
    setHomeVisible: (visible: boolean) => void;
    setHomeDataReady: (ready: boolean) => void;
    markEventShown: (eventId: string) => void;
    markEventDismissed: (eventId: string) => void;
    markEventCompleted: (eventId: string) => void;
    incrementAppLaunch: () => void;
    getNextEventToShow: () => HomeEvent | null;
    shouldShowEvent: (eventId: string) => boolean;
    hasSeenEvent: (eventId: string) => boolean;
    hasCompletedEvent: (eventId: string) => boolean;
    getEventShowCount: (eventId: string) => number;
    getAllPendingEvents: () => HomeEvent[];
    getEventState: (eventId: string) => EventStateInfo;
    resetEvent: (eventId: string) => void;
    resetAllEvents: () => void;
    clearExpiredEvents: () => void;
}

const createDefaultTracking = (): EventTrackingData => ({
    showCount: 0,
    firstShownAt: null,
    lastShownAt: null,
    dismissed: false,
    dismissedAt: null,
    completed: false,
    completedAt: null,
});

const detectCircularDependency = (
    eventId: string,
    eventConfigs: Record<string, HomeEventConfig>,
    visited = new Set<string>()
): boolean => {
    if (visited.has(eventId)) {
        return true;
    }

    visited.add(eventId);

    const config = eventConfigs[eventId];
    if (!config?.requiresPreviousEvents || config.requiresPreviousEvents.length === 0) {
        return false;
    }

    for (let i = 0; i < config.requiresPreviousEvents.length; i++) {
        const reqId = config.requiresPreviousEvents[i];
        if (detectCircularDependency(reqId, eventConfigs, new Set(visited))) {
            return true;
        }
    }

    return false;
};

export const useHomeEventsStore = create<HomeEventsState>()(
    persist(
        (set, get) => ({
            eventConfigs: {},
            tracking: {},
            appLaunchCount: 0,
            lastEventShownAt: null,
            components: new Map(),
            isHomeVisible: false,
            isHomeDataReady: false,

            registerEvent: (event) =>
                set((state) => {
                    const parseResult = eventConfigSchema.safeParse(event);

                    if (!parseResult.success) {
                        console.error(`Event registration failed for ${event.id || 'unknown'}`, parseResult.error);
                        return state;
                    }

                    if (!event.component) {
                        console.error('Event must have a component');
                        return state;
                    }

                    const config = parseResult.data;

                    if (config.expiresAt !== undefined && config.expiresAt < Date.now()) {
                        console.warn(`Event ${config.id} is already expired`);
                    }

                    const tempConfigs = { ...state.eventConfigs, [config.id]: config };
                    if (detectCircularDependency(config.id, tempConfigs)) {
                        console.error(`Circular dependency detected for event ${config.id}`);
                        return state;
                    }

                    if (config.requiresPreviousEvents && config.requiresPreviousEvents.length > 0) {
                        for (let i = 0; i < config.requiresPreviousEvents.length; i++) {
                            const reqId = config.requiresPreviousEvents[i];
                            if (!state.eventConfigs[reqId] && reqId !== config.id) {
                                console.warn(
                                    `Event ${config.id} requires ${reqId} which is not registered yet`
                                );
                            }
                        }
                    }

                    const newComponents = new Map(state.components);
                    newComponents.set(config.id, event.component);

                    return {
                        eventConfigs: {
                            ...state.eventConfigs,
                            [config.id]: config,
                        },
                        tracking: {
                            ...state.tracking,
                            [config.id]: state.tracking[config.id] || createDefaultTracking(),
                        },
                        components: newComponents,
                    };
                }),

            registerEvents: (events) =>
                set((state) => {
                    const newEventConfigs: Record<string, HomeEventConfig> = {};
                    const newTracking: Record<string, EventTrackingData> = {};
                    const newComponents = new Map(state.components);

                    for (let i = 0; i < events.length; i++) {
                        const event = events[i];
                        const parseResult = eventConfigSchema.safeParse(event);

                        if (!parseResult.success) {
                            console.error(`Event registration failed for ${event.id || 'unknown'}`, parseResult.error);
                            continue;
                        }

                        if (!event.component) {
                            console.error(`Event ${event.id} must have a component`);
                            continue;
                        }

                        const config = parseResult.data;

                        if (config.expiresAt !== undefined && config.expiresAt < Date.now()) {
                            console.warn(`Event ${config.id} is already expired`);
                        }

                        newEventConfigs[config.id] = config;
                        newTracking[config.id] = state.tracking[config.id] || createDefaultTracking();
                        newComponents.set(config.id, event.component);
                    }

                    const tempConfigs = { ...state.eventConfigs, ...newEventConfigs };
                    const eventIds = Object.keys(newEventConfigs);
                    for (let i = 0; i < eventIds.length; i++) {
                        const eventId = eventIds[i];
                        if (detectCircularDependency(eventId, tempConfigs)) {
                            console.error(`Circular dependency detected for event ${eventId}`);
                            delete newEventConfigs[eventId];
                            delete newTracking[eventId];
                            newComponents.delete(eventId);
                        }
                    }

                    return {
                        eventConfigs: { ...state.eventConfigs, ...newEventConfigs },
                        tracking: { ...state.tracking, ...newTracking },
                        components: newComponents,
                    };
                }),

            unregisterEvent: (eventId) =>
                set((state) => {
                    const { [eventId]: _, ...restConfigs } = state.eventConfigs;
                    const { [eventId]: __, ...restTracking } = state.tracking;
                    const newComponents = new Map(state.components);
                    newComponents.delete(eventId);

                    return {
                        eventConfigs: restConfigs,
                        tracking: restTracking,
                        components: newComponents,
                    };
                }),

            setHomeVisible: (visible) => set({ isHomeVisible: visible }),

            setHomeDataReady: (ready) => set({ isHomeDataReady: ready }),

            markEventShown: (eventId) =>
                set((state) => {
                    const tracking = state.tracking[eventId] || createDefaultTracking();
                    const now = Date.now();

                    return {
                        tracking: {
                            ...state.tracking,
                            [eventId]: {
                                ...tracking,
                                showCount: tracking.showCount + 1,
                                firstShownAt: tracking.firstShownAt ?? now,
                                lastShownAt: now,
                            },
                        },
                        lastEventShownAt: now,
                    };
                }),

            markEventDismissed: (eventId) =>
                set((state) => {
                    const tracking = state.tracking[eventId] || createDefaultTracking();

                    return {
                        tracking: {
                            ...state.tracking,
                            [eventId]: {
                                ...tracking,
                                dismissed: true,
                                dismissedAt: Date.now(),
                            },
                        },
                    };
                }),

            markEventCompleted: (eventId) =>
                set((state) => {
                    const tracking = state.tracking[eventId] || createDefaultTracking();

                    return {
                        tracking: {
                            ...state.tracking,
                            [eventId]: {
                                ...tracking,
                                completed: true,
                                completedAt: Date.now(),
                            },
                        },
                    };
                }),

            incrementAppLaunch: () =>
                set((state) => ({
                    appLaunchCount: state.appLaunchCount + 1,
                })),

            shouldShowEvent: (eventId) => {
                const state = get();

                if (!state.isHomeVisible || !state.isHomeDataReady) {
                    return false;
                }

                const config = state.eventConfigs[eventId];
                const tracking = state.tracking[eventId];

                if (!config || !tracking) return false;

                const blockOnDismiss = config.blockOnDismiss ?? true;
                if (tracking.dismissed && blockOnDismiss) {
                    return false;
                }

                const blockOnComplete = config.blockOnComplete ?? true;
                if (tracking.completed && blockOnComplete) {
                    return false;
                }

                if (config.maxShowCount !== undefined) {
                    if (config.maxShowCount === 0) {
                        return false;
                    }
                    if (tracking.showCount >= config.maxShowCount) {
                        return false;
                    }
                }

                if (config.minAppLaunches !== undefined && state.appLaunchCount < config.minAppLaunches) {
                    return false;
                }

                if (config.expiresAt !== undefined && Date.now() > config.expiresAt) {
                    return false;
                }

                if (config.delayAfterPrevious !== undefined && config.delayAfterPrevious > 0 && state.lastEventShownAt) {
                    const timeSinceLastEvent = Date.now() - state.lastEventShownAt;
                    if (timeSinceLastEvent < config.delayAfterPrevious) {
                        return false;
                    }
                }

                if (config.requiresPreviousEvents && config.requiresPreviousEvents.length > 0) {
                    for (let i = 0; i < config.requiresPreviousEvents.length; i++) {
                        const reqId = config.requiresPreviousEvents[i];

                        if (!state.eventConfigs[reqId]) {
                            console.warn(`Required event ${reqId} for event ${eventId} does not exist`);
                            return false;
                        }

                        const reqTracking = state.tracking[reqId];

                        if (!reqTracking || !reqTracking.completed) {
                            return false;
                        }
                    }
                }

                return true;
            },

            getNextEventToShow: () => {
                const state = get();

                get().clearExpiredEvents();

                if (!state.isHomeVisible || !state.isHomeDataReady) {
                    return null;
                }

                const eventIds = Object.keys(state.eventConfigs);

                let bestEvent: HomeEvent | null = null;
                let highestPriority = -1;
                let lowestShowCount = Number.POSITIVE_INFINITY;

                for (let i = 0; i < eventIds.length; i++) {
                    const eventId = eventIds[i];
                    const config = state.eventConfigs[eventId];
                    const component = state.components.get(eventId);
                    const tracking = state.tracking[eventId];

                    if (!component) {
                        console.warn(`Component for event ${eventId} not registered yet`);
                        continue;
                    }

                    if (!state.shouldShowEvent(eventId)) {
                        continue;
                    }

                    const showCount = tracking?.showCount || 0;

                    if (
                        config.priority > highestPriority ||
                        (config.priority === highestPriority && showCount < lowestShowCount)
                    ) {
                        highestPriority = config.priority;
                        lowestShowCount = showCount;
                        bestEvent = {
                            ...config,
                            component,
                        };
                    }
                }

                return bestEvent;
            },

            hasSeenEvent: (eventId) => {
                const tracking = get().tracking[eventId];
                return tracking ? tracking.showCount > 0 : false;
            },

            hasCompletedEvent: (eventId) => {
                const tracking = get().tracking[eventId];
                return tracking ? tracking.completed : false;
            },

            getEventShowCount: (eventId) => {
                const tracking = get().tracking[eventId];
                return tracking ? tracking.showCount : 0;
            },

            getAllPendingEvents: () => {
                const state = get();
                const eventIds = Object.keys(state.eventConfigs);
                const pendingEvents: HomeEvent[] = [];

                for (let i = 0; i < eventIds.length; i++) {
                    const eventId = eventIds[i];
                    const config = state.eventConfigs[eventId];
                    const component = state.components.get(eventId);

                    if (!component) {
                        console.warn(`Component for event ${eventId} not registered yet`);
                        continue;
                    }

                    if (state.shouldShowEvent(eventId)) {
                        pendingEvents.push({
                            ...config,
                            component,
                        });
                    }
                }

                pendingEvents.sort((a, b) => {
                    if (b.priority !== a.priority) {
                        return b.priority - a.priority;
                    }
                    const aShowCount = state.tracking[a.id]?.showCount || 0;
                    const bShowCount = state.tracking[b.id]?.showCount || 0;
                    return aShowCount - bShowCount;
                });

                return pendingEvents;
            },

            getEventState: (eventId) => {
                const state = get();
                return {
                    exists: !!state.eventConfigs[eventId],
                    canShow: state.shouldShowEvent(eventId),
                    tracking: state.tracking[eventId] || null,
                    config: state.eventConfigs[eventId] || null,
                };
            },

            resetEvent: (eventId) =>
                set((state) => ({
                    tracking: {
                        ...state.tracking,
                        [eventId]: createDefaultTracking(),
                    },
                })),

            resetAllEvents: () =>
                set((state) => {
                    const resetTracking: Record<string, EventTrackingData> = {};
                    const eventIds = Object.keys(state.eventConfigs);

                    for (let i = 0; i < eventIds.length; i++) {
                        resetTracking[eventIds[i]] = createDefaultTracking();
                    }

                    return {
                        tracking: resetTracking,
                        lastEventShownAt: null,
                    };
                }),

            clearExpiredEvents: () =>
                set((state) => {
                    const now = Date.now();
                    const activeConfigs: Record<string, HomeEventConfig> = {};
                    const activeTracking: Record<string, EventTrackingData> = {};
                    const newComponents = new Map(state.components);

                    const eventIds = Object.keys(state.eventConfigs);
                    let hasExpired = false;

                    for (let i = 0; i < eventIds.length; i++) {
                        const id = eventIds[i];
                        const config = state.eventConfigs[id];

                        if (!config.expiresAt || config.expiresAt > now) {
                            activeConfigs[id] = config;
                            if (state.tracking[id]) {
                                activeTracking[id] = state.tracking[id];
                            }
                        } else {
                            hasExpired = true;
                            newComponents.delete(id);
                        }
                    }

                    if (!hasExpired) {
                        return state;
                    }

                    return {
                        eventConfigs: activeConfigs,
                        tracking: activeTracking,
                        components: newComponents,
                    };
                }),
        }),
        {
            name: 'home-events-storage0',
            storage: createJSONStorage(() => zustandStorage),
            partialize: (state) => ({
                eventConfigs: state.eventConfigs,
                tracking: state.tracking,
                appLaunchCount: state.appLaunchCount,
                lastEventShownAt: state.lastEventShownAt,
            }),
        }
    )
);
