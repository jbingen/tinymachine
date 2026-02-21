import { describe, test, expect, mock } from 'bun:test';
import { createMachine, type Machine } from '../src/index';

function trafficLight() {
  return createMachine({
    initial: 'green',
    states: {
      green: { on: { TIMER: 'yellow' } },
      yellow: { on: { TIMER: 'red' } },
      red: { on: { TIMER: 'green' } },
    },
  });
}

type TrafficLight = ReturnType<typeof trafficLight>;
type AnyTraffic = Machine<TrafficLight extends Machine<infer C> ? C : never>;

describe('transitions', () => {
  test('starts in initial state', () => {
    const m = trafficLight();
    expect(m.current).toBe('green');
  });

  test('transitions via chaining', () => {
    const m = trafficLight();
    expect(m.send('TIMER').current).toBe('yellow');
  });

  test('chains multiple transitions', () => {
    const m = trafficLight();
    expect(m.send('TIMER').send('TIMER').current).toBe('red');

    const m2 = trafficLight();
    expect(m2.send('TIMER').send('TIMER').send('TIMER').current).toBe('green');
  });

  test('send returns the machine for chaining', () => {
    const m = trafficLight();
    const yellow = m.send('TIMER');
    expect(yellow.current).toBe('yellow');
    expect(yellow.send('TIMER').current).toBe('red');
  });

  test('imperative send mutates internal state', () => {
    const m: AnyTraffic = trafficLight();
    m.send('TIMER');
    expect(m.current).toBe('yellow');
    m.send('TIMER');
    expect(m.current).toBe('red');
    m.send('TIMER');
    expect(m.current).toBe('green');
  });

  test('throws on invalid event', () => {
    const m = trafficLight();
    expect(() => (m as any).send('INVALID')).toThrow('No transition for "INVALID" from "green"');
  });

  test('throws when no transitions defined', () => {
    const m = createMachine({
      initial: 'done',
      states: {
        done: {},
      },
    });
    expect(() => (m as any).send('ANYTHING')).toThrow('No transitions from "done"');
  });

  test('validates targets at construction', () => {
    expect(() =>
      createMachine({
        initial: 'a',
        states: {
          a: { on: { GO: 'nonexistent' as any } },
        },
      })
    ).toThrow('is not a defined state');
  });
});

describe('matches', () => {
  test('matches current state', () => {
    const m = trafficLight();
    expect(m.matches('green')).toBe(true);
    expect(m.matches('red')).toBe(false);
  });

  test('matches after transition', () => {
    const m = trafficLight().send('TIMER');
    expect(m.matches('yellow')).toBe(true);
    expect(m.matches('green')).toBe(false);
  });
});

describe('subscribe', () => {
  test('notifies on transition', () => {
    const m: AnyTraffic = trafficLight();
    const states: string[] = [];
    m.subscribe((s) => states.push(s));

    m.send('TIMER');
    m.send('TIMER');
    expect(states).toEqual(['yellow', 'red']);
  });

  test('unsubscribe stops notifications', () => {
    const m: AnyTraffic = trafficLight();
    const states: string[] = [];
    const unsub = m.subscribe((s) => states.push(s));

    m.send('TIMER');
    unsub();
    m.send('TIMER');
    expect(states).toEqual(['yellow']);
  });
});

describe('lifecycle hooks', () => {
  test('calls onEnter for initial state', () => {
    const enter = mock(() => {});
    createMachine({
      initial: 'idle',
      states: {
        idle: { on: { START: 'running' }, onEnter: enter },
        running: {},
      },
    });
    expect(enter).toHaveBeenCalledTimes(1);
  });

  test('calls onExit and onEnter on transition', () => {
    const exitIdle = mock(() => {});
    const enterRunning = mock(() => {});
    const m = createMachine({
      initial: 'idle',
      states: {
        idle: { on: { START: 'running' }, onExit: exitIdle },
        running: { onEnter: enterRunning },
      },
    });

    m.send('START');
    expect(exitIdle).toHaveBeenCalledTimes(1);
    expect(enterRunning).toHaveBeenCalledTimes(1);
  });

  test('lifecycle order: onExit -> onEnter -> subscribers', () => {
    const order: string[] = [];
    const m = createMachine({
      initial: 'a',
      states: {
        a: { on: { GO: 'b' }, onExit: () => order.push('exit-a') },
        b: { onEnter: () => order.push('enter-b') },
      },
    });

    m.subscribe(() => order.push('subscriber'));
    m.send('GO');
    expect(order).toEqual(['exit-a', 'enter-b', 'subscriber']);
  });
});

describe('complex machine', () => {
  test('form submission flow via chaining', () => {
    const m = createMachine({
      initial: 'idle',
      states: {
        idle: { on: { SUBMIT: 'loading' } },
        loading: { on: { SUCCESS: 'success', ERROR: 'error' } },
        success: { on: { RESET: 'idle' } },
        error: { on: { RETRY: 'loading', RESET: 'idle' } },
      },
    });

    expect(m.current).toBe('idle');

    const err = m.send('SUBMIT').send('ERROR');
    expect(err.current).toBe('error');

    const retried = err.send('RETRY').send('SUCCESS');
    expect(retried.current).toBe('success');

    const reset = retried.send('RESET');
    expect(reset.current).toBe('idle');
  });
});
