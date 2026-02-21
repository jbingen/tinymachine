import { createMachine, type Machine } from '../src/index';

type AssertEqual<T, U> = [T] extends [U] ? [U] extends [T] ? true : never : never;
function typeEqual<T, U>(_: AssertEqual<T, U>) {}

const config = {
  initial: 'idle',
  states: {
    idle: { on: { SUBMIT: 'loading' } },
    loading: { on: { SUCCESS: 'done', ERROR: 'error' } },
    done: {},
    error: { on: { RETRY: 'loading' } },
  },
} as const;

type Config = typeof config;
type Idle = Machine<Config, 'idle'>;
type Loading = Machine<Config, 'loading'>;
type Done = Machine<Config, 'done'>;
type ErrorState = Machine<Config, 'error'>;

// createMachine returns machine narrowed to initial state
const m = createMachine(config);
typeEqual<typeof m.current, 'idle'>(true);

// send from idle returns machine narrowed to loading
typeEqual<ReturnType<Idle['send']>, Machine<Config, 'loading'>>(true);

// send from loading returns done or error depending on event
typeEqual<ReturnType<Loading['send']>, Machine<Config, 'done'> | Machine<Config, 'error'>>(true);

// send RETRY from error returns loading
typeEqual<ReturnType<ErrorState['send']>, Machine<Config, 'loading'>>(true);

// done has no events (send accepts never)
type DoneEvents = Parameters<Done['send']>[0];
typeEqual<DoneEvents, never>(true);

// idle only accepts SUBMIT
type IdleEvents = Parameters<Idle['send']>[0];
typeEqual<IdleEvents, 'SUBMIT'>(true);

// loading accepts SUCCESS and ERROR
type LoadingEvents = Parameters<Loading['send']>[0];
typeEqual<LoadingEvents, 'SUCCESS' | 'ERROR'>(true);

// matches narrows the type
const wide: Machine<Config> = createMachine(config) as any;
if (wide.matches('idle')) {
  typeEqual<typeof wide.current, 'idle'>(true);
}

// @ts-expect-error - matches rejects invalid states
wide.matches('nonexistent');

// idle does not extend a machine that accepts SUCCESS
type BadSend = Idle extends { send: (event: 'SUCCESS') => any } ? true : false;
typeEqual<BadSend, false>(true);
