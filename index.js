const canvasSketch = require('canvas-sketch')
const eases = require('eases')
const { lerp } = require('canvas-sketch-util/math')
const palettes = require('nice-color-palettes')
const random = require('canvas-sketch-util/random')
const dat = require('dat.gui')
const set = require('lodash/set')
const preset = require('./preset');
const bas = require('three-bas')
const THREE = global.THREE = require('three')
require('three/examples/js/controls/OrbitControls')
THREE.BAS = bas
const SAVE = process.env.NODE_ENV === 'save'

const settings = {
  animate: true,
  context: 'webgl',
  duration: 10,
  attributes: { antialias: true },
  canvas: document.querySelector('#app'),
  ...SAVE && {
    dimensions: [600, 600],
    fps: 30
  }
}

function CFG() {
  this.cubesPerSide = 30
  this.remember = SAVE
  this.gridGutter = 4
  this.duration = 0.3
  this.maxGridScale = 0.3
  this.deltaX = 8
  this.maxPointSize = 6
  this.maxPointIncrease = 0.7
  this.scaleRandomness = 0.3
  this.delayRandomness = 0.1
  this.gridSize = 150
  this.zoom = 1
  this.cameraX = 6
  this.cameraY = 6
  this.cameraZ = 6
  this.totalDelay = 1.0
}

const cfg = new CFG()

let cubes

const sketch = ({ context, canvas }) => {
  const renderer = new THREE.WebGLRenderer({ context })
  renderer.setClearColor('hsl(0, 0%, 5%)', 1)

  const camera = new THREE.OrthographicCamera()
  const controls = new THREE.OrbitControls(camera, canvas)
  const gui = new dat.GUI({ 
    load: preset,
    ...!SAVE && { preset: 'overlapping' }
  })
  gui.closed = true
  
  if (cfg.remember) {
    gui.useLocalStorage = true
    gui.remember(cfg)
  }
  
  const f1 = gui.addFolder('Grid')
  f1.add(cfg, 'maxGridScale', 0, 4)
  f1.add(cfg, 'gridGutter', 0, 20)
  const f2 = gui.addFolder('Duration')
  f2.add(cfg, 'duration', 0, 7.8)
  f2.add(cfg, 'delayRandomness', 0, 0.4)
  const f3 = gui.addFolder('Points')
  f3.add(cfg, 'maxPointIncrease', 0, 1)
  f3.add(cfg, 'maxPointSize', 0, 20)
  f3.add(cfg, 'scaleRandomness', 0, 1)

  if (cfg.remember) {
    controls.addEventListener('change', evt => updateConfig(evt, cfg))
    const f4 = gui.addFolder('Controls')
    f4.add(cfg, 'zoom', 0, 3).listen().onChange(val => updateCamera('zoom', val))
    f4.add(cfg, 'cameraX', -60, 60).listen().onChange(val => updateCamera('position.x', val))
    f4.add(cfg, 'cameraY', -60, 60).listen().onChange(val => updateCamera('position.y', val))
    f4.add(cfg, 'cameraZ', -60, 60).listen().onChange(val => updateCamera('position.z', val))
    updateCamera('zoom', cfg.zoom)
  }

  const gridPoints = createUVWGrid([cfg.cubesPerSide, cfg.cubesPerSide, cfg.cubesPerSide])
  const scene = new THREE.Scene()
  const grid = new THREE.Group()
  const box = new THREE.BoxGeometry(0.1, 0.1, 0.1)
  const palette = getPalette(window && window.location.search)
  const toCenter = new THREE.Vector3(-0.5, -0.5, -0.5)
  const gridHalfSize = cfg.gridSize / 2

  window && SAVE && window.addEventListener('keyup', () => console.log(palettes.indexOf(palette), palette))

  function updateCamera(path, val) {
    set(camera, path, val)
    camera.updateProjectionMatrix()
    controls.update()
  }

  const startOffset = new THREE.Vector3(-cfg.deltaX * 0.5, 0, 0)
  const endOffset = new THREE.Vector3(cfg.deltaX * 0.5, 0, 0)
  const prefab = new THREE.BoxGeometry(0.1, 0.1, 0.1)
  const geometry = new THREE.BAS.PrefabBufferGeometry(prefab, gridPoints.length)
  // create a buffer for start positions per prefab, with an item size of 3 (x, y, z)
  var startPositionBuffer = geometry.createAttribute('startPosition', 3)
  // create a buffer for end positions per prefab, with an item size of 3 (x, y, z)
  var endPositionBuffer = geometry.createAttribute('endPosition', 3)
  // create a buffer for duration per prefab, with the item size of 1
  var durationBuffer = geometry.createAttribute('duration', 1)
  // create a buffer for start time per prefab, with the item size of 1
  var startTimeBuffer = geometry.createAttribute('startTime', 1)
  var colorBuffer = geometry.createAttribute('color', 3)
  var indexedScaleBuffer = geometry.createAttribute('indexedScale', 1)
  var scaleRandomnessBuffer = geometry.createAttribute('scaleRandomness', 1)

  gridPoints.forEach((v, index) => {
    // const color = random.pick(palette)
    // const mesh = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color }))
    const distance = v.dot(new THREE.Vector3(1, 1, 1)) / 3
    const position = v.add(toCenter).multiplyScalar(cfg.gridSize / cfg.cubesPerSide)
    const startPosition = position.clone().add(startOffset)
    const endPosition = position.clone().add(endOffset)
    const color = new THREE.Color(random.pick(palette))
    // @TODO, go back to the js variant and clean the update function up,
    // move a many things as possible to the attributes
    // eliminate magic numbers
    // figure out how durations from settings & cfg work together. I forgot

    // 
    // const delayWithRandomness = lerp(0, 1 - cfg.duration, distance) + (cfg.delayRandomness * cfg.delayRandomness - cfg.delayRandomness / 2)
    // mesh.userData = {
    //   delay: lerp(0, 1 - cfg.duration, distance),
    //   delayRandomness: random.value(),
    //   indexedScale: Math.sin(distance * Math.PI),
    //   position: position,
    //   scaleRandomness: random.value(),
    //   duration: cfg.duration,
    //   startPosition: position.clone().add(startOffset),
    //   endPosition: position.clone().add(endOffset)
    // }

    geometry.setPrefabData(startPositionBuffer, index, [startPosition.x, startPosition.y, startPosition.z])
    geometry.setPrefabData(endPositionBuffer, index, [endPosition.x, endPosition.y, endPosition.z])
    geometry.setPrefabData(durationBuffer, index, [cfg.duration]);
    geometry.setPrefabData(startTimeBuffer, index, [cfg.duration - lerp(0, 1 - cfg.duration, distance) + cfg.duration + (random.value() * cfg.delayRandomness - cfg.delayRandomness / 2)])
    geometry.setPrefabData(colorBuffer, index, [color.r, color.g, color.b])
    geometry.setPrefabData(indexedScaleBuffer, index, [Math.sin(distance * Math.PI)])
    geometry.setPrefabData(scaleRandomnessBuffer, index, [random.value()])
  })
  const glslTranspose = `
    float transpose(float t, float delay, float duration) {
      float res = 0.0;
      if(t - delay <= 0.0) {
        res = 0.0;
      } else if(t >= delay + duration) {
        res = 0.0;
      } else {
        res = (t - delay) / duration; 
      }

      return res;
    }
  `
  // create the animation material
  // it 'extends' THREE.MeshPhongMaterial by injecting arbitrary GLSL code at key places in the shader code
  material = new THREE.BAS.PhongAnimationMaterial({
    flatShading: true,
    vertexColors: THREE.VertexColors,
    uniforms: { time: { value: 0 } },
    vertexFunctions: [
      THREE.BAS.ShaderChunk['ease_cubic_in_out'],
      glslTranspose
    ],
    vertexParameters: [
      'uniform float time;',
      'attribute vec3 startPosition;',
      'attribute vec3 endPosition;',
      'attribute float startTime;',
      'attribute float duration;',
      'attribute float indexedScale;',
      'attribute float scaleRandomness;',
    ],
    vertexPosition: [
      'float tr = transpose(easeCubicInOut(time), startTime, duration);',
      'float scale = sin(tr * 3.14) * 1.0 * (scaleRandomness * 0.3 + 1.0) * (indexedScale * 1.2) + 0.01;',
      'float progress = easeCubicInOut(clamp(time - startTime, 0.0, duration) / duration);',
      '//transformed += mix(startPosition, endPosition, progress);',
      'transformed += startPosition;',
      'transformed *= scale;'
    ],
    vertexColor: [
      'vColor = color;'
    ]
  })

  cubes = new THREE.Mesh(geometry, material)
  scene.add(cubes)

  const ambientLight = new THREE.AmbientLight('hsl(0, 0%, 80%)')
  const light = new THREE.DirectionalLight('white', 1)
  light.position.set(0, 2, 4)
  scene.add(ambientLight)
  scene.add(light)

  return {
    render({ playhead }) {
      cubes.material.uniforms.time.value = playhead
      // reset time when it exceeds the total duration (plus a small delay)
      //cubes.material.uniforms.time.value %= (cfg.duration + cfg.totalDelay + 1.0);
      // grid.children.forEach((mesh) => {
        
      //   const { position, indexedScale, delay, scaleRandomness, delayRandomness, startPosition, endPosition, startTime, duration } = mesh.userData
      //   var progress = THREE.Math.clamp(playhead - startTime, 0, duration) / duration;

      //   //mesh.position.copy(position)
      //   mesh.position.lerpVectors(startPosition, endPosition, progress)
      //   // mesh.position.copy(position).multiplyScalar(cfg.gridSize / cfg.cubesPerSide)
      //   // const delayWithRandomness = delay + (delayRandomness * cfg.delayRandomness - cfg.delayRandomness / 2)
      //   // mesh.position.copy(position).multiplyScalar(cfg.gridGutter)
      //   // const tr = transpose(eases.sineInOut(playhead), delayWithRandomness, cfg.duration)
      //   // const scale = Math.sin(tr * Math.PI) * cfg.maxPointSize * (scaleRandomness * cfg.scaleRandomness + 1) * (indexedScale * cfg.maxPointIncrease + 0.5) + 0.01
      //   // mesh.scale.set(scale, scale, scale)
      // })

      // const gridScale = eases.sineInOut(Math.sin(playhead * Math.PI)) * cfg.maxGridScale + 1
      // grid.scale.set(gridScale, gridScale, gridScale)
      renderer.render(scene, camera)
    },

    resize({ pixelRatio, viewportWidth, viewportHeight }) {
      handleResize(renderer, camera, cfg, { pixelRatio, viewportWidth, viewportHeight })
    },

    unload() {
      handleUnload(renderer, controls)
    }
  }
}

const handleResize = (renderer, camera, cfg, { pixelRatio, viewportWidth, viewportHeight }) => {
  renderer.setPixelRatio(pixelRatio)
  renderer.setSize(viewportWidth, viewportHeight)
  const aspect = viewportWidth / viewportHeight

  const zoom = 6

  camera.left = -zoom * aspect
  camera.right = zoom * aspect
  camera.top = zoom
  camera.bottom = -zoom

  camera.near = -100
  camera.far = 100

  camera.position.set(cfg.cameraX, cfg.cameraY, cfg.cameraZ)
  camera.lookAt(new THREE.Vector3())
  camera.updateProjectionMatrix()
}

const handleUnload = (renderer, controls) => {
  controls.dispose()
  renderer.dispose()
}

const createUVWGrid = ([cx, cy, cz]) => {
  return times(cx).map(x => times(cy).map((y) => times(cz).map(z =>
    new THREE.Vector3(
      cx <= 1 ? 0.5 : x / (cx - 1), 
      cy <= 1 ? 0.5 : y / (cy - 1),
      cz <= 1 ? 0.5 : z / (cz - 1)
    )
  ))).flat(2)
}

const times = (n) => Array.from(new Array(n)).map((_, i) => i)

const transpose = (t, delay, duration) => {
  if (t - delay <= 0) return 0
  if (t >= delay + duration) return 0

  return (t - delay) / duration
}

const updateConfig = ({ target }, cfg) => {
  cfg.zoom = target.object.zoom
  cfg.cameraX = target.object.position.x
  cfg.cameraY = target.object.position.y
  cfg.cameraZ = target.object.position.z
}

const getPalette = (search) => {
  const index = new URLSearchParams(window.location.search).get('palette')
  return palettes[index] ? palettes[index] : random.pick(palettes)
}

canvasSketch(sketch, settings)
