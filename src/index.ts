type AnyConfig = MachineConfig<string, string>;

export type MachineConfig<
  TState extends string,
  TEvent extends string,
> = {
  initial: TState;
  states: {
    [S in TState]: {
      on?: {
        [E in TEvent]?: TState;
      };
      onEnter?: () => void;
      onExit?: () => void;
    };
  };
};

type StateOf<TConfig extends AnyConfig> =
  keyof TConfig['states'] & string;

type EventsForState<TConfig extends AnyConfig, S extends StateOf<TConfig>> =
  keyof (TConfig['states'][S] extends { on: infer On } ? On : {}) & string;

type RawTarget<
  TConfig extends AnyConfig,
  S extends StateOf<TConfig>,
  E extends EventsForState<TConfig, S>,
> =
  TConfig['states'][S] extends { on: infer On }
    ? On extends Record<string, any> ? On[E] : never
    : never;

export type Machine<TConfig extends AnyConfig, S extends StateOf<TConfig> = StateOf<TConfig>> = {
  readonly current: S;
  send<E extends EventsForState<TConfig, S>>(event: E): Machine<TConfig, Extract<RawTarget<TConfig, S, E>, StateOf<TConfig>>>;
  matches<SS extends StateOf<TConfig>>(state: SS): this is Machine<TConfig, SS>;
  subscribe(listener: (state: StateOf<TConfig>) => void): () => void;
};

export function createMachine<const TConfig extends AnyConfig>(
  config: TConfig,
): Machine<TConfig, TConfig['initial'] & StateOf<TConfig>> {
  let current: string = config.initial;
  const listeners = new Set<(state: string) => void>();

  const states = config.states as Record<string, {
    on?: Record<string, string>;
    onEnter?: () => void;
    onExit?: () => void;
  }>;

  // validate all transition targets at construction
  for (const [name, state] of Object.entries(states)) {
    if (!state.on) continue;
    for (const [event, target] of Object.entries(state.on)) {
      if (!(target in states)) throw new Error(`State "${name}" has transition "${event}" -> "${target}" but "${target}" is not a defined state`);
    }
  }

  states[current]?.onEnter?.();

  const machine = {
    get current(): any {
      return current;
    },

    send(event: string): any {
      const stateConfig = states[current];
      if (!stateConfig?.on) throw new Error(`No transitions from "${current}"`);

      const target = stateConfig.on[event];
      if (!target) throw new Error(`No transition for "${event}" from "${current}"`);

      stateConfig.onExit?.();
      current = target;
      states[current]?.onEnter?.();

      for (const fn of listeners) fn(current);

      return machine;
    },

    matches(state: string): boolean {
      return current === state;
    },

    subscribe(listener: (state: string) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return machine as any;
}
