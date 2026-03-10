/**
 * MeritX — Unified UI Status Engine (Base L2)
 *
 * Contract states: 0=Funding, 1=Failed, 3=Ready_For_DEX
 * (State 2 = Success_Isolated exists in enum but is never returned by currentState())
 */
export function getUIConfig(state, role = 'user', isLiquidated = false, hasClaimed = false) {
  switch (state) {
    case 0:
      return {
        badgeText:  '[SYNC] SOURCING_NODE',
        badgeColor: 'text-blue-400',
        bgColor:    'bg-blue-500/10',
        dotClass:   'bg-blue-500 animate-pulse',
        buttonText: role === 'user' ? 'INJECT COMPUTE' : 'AWAITING...',
        actionType: role === 'user' ? 'CONTRIBUTE' : 'NONE',
        canAction:  role === 'user',
      };

    case 1:
      return {
        badgeText:  '[ERR] INSUFFICIENT_GAS',
        badgeColor: 'text-red-400',
        bgColor:    'bg-red-500/10',
        dotClass:   'bg-red-500',
        buttonText: role === 'user' ? 'CLAIM REFUND' : 'FAILED',
        actionType: role === 'user' ? 'REFUND' : 'NONE',
        canAction:  role === 'user',
      };

    case 2:
      return {
        badgeText:  '[LOCK] SECURING_WEIGHTS',
        badgeColor: 'text-purple-400',
        bgColor:    'bg-purple-500/10',
        dotClass:   'bg-purple-500',
        buttonText: 'WEIGHTS LOCKED',
        actionType: 'NONE',
        canAction:  false,
      };

    case 3:
      if (role === 'admin') {
        return isLiquidated
          ? { badgeText: '[DONE] SETTLED', badgeColor: 'text-zinc-500', bgColor: 'bg-zinc-500/10', dotClass: 'bg-zinc-500', buttonText: 'SETTLED', actionType: 'NONE', canAction: false }
          : { badgeText: '[LIVE] AUTONOMOUS_STATE', badgeColor: 'text-amber-400', bgColor: 'bg-amber-500/10', dotClass: 'bg-amber-400 animate-pulse', buttonText: 'READY FOR DEX', actionType: 'NONE', canAction: false };
      }
      return hasClaimed
        ? { badgeText: '[LIVE] AUTONOMOUS_STATE', badgeColor: 'text-amber-400', bgColor: 'bg-amber-500/10', dotClass: 'bg-amber-400', buttonText: 'CLAIMED', actionType: 'NONE', canAction: false }
        : { badgeText: '[LIVE] AUTONOMOUS_STATE', badgeColor: 'text-amber-400', bgColor: 'bg-amber-500/10', dotClass: 'bg-amber-400 animate-pulse', buttonText: 'CLAIM POP TOKENS', actionType: 'CLAIM', canAction: true };

    default:
      return {
        badgeText:  'UNKNOWN',
        badgeColor: 'text-zinc-600',
        bgColor:    'bg-zinc-600/10',
        dotClass:   'bg-zinc-600',
        buttonText: '\u2014',
        actionType: 'NONE',
        canAction:  false,
      };
  }
}
