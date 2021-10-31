import { makeRenderLoop, camera, cameraControls, gui, gl, resetFrameCount } from './init';
import ForwardRenderer from './renderers/forward';
import ForwardPlusRenderer from './renderers/forwardPlus';
import ClusteredDeferredRenderer from './renderers/clusteredDeferred';
import Scene from './scene';
import Wireframe from './wireframe';
import BoxBloom from './renderers/boxBloom';

const FORWARD = 'Forward';
const FORWARD_PLUS = 'Forward+';
const CLUSTERED = 'Clustered Deferred';
const CLUSTERED_PACK_1 = 'Cl Def Pack 1';
const CLUSTERED_PACK_2 = 'Cl Def Pack 2';
const CLUSTERED_PACK_2_11 = 'Cl Def Pack 2(11)';
const CLUSTERED_PACK_2_7 = 'Cl Def Pack 2(7)';
const CLUSTERED_PACK_2_3 = 'Cl Def Pack 2(3)';
const CLUSTERED_PACK_2_19 = 'Cl Def Pack 2(19)';
const CLUSTERED_PACK_2_23 = 'Cl Def Pack 2(23)';

var bloom = new BoxBloom();

const params = {
  renderer: FORWARD_PLUS,
  _renderer: null,

  renderWithPostProcess: function(camera, scene) {
    bloom.tryResize();
    this._renderer.render(camera, scene, bloom.isEnabled() ? bloom._fbo : null);
    //console.log("blur radius render", blur.radius, blur.isEnabled()); //TEST
    if(bloom.isEnabled()) {
      bloom.render(null);
    }
  }
};

setRenderer(params.renderer);

function setRenderer(renderer) {
  switch(renderer) {
    case FORWARD:
      params._renderer = new ForwardRenderer();
      break;
    case FORWARD_PLUS:
      params._renderer = new ForwardPlusRenderer(15, 15, 15);
      break;
    case CLUSTERED:
      params._renderer = new ClusteredDeferredRenderer(15, 15, 15, 0);
      break;
    case CLUSTERED_PACK_1:
      params._renderer = new ClusteredDeferredRenderer(15, 15, 15, 1);
      break;
    case CLUSTERED_PACK_2:
      params._renderer = new ClusteredDeferredRenderer(15, 15, 15, 2);
      break;
    case CLUSTERED_PACK_2_11:
      params._renderer = new ClusteredDeferredRenderer(11, 11, 11, 2);
      break;
    case CLUSTERED_PACK_2_7:
      params._renderer = new ClusteredDeferredRenderer(7, 7, 7, 2);
      break;
    case CLUSTERED_PACK_2_3:
      params._renderer = new ClusteredDeferredRenderer(3, 3, 3, 2);
      break;
    case CLUSTERED_PACK_2_19:
      params._renderer = new ClusteredDeferredRenderer(19, 19, 19, 2);
      break;
    case CLUSTERED_PACK_2_23:
      params._renderer = new ClusteredDeferredRenderer(23, 23, 23, 2);
      break;
  }
  resetFrameCount();
}

function setBloomRadius(radius) {
  resetFrameCount();
}

const scene = new Scene();
scene.loadGLTF('models/sponza/sponza.gltf');

gui.add(params, 'renderer', [FORWARD, FORWARD_PLUS, CLUSTERED, CLUSTERED_PACK_1, CLUSTERED_PACK_2, CLUSTERED_PACK_2_11, CLUSTERED_PACK_2_7, CLUSTERED_PACK_2_3, CLUSTERED_PACK_2_19, CLUSTERED_PACK_2_23]).onChange(setRenderer);
gui.add(scene, 'pause', true);
gui.addColor(scene, 'specularColor');
gui.add(scene, 'shininess', 0, 256, 1);
gui.add(bloom, 'radius', 0, 9, 1).onChange(setBloomRadius);

// LOOK: The Wireframe class is for debugging.
// It lets you draw arbitrary lines in the scene.
// This may be helpful for visualizing your frustum clusters so you can make
// sure that they are in the right place.
const wireframe = new Wireframe();

var segmentStart = [-14.0, 0.0, -6.0];
var segmentEnd = [14.0, 20.0, 6.0];
var segmentColor = [1.0, 0.0, 0.0];
wireframe.addLineSegment(segmentStart, segmentEnd, segmentColor);
wireframe.addLineSegment([-14.0, 1.0, -6.0], [14.0, 21.0, 6.0], [0.0, 1.0, 0.0]);

camera.position.set(-10, 8, 0);
cameraControls.target.set(0, 2, 0);
gl.enable(gl.DEPTH_TEST);

function render() {
  scene.update();  
  params.renderWithPostProcess(camera, scene);
  //params._renderer.render(camera, scene);

  // LOOK: Render wireframe "in front" of everything else.
  // If you would like the wireframe to render behind and in front
  // of objects based on relative depths in the scene, comment out /
  //the gl.disable(gl.DEPTH_TEST) and gl.enable(gl.DEPTH_TEST) lines.
  //gl.disable(gl.DEPTH_TEST);
  //wireframe.render(camera);
  //gl.enable(gl.DEPTH_TEST);

  //console.log("blur radius", blur.radius); //TEST
}

makeRenderLoop(render)();