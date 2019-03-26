import { useMemo, useEffect, useState } from "react";
import { interpret, StateMachine, State } from "xstate";

const __DEV__ = process.env.NODE_ENV !== "production";

export function useMachine<TContext>(
  machine: StateMachine<TContext, any, any>
): [State<TContext, any>, any] {
  const [current, setCurrent] = useState(machine.initialState);
  const service = useMemo(
    __DEV__
      ? () =>
          interpret(machine)
            .onTransition(state => {
              console.log("STATE:", state);
              // @ts-ignore
              setCurrent(state);
            })
            .onEvent(e => console.log("EVENT:", e))
            .start()
      : () =>
          interpret(machine)
            .onTransition(state => {
              // @ts-ignore
              setCurrent(state);
            })
            .start(),
    [machine]
  );

  useEffect(() => {
    return () => {
      service.stop();
    };
  }, []);

  return [current, service.send];
}
