import { useEffect, useRef, useState } from 'react';
import { searchAddress, type GeocodeResult } from '../lib/geocode';
import './AddressSearch.css';

interface Props {
  value: string;
  placeholder?: string;
  onChange: (text: string) => void;
  onPick: (result: GeocodeResult) => void;
  className?: string;
}

// Универсальный поисковик адресов (Nominatim). Live-подсказки после 3+ символов,
// debounce 400ms — чтобы уложиться в лимит 1 req/sec Nominatim.
export function AddressSearch({ value, placeholder, onChange, onPick, className }: Props) {
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [openList, setOpenList] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (value.trim().length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    const t = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const found = await searchAddress(value, ctrl.signal);
        setResults(found);
        setOpenList(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [value]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpenList(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={boxRef} className={'addr-search ' + (className ?? '')}>
      <input
        className="text-input"
        placeholder={placeholder ?? 'Улица и дом, например «Петровская, 45»'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpenList(true)}
      />
      {loading && <span className="addr-search__loader">⏳</span>}
      {openList && results.length > 0 && (
        <div className="addr-search__list">
          {results.map((r, i) => (
            <button
              key={i}
              className="addr-search__item"
              onClick={() => {
                onPick(r);
                setOpenList(false);
              }}
            >
              <div className="addr-search__short">{r.short}</div>
              <div className="addr-search__full">{r.displayName}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
