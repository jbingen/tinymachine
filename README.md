# ⚙️ tinymachine

[![npm version](https://img.shields.io/npm/v/tinymachine)](https://www.npmjs.com/package/tinymachine)
[![npm bundle size](https://img.shields.io/npm/unpacked-size/tinymachine)](https://www.npmjs.com/package/tinymachine)
[![license](https://img.shields.io/github/license/jbingen/tinymachine)](https://github.com/jbingen/tinymachine/blob/main/LICENSE)

Type-safe finite state machine. States, transitions, and events checked at compile time.

For anyone who needs state machines but not the 40KB of xstate.

```
npm install tinymachine
```

```typescript
// before
let state = "idle";
function send(event: string) {
  if (state === "idle" && event === "SUBMIT") state = "loading";
  else if (state === "loading" && event === "SUCCESS") state = "done";
  // ... easy to miss a case, no type safety
}

// after
const m = createMachine({ ... });
m.send("SUBMIT"); // typed - only valid events for current state
```

Define states and transitions once. TypeScript enforces you can't send the wrong event from the wrong state.

```typescript
import { createMachine } from "tinymachine";

const machine = createMachine({
  initial: "idle",
  states: {
    idle: { on: { SUBMIT: "loading" } },
    loading: { on: { SUCCESS: "done", ERROR: "error" } },
    done: {},
    error: { on: { RETRY: "loading" } },
  },
});

machine.send("SUBMIT");              // ok - returns Machine<..., "loading">
machine.send("SUBMIT").send("SUCCESS"); // ok - chained, returns Machine<..., "done">

machine.send("SUCCESS"); // compile error - "SUCCESS" is not valid from "idle"
```

## Why

State machines are the right tool for most UI flows (modals, wizards, async operations, form submission). But xstate is 40KB+ with actors, services, guards, and a visual editor. Most of the time you just need states, transitions, and type safety.

tinymachine gives you the type-level enforcement with zero dependencies. The config object is the single source of truth - TypeScript infers the rest.

## API

### `createMachine(config)`

Creates a typed state machine. Returns a machine narrowed to the initial state.

```typescript
const m = createMachine({
  initial: "green",
  states: {
    green: { on: { TIMER: "yellow" } },
    yellow: { on: { TIMER: "red" } },
    red: { on: { TIMER: "green" } },
  },
});
```

### `.send(event)`

Sends an event to the machine. Returns the machine narrowed to the new state, enabling type-safe chaining.

```typescript
const yellow = m.send("TIMER");       // Machine<..., "yellow">
const red = yellow.send("TIMER");     // Machine<..., "red">

m.send("INVALID"); // compile error
```

`send` mutates the machine in place but returns it typed as the next state for ergonomic chaining. This means `.current` always reflects the latest state whether you chain or not.

### `.current`

The current state as a string literal type.

```typescript
m.current; // "green" (literal type, not just string)
```

### `.matches(state)`

Type guard that narrows the machine to a specific state.

```typescript
if (m.matches("idle")) {
  m.send("SUBMIT"); // TypeScript knows only idle's events are valid
}
```

### `.subscribe(listener)`

Subscribe to state changes. Returns an unsubscribe function.

```typescript
const unsub = m.subscribe((state) => {
  console.log("now in:", state);
});

unsub(); // stop listening
```

### Lifecycle hooks

Add `onEnter` and `onExit` callbacks to any state.

```typescript
const m = createMachine({
  initial: "idle",
  states: {
    idle: {
      on: { START: "running" },
      onExit: () => console.log("leaving idle"),
    },
    running: {
      onEnter: () => console.log("entered running"),
    },
  },
});
```

Execution order: `onExit` (old state) -> `onEnter` (new state) -> subscribers.

## How types work

The machine type tracks the current state as a generic parameter. When you call `send`, TypeScript:

1. Looks up which events are valid for the current state
2. Only allows those events as arguments
3. Returns a machine narrowed to the target state

This means invalid transitions are caught at compile time, and chaining (`m.send("A").send("B")`) gives you full type narrowing at each step.

States with no `on` property have `never` as their event type - `send` can't be called at all.

## Design decisions

- Zero dependencies. Tiny footprint.
- Config object is plain data - no builder pattern, no class hierarchy.
- `send` returns `this` (same object) for chaining, but types narrow per call.
- Lifecycle hooks are optional and synchronous. No async, no guards, no actions.
- No hierarchical states, parallel states, or history. Use xstate if you need those.
- `matches` is a type guard so you can narrow before sending in imperative code.
- All transition targets are validated at construction time - bad configs fail immediately, not on first `send`.
