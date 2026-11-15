import { ChevronRight, Dumbbell, Play } from 'lucide-react';
import { exercises, type Exercise } from '../../lib/training';

type Props = {
  filter: string;
  onFilterChange: (filter: string) => void;
  onOpenExercise: (exercise: Exercise) => void;
};

export default function MovesTab({ filter, onFilterChange, onOpenExercise }: Props) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">UNDERSTAND EVERY MOVEMENT</div>
          <h1>Your movement lab.</h1>
          <p>Watch. Rotate. Slow it down. Then move through a range that feels comfortable.</p>
        </div>
      </div>
      <div className="filter-row">
        {['All', 'Legs', 'Upper body', 'Core & hips'].map((x) => (
          <button
            className={filter === x ? 'selected' : ''}
            key={x}
            onClick={() => onFilterChange(x)}
          >
            {x}
          </button>
        ))}
      </div>
      <div className="movement-grid">
        {exercises
          .filter(
            (e) =>
              filter === 'All' ||
              (filter === 'Legs' && ['squat', 'split', 'calf'].includes(e.id)) ||
              (filter === 'Upper body' && ['press', 'row', 'pushup', 'curl'].includes(e.id)) ||
              (filter === 'Core & hips' && ['heel', 'bird', 'bridge'].includes(e.id)),
          )
          .map((e) => (
            <button className="movement-card" key={e.id} onClick={() => onOpenExercise(e)}>
              <div className={'movement-art art-' + e.id}>
                <span className="big-number">
                  {String(exercises.indexOf(e) + 1).padStart(2, '0')}
                </span>
                <div className="movement-glyph">
                  <Dumbbell size={44} strokeWidth={1} />
                </div>
                <span className="play-orb">
                  <Play size={19} />
                </span>
                <span className="art-tag">INTERACTIVE 3D</span>
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
