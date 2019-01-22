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
  duration: 3.0,
  attributes: { antialias: true },
  canvas: document.querySelector('#app'),
  ...SAVE && {
    dimensions: [600, 600],
    fps: 30
  }
}

function CFG() {
  this.cubesPerSide = 40
  this.remember = SAVE
  this.gridGutter = 18
  this.duration = 0.2
  this.maxGridScale = 0.3
  this.deltaX = 8
  this.maxPointSize = 5
  this.maxPointIncrease = 0.7
  this.scaleRandomness = 0.5
  this.delayRandomness = 0.04
  this.gridSize = 150
  this.zoom = 1
  this.cameraX = 6
  this.cameraY = 6
  this.cameraZ = 6
  this.totalDelay = 1.0
}

const cfg = new CFG()

let grid

const sketch = ({ context, canvas }) => {
  const renderer = new THREE.WebGLRenderer({ context })
  renderer.setClearColor('hsl(0, 0%, 10%)', 1)

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
  f1.add(cfg, 'gridGutter', 0, 60)
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
  const palette = getPalette(window && window.location.search)
  const toCenter = new THREE.Vector3(-0.5, -0.5, -0.5)

  window && SAVE && window.addEventListener('keyup', () => console.log(palettes.indexOf(palette), palette))

  function updateCamera(path, val) {
    set(camera, path, val)
    camera.updateProjectionMatrix()
    controls.update()
  }

  const prefab = new THREE.BoxGeometry(0.1, 0.1, 0.1)
  const geometry = new THREE.BAS.PrefabBufferGeometry(prefab, gridPoints.length)
  
  const aPositionBuffer = geometry.createAttribute('aPosition', 3)
  const delayBuffer = geometry.createAttribute('delay', 1)
  const scaleOffsetBuffer = geometry.createAttribute('scaleOffset', 1)
  const colorBuffer = geometry.createAttribute('color', 3)

  gridPoints.forEach((v, index) => {
    const distance = v.dot(new THREE.Vector3(1, 1, 1)) / 3
    const position = v.add(toCenter).multiplyScalar(cfg.gridGutter)
    const color = new THREE.Color(random.pick(palette))
    const delay = lerp(0, 1 - cfg.duration, distance) + (random.value() * cfg.delayRandomness - cfg.delayRandomness / 2)
    const indexedScale = Math.sin(distance * Math.PI)
    const scaleOffset = cfg.maxPointSize * (random.value() * cfg.scaleRandomness + 1) * (indexedScale * cfg.maxPointIncrease + 0.5)

    geometry.setPrefabData(colorBuffer, index, [color.r, color.g, color.b])
    geometry.setPrefabData(delayBuffer, index, [delay])
    geometry.setPrefabData(scaleOffsetBuffer, index, [scaleOffset])
    geometry.setPrefabData(aPositionBuffer, index, [position.x, position.y, position.z])
  })

  const glslGetScale = `
    float getScale(float t, float scaleOffset, float delay, float duration) {
      float tr = transpose(easeSineInOut(t), delay, duration);
      return tr * scaleOffset + 0.01;
    }
  `

  const glslTranspose = `
    float transpose(float t, float delay, float duration) {
      float res = 0.0;
      if(t - delay <= 0.0) {
        res = 0.0;
      } else if(t >= delay + duration) {
        res = 0.0;
      } else {
        res = sin(((t - delay) / duration) * 3.14);
      }

      return res;
    }
  `

  material = new THREE.BAS.PhongAnimationMaterial({
    flatShading: true,
    vertexColors: THREE.VertexColors,
    uniforms: { 
      time: { value: 0 } ,
      duration: { value: cfg.duration }
    },
    vertexFunctions: [
      THREE.BAS.ShaderChunk['ease_sine_in_out'],
      glslTranspose,
      glslGetScale
    ],
    vertexParameters: [
      'uniform float time;',
      'uniform float duration;',
      'attribute vec3 aPosition;',
      'attribute float delay;',
      'attribute float scaleOffset;'
    ],
    vertexPosition: [
      'float aScale = getScale(time, scaleOffset, delay, duration);',
      'transformed *= aScale;',
      'transformed += aPosition;',
      
    ],
    vertexColor: [
      'vColor = color;'
    ]
  })

  grid = new THREE.Mesh(geometry, material)
  scene.add(grid)

  const ambientLight = new THREE.AmbientLight('hsl(0, 0%, 80%)')
  const light = new THREE.DirectionalLight('white', 1)
  light.position.set(0, 2, 4)
  scene.add(ambientLight)
  scene.add(light)

  return {
    render({ playhead }) {
      grid.material.uniforms.time.value = playhead
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
