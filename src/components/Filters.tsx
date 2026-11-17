import type { ReactNode } from 'react';
import { FACILITIES, HOTEL_KINDS, HOTEL_TAGS, SPOT_TYPES } from '../data/enums.ts';
import { DRIVE_OPTIONS, type HotelFilters, type SpotFilters, toggleInList } from '../lib/filter.ts';
import { FACILITY_LABELS, HOTEL_KIND_LABELS, HOTEL_TAG_LABELS, REGION_OPTIONS, TYPE_LABELS } from '../lib/labels.ts';
import { Chip, ChipGroup, SearchBox } from './ui.tsx';

type DriveRegion = { drive: SpotFilters['drive']; region: SpotFilters['region']; county: string };
export type CountyOption = { county: string; count: number };

/** 縣市：一排可以左右滑的按鈕，近的排前面。選了縣市就不再限制北中南東。 */
function CountyChips<T extends DriveRegion>({
  value,
  onChange,
  counties,
}: {
  value: T;
  onChange: (v: T) => void;
  counties: CountyOption[];
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-xs font-medium text-stone-600 dark:text-stone-400">縣市（可以左右滑）</legend>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:thin]">
        <span className="shrink-0">
          <Chip pressed={value.county === 'all'} onClick={() => onChange({ ...value, county: 'all' })}>
            全部
          </Chip>
        </span>
        {counties.map((c) => (
          <span key={c.county} className="shrink-0">
            <Chip
              pressed={value.county === c.county}
              onClick={() => onChange({ ...value, county: value.county === c.county ? 'all' : c.county, region: 'all' })}
            >
              {c.county}
              <span className="ml-1 text-xs opacity-70">{c.count}</span>
            </Chip>
          </span>
        ))}
      </div>
    </fieldset>
  );
}

function DriveChips<T extends DriveRegion>({ value, onChange }: { value: T; onChange: (v: T) => void }) {
  return (
    <ChipGroup label="車程">
      {DRIVE_OPTIONS.map((o) => (
        <Chip key={o.value} pressed={value.drive === o.value} onClick={() => onChange({ ...value, drive: o.value })}>
          {o.label}
        </Chip>
      ))}
    </ChipGroup>
  );
}

function RegionChips<T extends DriveRegion>({ value, onChange }: { value: T; onChange: (v: T) => void }) {
  return (
    <>
      <ChipGroup label="地區">
        <Chip pressed={value.region === 'all'} onClick={() => onChange({ ...value, region: 'all' })}>
          全部
        </Chip>
        {REGION_OPTIONS.map((r) => (
          <Chip key={r} pressed={value.region === r} onClick={() => onChange({ ...value, region: r, county: 'all' })}>
            {r}部
          </Chip>
        ))}
      </ChipGroup>
    </>
  );
}

const TOGGLES: { key: 'rainOk' | 'free' | 'stroller' | 'hideBeen'; label: string }[] = [
  { key: 'rainOk', label: '下雨也能玩' },
  { key: 'free', label: '免費' },
  { key: 'stroller', label: '推車好推' },
  { key: 'hideBeen', label: '隱藏去過的' },
];

export function SpotFiltersPanel({
  value,
  onChange,
  counties,
}: {
  value: SpotFilters;
  onChange: (v: SpotFilters) => void;
  counties: CountyOption[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <SearchBox
        value={value.query}
        onChange={(query) => onChange({ ...value, query })}
        placeholder="搜尋名稱、城市、類型，例如：恐龍 台中"
      />
      <DriveChips value={value} onChange={onChange} />
      <CountyChips value={value} onChange={onChange} counties={counties} />
      <ChipGroup label="條件">
        {TOGGLES.map((t) => (
          <Chip key={t.key} pressed={value[t.key]} onClick={() => onChange({ ...value, [t.key]: !value[t.key] })}>
            {t.label}
          </Chip>
        ))}
      </ChipGroup>
      <MoreFilters label="設施、地區、類型" active={(value.region === 'all' ? 0 : 1) + value.types.length + value.facilities.length}>
        <ChipGroup label="設施（選了的都要有）">
          {FACILITIES.map((f) => (
            <Chip
              key={f}
              pressed={value.facilities.includes(f)}
              onClick={() => onChange({ ...value, facilities: toggleInList(value.facilities, f) })}
            >
              {FACILITY_LABELS[f]}
            </Chip>
          ))}
        </ChipGroup>
        <RegionChips value={value} onChange={onChange} />
        <ChipGroup label="類型（可多選，符合任一）">
          {SPOT_TYPES.map((t) => (
            <Chip key={t} pressed={value.types.includes(t)} onClick={() => onChange({ ...value, types: toggleInList(value.types, t) })}>
              {TYPE_LABELS[t]}
            </Chip>
          ))}
        </ChipGroup>
      </MoreFilters>
    </div>
  );
}

export function HotelFiltersPanel({
  value,
  onChange,
  counties,
}: {
  value: HotelFilters;
  onChange: (v: HotelFilters) => void;
  counties: CountyOption[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <SearchBox
        value={value.query}
        onChange={(query) => onChange({ ...value, query })}
        placeholder="搜尋名稱、城市、特色，例如：溜滑梯 宜蘭"
      />
      <DriveChips value={value} onChange={onChange} />
      <CountyChips value={value} onChange={onChange} counties={counties} />
      <ChipGroup label="類型">
        <Chip pressed={value.kind === 'all'} onClick={() => onChange({ ...value, kind: 'all' })}>
          全部
        </Chip>
        {HOTEL_KINDS.map((k) => (
          <Chip key={k} pressed={value.kind === k} onClick={() => onChange({ ...value, kind: k })}>
            {HOTEL_KIND_LABELS[k]}
          </Chip>
        ))}
      </ChipGroup>
      <MoreFilters label="地區、設施" active={(value.region === 'all' ? 0 : 1) + value.tags.length}>
        <RegionChips value={value} onChange={onChange} />
        <ChipGroup label="設施（可多選，符合任一）">
          {HOTEL_TAGS.map((t) => (
            <Chip key={t} pressed={value.tags.includes(t)} onClick={() => onChange({ ...value, tags: toggleInList(value.tags, t) })}>
              {HOTEL_TAG_LABELS[t]}
            </Chip>
          ))}
        </ChipGroup>
      </MoreFilters>
    </div>
  );
}

/** 地區、類型收在「更多篩選」裡，手機上不用一直往下滑。 */
function MoreFilters({ label, active, children }: { label: string; active: number; children: ReactNode }) {
  return (
    <details className="group" open={active > 0 || undefined}>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-xl text-sm font-medium text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-emerald-300 [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">›</span>
        更多篩選：{label}{active > 0 && `（已選 ${active}）`}
      </summary>
      <div className="mt-2 flex flex-col gap-4">{children}</div>
    </details>
  );
}
