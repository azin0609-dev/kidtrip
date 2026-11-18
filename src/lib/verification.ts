/**
 * 查證狀態：把「最後整理日期」和「實際查證」分開。純函式。
 * - last_verified：最後整理日期（資料剛加入或修改過，不代表查證過）
 * - verified.date / verified.fields：實際查證的日期和確認過的項目
 * - needs_verify：還沒確認的欄位
 * - risk_flags：高風險的未確認項目，有的話暫停自動推薦
 */
import type { RiskFlag } from '../data/enums.ts';

export type VerificationStatus = 'verified' | 'partial' | 'unverified' | 'conflict';

export interface Verifiable {
  last_verified: string;
  needs_verify: readonly string[];
  verified?: { date: string; fields: readonly string[] };
  risk_flags?: readonly RiskFlag[];
}

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  verified: '已確認',
  partial: '部分確認',
  unverified: '待確認',
  conflict: '資料有矛盾，待再次確認',
};

export const RISK_LABELS: Record<RiskFlag, string> = {
  access_unknown: '外人能不能進去還沒確認',
  location_unknown: '實際位置和停車還沒確認',
  facility_unknown: '主要設施還在不在還沒確認',
  status_conflict: '營業狀態的資料互相矛盾',
};

export interface Verification {
  status: VerificationStatus;
  /** 最後整理日期 */
  lastUpdated: string;
  /** 最後實際查證日期；沒查過是 null */
  verifiedAt: string | null;
  verifiedFields: readonly string[];
  needsVerify: readonly string[];
  risks: readonly RiskFlag[];
}

export function verificationOf(item: Verifiable): Verification {
  const risks = item.risk_flags ?? [];
  let status: VerificationStatus;
  if (risks.includes('status_conflict')) status = 'conflict';
  else if (!item.verified) status = 'unverified';
  else if (item.needs_verify.length === 0 && risks.length === 0) status = 'verified';
  else status = 'partial';
  return {
    status,
    lastUpdated: item.last_verified,
    verifiedAt: item.verified?.date ?? null,
    verifiedFields: item.verified?.fields ?? [],
    needsVerify: item.needs_verify,
    risks,
  };
}

/** 能不能自動推薦：有高風險的未確認項目就先不推（資料保留，等查證）。只是一般欄位待確認不影響。 */
export function isRecommendable(item: Pick<Verifiable, 'risk_flags'>): boolean {
  return (item.risk_flags ?? []).length === 0;
}

/** 營業狀態能不能說「查過還在營業」：要有查證紀錄，而且沒有矛盾。 */
export function canClaimOpen(item: Verifiable): boolean {
  const v = verificationOf(item);
  return v.verifiedAt !== null && v.status !== 'conflict';
}
