import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CITY } from '../lib/config';
import { problemsToGeoJSON, type Problem } from '../data/mockProblems';
import { STATUS_META } from '../lib/statuses';
import { FilterSheet } from '../components/FilterSheet';
import { AppHeader } from '../components/AppHeader';
import { Onboarding } from '../components/Onboarding';
import { AddressSearch } from '../components/AddressSearch';
import { useFilters, applyFilters, activeFilterCount } from '../store/filters';
import { useProblems } from '../lib/problems';
import { wakeUpServer } from '../lib/api';
import './MapScreen.css';

// Временная растровая подложка OSM. На фазе 4 заменяется своим PMTiles + фирменным
// стилем (раздел 10.1–10.2 ТЗ).
const RASTER_STYLE = {
  version: 8,
  glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
} as unknown as maplibregl.StyleSpecification;

export function MapScreen() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [selected, setSelected] = useState<Problem | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const filters = useFilters();

  // Разбудить сервер Render Free tier сразу, пока пользователь ходит по карте —
  // к моменту отправки формы (~30-60 сек позже) сервер уже проснётся.
  useEffect(() => {
    wakeUpServer();
  }, []);

  // Данные из API. Держим в ref, чтобы обработчики карты (созданные один раз) видели
  // актуальный набор проблем.
  const { data: problems = [] } = useProblems();
  const problemsRef = useRef<Problem[]>([]);
  problemsRef.current = problems;
  const fittedRef = useRef(false);

  function fitToProblems(map: maplibregl.Map, items: Problem[]) {
    if (items.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const p of items) bounds.extend([p.lng, p.lat]);
    map.fitBounds(bounds, { padding: { top: 90, bottom: 130, left: 40, right: 40 }, maxZoom: 15, duration: 0 });
    fittedRef.current = true;
  }

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: RASTER_STYLE,
      center: CITY.center,
      zoom: CITY.zoom,
      maxZoom: 17,
      attributionControl: false,
    });
    mapRef.current = map;
    if (import.meta.env.DEV) (window as unknown as { __map: maplibregl.Map }).__map = map;
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    // Инициализацию данных вешаем на style.load, а НЕ на 'load' (оно ждёт рендера тайлов).
    const setupData = () => {
      if (map.getSource('problems')) return;

      const current = applyFilters(problemsRef.current, useFilters.getState());
      map.addSource('problems', {
        type: 'geojson',
        data: problemsToGeoJSON(current) as never,
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 15,
      });
      if (problemsRef.current.length) fitToProblems(map, problemsRef.current);

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'problems',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#0ad1c9',
          'circle-radius': ['step', ['get', 'point_count'], 16, 5, 22, 15, 28],
          'circle-opacity': 0.92,
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      });
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'problems',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 13,
        },
        paint: { 'text-color': '#063a37' },
      });
      map.addLayer({
        id: 'points',
        type: 'circle',
        source: 'problems',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'match',
            ['get', 'status'],
            'found', STATUS_META.found.color,
            'in_progress', STATUS_META.in_progress.color,
            'resolved', STATUS_META.resolved.color,
            'declined', STATUS_META.declined.color,
            STATUS_META.found.color,
          ],
          'circle-radius': 9,
          'circle-stroke-width': ['match', ['get', 'status'], 'found', 3, 2],
          'circle-stroke-color': ['match', ['get', 'status'], 'found', '#0ad1c9', '#ffffff'],
        },
      });

      map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        const clusterId = features[0]?.properties?.cluster_id;
        const source = map.getSource('problems') as maplibregl.GeoJSONSource;
        source.getClusterExpansionZoom(clusterId).then((zoom) => {
          map.easeTo({
            center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number],
            zoom,
            duration: 600,
          });
        });
      });

      map.on('click', 'points', (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        setSelected(problemsRef.current.find((p) => p.id === id) ?? null);
      });

      for (const layer of ['points', 'clusters']) {
        map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
      }
    };

    if (map.isStyleLoaded()) setupData();
    else map.once('style.load', setupData);

    map.on('error', (e) => {
      const msg = (e && e.error && e.error.message) || '';
      if (import.meta.env.DEV && !/tile|fetch|abort/i.test(msg)) console.warn('[map]', msg || e);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Обновляем данные источника при приходе данных из API и при смене фильтров.
  // Кластеры пересчитываются на отфильтрованном наборе (раздел 10.3 ТЗ).
  useEffect(() => {
    const map = mapRef.current;
    const src = map?.getSource('problems') as maplibregl.GeoJSONSource | undefined;
    if (!map || !src) return;
    src.setData(problemsToGeoJSON(applyFilters(problems, filters)) as never);
    if (!fittedRef.current) fitToProblems(map, problems);
  }, [problems, filters.statuses, filters.categories, filters.hideResolved, filters.period]);

  function locate() {
    const map = mapRef.current;
    if (!map || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 15, duration: 800 });
    });
  }

  return (
    <div className="map-screen">
      <AppHeader />

      <div className="map-topbar">
        <div className="search-box search-box--wrap">
          <span>🔎</span>
          <AddressSearch
            value={searchQuery}
            placeholder="Поиск по адресу или улице"
            onChange={setSearchQuery}
            onPick={(r) => {
              setSearchQuery(r.short);
              mapRef.current?.flyTo({ center: [r.lng, r.lat], zoom: 16, duration: 900 });
            }}
            className="search-box__field"
          />
        </div>
        <button className="filter-btn" aria-label="Фильтры" onClick={() => setShowFilters(true)}>
          ⚙️
          {activeFilterCount(filters) > 0 && <span className="filter-badge">{activeFilterCount(filters)}</span>}
        </button>
      </div>

      <div ref={containerRef} className="map-canvas" />

      <Onboarding />

      <button className="locate-btn" onClick={locate} aria-label="Моё местоположение">
        📍
      </button>
      <button className="report-btn" onClick={() => navigate('/report')}>
        ＋ Сообщить о проблеме
      </button>

      {selected && (
        <ProblemPreview
          problem={selected}
          onClose={() => setSelected(null)}
          onOpen={() => navigate(`/problem/${selected.id}`)}
        />
      )}

      {showFilters && <FilterSheet onClose={() => setShowFilters(false)} />}
    </div>
  );
}

function ProblemPreview({
  problem,
  onClose,
  onOpen,
}: {
  problem: Problem;
  onClose: () => void;
  onOpen: () => void;
}) {
  const meta = STATUS_META[problem.status];
  const pct = Math.min(100, Math.round((problem.signatures / problem.signatureGoal) * 100));
  return (
    <div className="preview-sheet">
      <div className="preview-head">
        <span className="status-chip" style={{ background: meta.color }}>
          {meta.label}
        </span>
        <button className="preview-close" onClick={onClose} aria-label="Закрыть">
          ✕
        </button>
      </div>
      <h3 className="preview-title">{problem.title}</h3>
      <div className="muted preview-meta">
        📍 {problem.address} · {problem.category}
      </div>
      <div className="progress">
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="muted preview-sign">
        {problem.signatures} из {problem.signatureGoal} подписей до подачи в администрацию
      </div>
      <button className="cta preview-open" onClick={onOpen}>
        Подробнее
      </button>
    </div>
  );
}
