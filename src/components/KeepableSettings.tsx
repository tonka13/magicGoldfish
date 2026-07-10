import { describeKeepable, producersCounted } from '../lib/mana';
import type { KeepableConfig } from '../lib/types';

export default function KeepableSettings({
  config,
  onChange,
}: {
  config: KeepableConfig;
  onChange: (config: KeepableConfig) => void;
}) {
  const set = (patch: Partial<KeepableConfig>) => onChange({ ...config, ...patch });
  const num = (value: string, fallback: number) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  return (
    <section className="panel">
      <h2>What counts as keepable?</h2>
      <div className="settings-row">
        <label>
          Mana sources ≥
          <input
            type="number"
            min={0}
            max={7}
            value={config.minSources}
            onChange={(e) => set({ minSources: num(e.target.value, config.minSources) })}
            aria-label="Minimum mana sources"
          />
        </label>
        <label>
          Lands ≤
          <input
            type="number"
            min={0}
            max={7}
            value={config.maxLands}
            onChange={(e) => set({ maxLands: num(e.target.value, config.maxLands) })}
            aria-label="Maximum lands"
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.countDorks}
            onChange={(e) => set({ countDorks: e.target.checked })}
          />
          Count mana dorks
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.countRocks}
            onChange={(e) => set({ countRocks: e.target.checked })}
          />
          Count mana rocks
        </label>
        {producersCounted(config) && (
          <>
            <label>
              Lands ≥
              <input
                type="number"
                min={0}
                max={7}
                value={config.minLands}
                onChange={(e) => set({ minLands: num(e.target.value, config.minLands) })}
                aria-label="Minimum actual lands when counting producers"
              />
            </label>
            <label>
              Producer mana value ≤
              <input
                type="number"
                min={0}
                max={16}
                value={config.maxProducerMV}
                onChange={(e) =>
                  set({ maxProducerMV: num(e.target.value, config.maxProducerMV) })
                }
                aria-label="Maximum mana value for counted producers"
              />
            </label>
          </>
        )}
      </div>
      <p className="muted small" style={{ marginBottom: 0 }}>
        Keepable = {describeKeepable(config)}.
        {producersCounted(config) &&
          ' Dorks are creatures that produce mana; rocks are artifacts that produce mana (detected from Scryfall data).'}
      </p>
    </section>
  );
}
