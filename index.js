const canvasSketch = require('canvas-sketch')
const eases = require('eases')
const { lerp } = require('canvas-sketch-util/math')
const palettes = require('nice-color-palettes')
const random = require('canvas-sketch-util/random')
const dat = require('dat.gui')
const set = require('lodash/set')

const THREE = global.THREE = require('three')
require('three/examples/js/controls/OrbitControls')

const settings = {
  dimensions: [768, 768],
  fps: 30,
  animate: true,
  context: 'webgl',
  duration: 2.5,
  attributes: { antialias: true }
}

function CFG() {
  this.cubesPerSide = 6
  this.remember = true
  this.gridGutter = 4
  this.duration = 0.3
  this.maxGridScale = 0.3
  this.maxPointSize = 6
  this.maxPointIncrease = 0.7
  this.scaleRandomness = 0.3
  this.delayRandomness = 0.1
  this.zoom = 6
  this.cameraX = 6
  this.cameraY = 6
  this.cameraZ = 6
}

const cfg = new CFG()

const sketch = ({ context, canvas }) => {
  const renderer = new THREE.WebGLRenderer({ context })
  renderer.setClearColor('hsl(0, 0%, 95%)', 1)

  const camera = new THREE.OrthographicCamera()
  const controls = new THREE.OrbitControls(camera, canvas)
  const gui = new dat.GUI({ closed: true })
  const f1 = gui.addFolder('Grid')

  f1.add(cfg, 'maxGridScale', 0, 1)
  f1.add(cfg, 'gridGutter', 0, 60)
  const f2 = gui.addFolder('Duration')
  f2.add(cfg, 'duration', 0, 0.4)
  f2.add(cfg, 'delayRandomness', 0, 0.4)
  const f3 = gui.addFolder('Points')
  f3.add(cfg, 'maxPointIncrease', 0, 1)
  f3.add(cfg, 'maxPointSize', 0, 20)
  f3.add(cfg, 'scaleRandomness', 0, 1)

  if (cfg.remember) {
    controls.addEventListener('change', evt => updateConfig(evt, cfg))
    gui.remember(cfg)
    const f4 = gui.addFolder('Controls')
    f4.add(cfg, 'zoom', 0, 3).listen().onChange(val => updateCamera('zoom', val))
    f4.add(cfg, 'cameraX', -60, 60).listen().onChange(val => updateCamera('position.x', val))
    f4.add(cfg, 'cameraY', -60, 60).listen().onChange(val => updateCamera('position.y', val))
    f4.add(cfg, 'cameraZ', -60, 60).listen().onChange(val => updateCamera('position.z', val))
    updateCamera('zoom', cfg.zoom)
  }

  const gridPoints = createGrid([cfg.cubesPerSide, cfg.cubesPerSide, cfg.cubesPerSide])
  const scene = new THREE.Scene()
  const grid = new THREE.Group()
  const box = new THREE.BoxGeometry(0.1, 0.1, 0.1)
  const palette = random.pick(palettes)
  const toCenter = new THREE.Vector3(-0.5, -0.5, -0.5)

  window.addEventListener('keyup', () => console.log(palette))

  function updateCamera(path, val) {
    set(camera, path, val)
    camera.updateProjectionMatrix()
    controls.update()
  }

  gridPoints.forEach((v) => {
    const color = random.pick(palette)
    const mesh = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color }))
    const distance = v.dot(new THREE.Vector3(1, 1, 1)) / 3

    mesh.userData = {
      delay: lerp(0, 1 - cfg.duration, eases.linear(distance)),
      delayRandomness: random.value(),
      indexedScale: Math.sin(distance * Math.PI),
      position: v.add(toCenter),
      scaleRandomness: random.value()
    }

    grid.add(mesh)
  })

  scene.add(grid)

  const ambientLight = new THREE.AmbientLight('hsl(0, 0%, 80%)')
  const light = new THREE.DirectionalLight('white', 1)
  light.position.set(0, 2, 4)
  scene.add(ambientLight)
  scene.add(light)

  return {
    render({ playhead }) {
      grid.children.forEach((mesh) => {
        const { position, indexedScale, delay, scaleRandomness, delayRandomness } = mesh.userData
        const delayWithRandomness = delay + (delayRandomness * cfg.delayRandomness - cfg.delayRandomness / 2)
        mesh.position.copy(position).multiplyScalar(cfg.gridGutter)
        const tr = transpose(playhead, delayWithRandomness, cfg.duration)
        const scale = Math.sin(tr * Math.PI) * cfg.maxPointSize * (scaleRandomness * cfg.scaleRandomness + 1) * (indexedScale * cfg.maxPointIncrease + 0.5) + 0.01
        mesh.scale.set(scale, scale, scale)
      })

      const gridScale = eases.linear(Math.sin(playhead * Math.PI)) * cfg.maxGridScale + 1
      grid.scale.set(gridScale, gridScale, gridScale)

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

  // Ortho zoom
  const zoom = 6

  // Bounds
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

const createGrid = (([cx, cy, cz]) => {
  const res = []

  for (let x = 0; x < cx; x++) {
    for (let y = 0; y < cy; y++) {
      for (let z = 0; z < cz; z++) {
        const u = cx <= 1 ? 0.5 : x / (cx - 1)
        const v = cy <= 1 ? 0.5 : y / (cy - 1)
        const w = cz <= 1 ? 0.5 : z / (cz - 1)
        res.push(new THREE.Vector3(u, v, w))
      }
    }
  }
  return res
})

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

canvasSketch(sketch, settings)
