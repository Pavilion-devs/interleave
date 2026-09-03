/**
 * TodoMVC React reducer, adapted to TypeScript from the MIT-licensed source:
 * https://github.com/tastejs/todomvc/blob/ff43b02e59dfa604386bb382034b2cd07c2bcd8a/examples/react/src/todo/reducer.js
 * Pinned at ff43b02e59dfa604386bb382034b2cd07c2bcd8a on 2026-09-03.
 * See THIRD_PARTY_NOTICES.md.
 */
export const ADD_ITEM = 'ADD_ITEM';
export const UPDATE_ITEM = 'UPDATE_ITEM';
export const REMOVE_ITEM = 'REMOVE_ITEM';
export const TOGGLE_ITEM = 'TOGGLE_ITEM';
export const REMOVE_ALL_ITEMS = 'REMOVE_ALL_ITEMS';
export const TOGGLE_ALL = 'TOGGLE_ALL';
export const REMOVE_COMPLETED_ITEMS = 'REMOVE_COMPLETED_ITEMS';

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

export type TodoAction =
  | { type: typeof ADD_ITEM; payload: { title: string } }
  | { type: typeof UPDATE_ITEM; payload: { id: string; title: string } }
  | { type: typeof REMOVE_ITEM; payload: { id: string } }
  | { type: typeof TOGGLE_ITEM; payload: { id: string } }
  | { type: typeof REMOVE_ALL_ITEMS }
  | { type: typeof TOGGLE_ALL; payload: { completed: boolean } }
  | { type: typeof REMOVE_COMPLETED_ITEMS };

// This is the same non-secure Nano ID routine vendored by TodoMVC's reducer.
const urlAlphabet =
  'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';
function nanoid(size = 21) {
  let id = '';
  let i = size;
  while (i--) id += urlAlphabet[(Math.random() * 64) | 0];
  return id;
}

/** The action behavior matches TodoMVC's upstream React reducer. */
export const todoReducer = (state: readonly Todo[], action: TodoAction) => {
  switch (action.type) {
    case ADD_ITEM:
      return state.concat({
        id: nanoid(),
        title: action.payload.title,
        completed: false,
      });
    case UPDATE_ITEM:
      return state.map((todo) =>
        todo.id === action.payload.id
          ? { ...todo, title: action.payload.title }
          : todo,
      );
    case REMOVE_ITEM:
      return state.filter((todo) => todo.id !== action.payload.id);
    case TOGGLE_ITEM:
      return state.map((todo) =>
        todo.id === action.payload.id
          ? { ...todo, completed: !todo.completed }
          : todo,
      );
    case REMOVE_ALL_ITEMS:
      return [];
    case TOGGLE_ALL:
      return state.map((todo) =>
        todo.completed !== action.payload.completed
          ? { ...todo, completed: action.payload.completed }
          : todo,
      );
    case REMOVE_COMPLETED_ITEMS:
      return state.filter((todo) => !todo.completed);
  }
};
