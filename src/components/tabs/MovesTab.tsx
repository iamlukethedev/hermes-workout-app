import { BookOpen, ChevronRight, Play } from 'lucide-react';
import type { Plan, PlanExercise } from '../../lib/plan';

type Props = {
  plan: Plan;
  filter: string;
  onFilterChange: (filter: string) => void;
  onOpenExercise: (exercise: PlanExercise) => void;
};

export default function MovesTab({ plan, filter, onFilterChange, onOpenExercise }: Props) {
  const groups = ['All', ...new Set(plan.exercises.map((e) => e.group))];
  const active = groups.includes(filter) ? filter : 'All';
  const shown = plan.exercises.filter((e) => active === 'All' || e.group === active);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">UNDERSTAND EVERY MOVEMENT</div>
          <h1>Your movement lab.</h1>
          <p>Watch. Rotate. Slow it down. Then move through a range that feels comfortable.</p>
        </div>
      </div>
      {groups.length > 2 && (
        <div className="filter-row">
          {groups.map((x) => (
            <button
              className={active === x ? 'selected' : ''}
              key={x}
              onClick={() => onFilterChange(x)}
            >
              {x}
            </button>
          ))}
        </div>
      )}
      <div className="movement-grid">
        {shown.map((e) => (
          <button className="movement-card" key={e.id} onClick={() => onOpenExercise(e)}>
            <div className={'movement-art' + (e.demo ? '' : ' movement-art-text')}>
              <span className="big-number">
                {String(plan.exercises.indexOf(e) + 1).padStart(2, '0')}
              </span>
              {e.demo ? (
                <img
                  className="movement-thumb"
                  src={`${import.meta.env.BASE_URL}thumbs/${e.demo}.jpg`}
                  alt=""
                  loading="lazy"
                  width={720}
                  height={362}
                />
              ) : (
                <span className="movement-glyph-text" aria-hidden="true">
                  {e.name}
                </span>
              )}
              <span className="play-orb">
                {e.demo ? <Play size={19} /> : <BookOpen size={18} />}
              </span>
              <span className="art-tag">{e.demo ? 'INTERACTIVE 3D' : 'STEP-BY-STEP GUIDE'}</span>
            </div>
            <div className="movement-card-copy">
              <span className="eyebrow">{e.group}</span>
              <h3>{e.name}</h3>
              <p>{e.cue}</p>
              <span>
                {e.equipment}
                <ChevronRight size={15} />
              </span>
            </div>
          </button>
        ))}
      </div>
      <p className="small muted">
        Schematic animations explain movement direction. They are not an assessment of your
        technique or a substitute for a physiotherapist.
      </p>
    </>
  );
}
