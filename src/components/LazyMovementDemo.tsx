import { lazy, Suspense, type ComponentProps } from 'react';

// Three.js is large, so the 3D studio loads on demand.
const MovementDemo = lazy(() => import('./MovementDemo'));

export default function LazyMovementDemo(props: ComponentProps<typeof MovementDemo>) {
  return (
    <Suspense fallback={<div className="demo-loading" />}>
      <MovementDemo {...props} />
    </Suspense>
  );
}
