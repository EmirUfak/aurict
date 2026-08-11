import { useCallback, useReducer } from 'react';

interface AsyncErrorState {
  error: string | null;
  errorSeq: number;
}

type AsyncErrorAction = { type: 'fail'; message: string } | { type: 'clear' };

const initialState: AsyncErrorState = { error: null, errorSeq: 0 };

// errorSeq increments on every failure, even when the message text repeats
// (e.g. retrying an action that fails the same way twice). Consumers that
// key off the message alone (like a naive useEffect([error]) dependency)
// would miss the second failure because React bails out on an unchanged
// primitive value — errorSeq gives them something that always changes.
export function asyncErrorReducer(state: AsyncErrorState, action: AsyncErrorAction): AsyncErrorState {
  switch (action.type) {
    case 'fail':
      return { error: action.message, errorSeq: state.errorSeq + 1 };
    case 'clear':
      return state.error === null ? state : { error: null, errorSeq: state.errorSeq };
  }
}

export function useAsyncError() {
  const [state, dispatch] = useReducer(asyncErrorReducer, initialState);

  const fail = useCallback((reason: unknown, fallback: string) => {
    console.error(fallback, reason);
    dispatch({ type: 'fail', message: reason instanceof Error ? reason.message : fallback });
  }, []);

  const clear = useCallback(() => dispatch({ type: 'clear' }), []);

  return { error: state.error, errorSeq: state.errorSeq, fail, clear };
}
