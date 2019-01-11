# threejs-cubicles
THREE.js 3D-grid with cubes

## Description
Just messing around with THREEjs, OrbitControls and DAT.gui with saving state in localStorage.
Use DAT.gui to save config and OrbitControls in `localStorage`. Update OrbitControls from DAT.gui.

## Run it
Project uses [canvas-sketch](https://github.com/mattdesl/canvas-sketch) by Matt Deslaurier.

```
yarn
canvas-sketch index.js --output=output/
```


## Adjustments
Use the GUI sliders & mouse/keyboard (OrbitControls) to adjust to your liking before exporting. And/or change settings in the `CFG` class or instance. Save the settings to localStorage if desired.

## Create video
When pressing `cmd`+`shift`+`s` pngs of every frame will be saved in an `output` directory. If ffmpeg is installed run the following command to create an mp4 which creates a videofrom the 75 generated pngs and loops it 8 times.

```
ffmpeg -filter_complex loop=loop=8:size=75:start=0 -framerate 30 -pattern_type glob -i '*.png' \
  -c:v libx264 -pix_fmt yuv420p output.mp4
```