import { useEffect, useState } from 'react';
import { Search, Star } from 'lucide-react';
import { CATEGORIES, MODELS, categoryName } from '../../models/registry';
import { useApp } from '../AppState';
import { useModelThumbs } from '../thumbs';
import { ShapeThumb } from '../components/ShapeThumb';
import { KEYS, load, save } from '../storage';
import { go } from '../router';

export function Library() {
  const { settings, syncVersion } = useApp();
  const thumbs = useModelThumbs();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('todas');
  const [favs, setFavs] = useState<string[]>(() => load<string[]>(KEYS.favorites, []));
  useEffect(() => setFavs(load<string[]>(KEYS.favorites, [])), [syncVersion]);
  const recent = load<string[]>(KEYS.recentModels, []);

  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
    setFavs(next);
    save(KEYS.favorites, next);
  };

  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const list = MODELS.filter((m) => {
    if (cat === 'favoritos' && !favs.includes(m.id)) return false;
    if (cat === 'recentes' && !recent.includes(m.id)) return false;
    if (!['todas', 'favoritos', 'recentes'].includes(cat) && m.category !== cat) return false;
    return !q || norm(`${m.name} ${m.description} ${(m.tags ?? []).join(' ')}`).includes(norm(q));
  });
  const used = CATEGORIES.filter((c) => MODELS.some((m) => m.category === c.id));

  return (
    <div className="page">
      <div className="section-head">
        <div>
          <p className="eyebrow">Biblioteca</p>
          <h1>Escolha um modelo</h1>
        </div>
        <label className="search">
          <Search size={16} />
          <input placeholder="Buscar modelo" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar modelo" />
        </label>
      </div>
      <div className="chips">
        {[{ id: 'todas', name: 'Todas' }, { id: 'favoritos', name: 'Favoritos' }, { id: 'recentes', name: 'Recentes' }, ...used].map((c) => (
          <button key={c.id} className={`chip ${cat === c.id ? 'active' : ''}`} onClick={() => setCat(c.id)}>{c.name}</button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="muted">Nenhum modelo encontrado.</p>
      ) : (
        <div className="cards">
          {list.map((m) => (
            <article key={m.id} className="card model-card">
              <button className={`fav ${favs.includes(m.id) ? 'on' : ''}`} onClick={() => toggleFav(m.id)} aria-label={favs.includes(m.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}>
                <Star size={18} />
              </button>
              <div className="model-thumb">{thumbs[m.id] && <ShapeThumb shape={thumbs[m.id].solid} engrave={thumbs[m.id].engrave} fill={settings.materials[0].cor} engraveFill={settings.materials[0].corGravacao} />}</div>
              <span className="tag">{categoryName(m.category)}</span>
              <h3>{m.name}</h3>
              <p>{m.description}</p>
              <div className="tags">{m.tags?.map((t) => <span key={t} className="tag tag-soft">{t}</span>)}</div>
              <button className="btn btn-primary btn-block" onClick={() => go(`#/estudio/${m.id}`)}>Personalizar</button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
