# 3D trainer asset

## Selected asset

- Author: Quaternius
- Pack: Universal Base Characters
- Model: Superhero Male, rigged humanoid
- Licence: CC0 1.0 Universal
- Official pack: https://quaternius.com/packs/universalbasecharacters.html
- GLB source: https://github.com/programasweights/avatar/blob/main/public/assets/character.glb
- Source provenance: https://github.com/programasweights/avatar/blob/main/ASSETS.md
- Local file: `public/models/trainer.glb`
- SHA-256: `d6f3b64cab629f6ddca9ba063811aeffd3663a8a4e49ade47cd9505dc2bbd70f`
- Licence text: `public/models/QUATERNIUS-LICENSE.txt`

The upstream GLB preserves the mesh, skeleton and skin weights, with a simple material. Hermes Workout supplies its own vertex colours, studio, equipment and skeletal movement authoring, and uses no upstream application code. The checksum above pins the bundled file independently of future upstream changes.

## Runtime

Three.js and its built-in GLTFLoader load the model. Fixed-length skeletal animation uses inverse kinematics for the hands and feet. WebGL provides smooth lighting and shadows; a Canvas renderer uses the same posed skinned geometry when WebGL is unavailable. CPU mode is deliberately frame-limited. This is illustrative educational animation and is not a biomechanics simulation, diagnosis or personalised assessment.
