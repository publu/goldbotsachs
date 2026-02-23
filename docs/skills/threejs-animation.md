# Three.js Animation Skill

You can create interactive 3D animations using Three.js. Use this skill when asked to create visualizations, animations, 3D scenes, or interactive graphics.

## Setup

Use Three.js via ES module import map. No build step needed.

```html
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js"
  }
}
</script>

<script type="module">
  import * as THREE from 'three';
  // Your code here
</script>
```

## Boilerplate

Every Three.js scene needs a renderer, scene, camera, and animation loop:

```javascript
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 0, 20);

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t = clock.getElapsedTime();
  // Update objects here
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
```

## Core Geometries

```javascript
new THREE.SphereGeometry(radius, widthSegments, heightSegments)
new THREE.BoxGeometry(width, height, depth)
new THREE.PlaneGeometry(width, height)
new THREE.CylinderGeometry(radiusTop, radiusBot, height, segments)
new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments)
new THREE.BufferGeometry()  // Custom geometry via attributes
```

## Materials

```javascript
// Unlit, flat color — best for stylized/glowing visuals
new THREE.MeshBasicMaterial({ color: 0xC9A84C, transparent: true, opacity: 0.8 })

// Requires lights — realistic shading
new THREE.MeshStandardMaterial({ color: 0xff0000, metalness: 0.5, roughness: 0.3 })

// Lines
new THREE.LineBasicMaterial({ color: 0x333340, transparent: true, opacity: 0.3 })

// Point clouds
new THREE.PointsMaterial({ color: 0x444455, size: 0.05, transparent: true, opacity: 0.5 })
```

## Lines and Connections

```javascript
const points = [new THREE.Vector3(0,0,0), new THREE.Vector3(1,1,0)];
const geo = new THREE.BufferGeometry().setFromPoints(points);
const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffffff }));
scene.add(line);
```

## Point Clouds (Particles)

```javascript
const count = 500;
const positions = new Float32Array(count * 3);
for (let i = 0; i < count; i++) {
  positions[i*3]   = (Math.random() - 0.5) * 50;
  positions[i*3+1] = (Math.random() - 0.5) * 50;
  positions[i*3+2] = (Math.random() - 0.5) * 50;
}
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.05 }));
scene.add(points);
```

## Animation Patterns

### Smooth easing (smoothstep)
```javascript
const ease = t * t * (3 - 2 * t); // t in [0, 1]
```

### Oscillation
```javascript
mesh.position.y = baseY + Math.sin(time * speed + offset) * amplitude;
```

### Lerp between positions
```javascript
mesh.position.lerpVectors(start, end, t);
```

### Particle lifecycle
```javascript
// Spawn particles, update t, remove when t >= 1
particles.push({ mesh, from, to, t: 0, speed: 0.3 + Math.random() * 0.4 });

// In loop:
p.t += dt * p.speed;
if (p.t >= 1) { scene.remove(p.mesh); /* cleanup */ }
const ease = p.t * p.t * (3 - 2 * p.t);
p.mesh.position.lerpVectors(p.from, p.to, ease);
p.mesh.material.opacity = Math.sin(p.t * Math.PI); // fade in/out
```

### Camera sway
```javascript
camera.position.x = Math.sin(t * 0.1) * 2;
camera.position.y = baseY + Math.sin(t * 0.08) * 1;
camera.lookAt(target);
```

## Fog

```javascript
scene.fog = new THREE.FogExp2(0x0A0A0F, 0.03); // exponential
scene.fog = new THREE.Fog(0x0A0A0F, 10, 80);   // linear near/far
```

## Performance Tips

- Use `IntersectionObserver` to pause rendering when off-screen
- Cap `devicePixelRatio` at 2: `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`
- Reuse geometries across meshes — only create new materials when properties differ
- Dispose meshes when removing: `scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose();`
- Cap delta time: `const dt = Math.min(clock.getDelta(), 0.05)` to avoid jumps on tab switch
- For embedded animations (not fullscreen), size renderer to container, not window

## Embedding in an existing page

When adding a Three.js scene as a section background:

```javascript
const section = document.getElementById('my-section');
const canvas = document.getElementById('my-canvas');

function resize() {
  const w = section.clientWidth;
  const h = section.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);

// Only render when visible
let isVisible = false;
const observer = new IntersectionObserver(entries => {
  isVisible = entries[0].isIntersecting;
}, { threshold: 0.05 });
observer.observe(section);

function animate() {
  requestAnimationFrame(animate);
  if (!isVisible) return;
  // ...render
}
```

## Building Network/Tree Visualizations

For pyramid/tree structures (referral trees, org charts, dependency graphs):

```javascript
const levels = 6;
const spreadX = 3.0;
const spreadY = 3.5;
const nodes = [];
const edges = [];
const levelStarts = [];
let idx = 0;

for (let level = 0; level < levels; level++) {
  levelStarts.push(idx);
  const count = Math.pow(2, level);  // binary tree
  const totalWidth = (count - 1) * spreadX;
  for (let i = 0; i < count; i++) {
    const x = -totalWidth / 2 + i * spreadX;
    const y = (levels/2 - level) * spreadY;
    nodes.push({ pos: new THREE.Vector3(x, y, 0), level, index: i });
    if (level > 0) {
      edges.push({ from: levelStarts[level-1] + Math.floor(i/2), to: idx });
    }
    idx++;
  }
}
```

Then render nodes as spheres, edges as lines, and animate particles flowing along edges.
