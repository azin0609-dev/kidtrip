/**
 * 「換我決定！」的流程：小孩先點一張卡（只是暫選），家長按「確認這個地方」才真的存成這週放電計畫。
 * 關掉、取消、再選一次都不會動到原本的計畫。純函式。
 */

export interface KidPickState {
  /** 小孩暫選的景點 id；還沒選是 null。 */
  selectedId: string | null;
  /** 家長確認過了。 */
  confirmed: boolean;
}

export type KidPickAction =
  | { type: 'select'; id: string }
  | { type: 'reselect' }
  | { type: 'confirm' }
  | { type: 'close' };

export interface KidPickStep {
  state: KidPickState;
  /** 這一步要存成計畫的景點 id；只有家長確認那一步才會有。 */
  commit: string | null;
}

export const KIDPICK_INITIAL: KidPickState = { selectedId: null, confirmed: false };

export function kidPickStep(state: KidPickState, action: KidPickAction): KidPickStep {
  switch (action.type) {
    case 'select':
      // 已經確認過就不再改，避免確認後又被誤觸換掉。
      if (state.confirmed) return { state, commit: null };
      return { state: { selectedId: action.id, confirmed: false }, commit: null };
    case 'reselect':
      return { state: KIDPICK_INITIAL, commit: null };
    case 'confirm':
      if (!state.selectedId || state.confirmed) return { state, commit: null };
      return { state: { ...state, confirmed: true }, commit: state.selectedId };
    case 'close':
      return { state: KIDPICK_INITIAL, commit: null };
  }
}
