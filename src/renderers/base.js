import { mat4, vec4 } from 'gl-matrix';
import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS } from '../scene';
import { Box3, Box3Helper, Frustum, Plane, Sphere, Vector3 } from 'three';

export const MAX_LIGHTS_PER_CLUSTER = NUM_LIGHTS;//100;
export const CLUSTER_WITH_LINEAR_DEPTH = 1;

export function unprojectScreenSpaceToViewSpace(viewPos, screenPoint, projMat) { // vec4 => vec4
  //console.log(projMat);
  let A = projMat[2 * 4 + 2];
  let B = projMat[3 * 4 + 2];

  let x_ndc = screenPoint[0] * 2. - 1.;
  let y_ndc = screenPoint[1] * 2. - 1.;
  let z_ndc = screenPoint[2] * 2. - 1.;

  let z_eye = B / (A + z_ndc);
  viewPos[0] = z_eye * x_ndc / projMat[0 * 4 + 0];
  viewPos[1] = z_eye * y_ndc / projMat[1 * 4 + 1];
  viewPos[2] = -z_eye;
  viewPos[3] = 1.;

  // let invProjMat = mat4.create();
  // mat4.invert(invProjMat, projMat);
  // let clipSpace = vec4.fromValues(screenPoint[0] * 2. - 1., screenPoint[1] * 2. - 1., screenPoint[2] * 2. - 1., screenPoint[3]);
  // // console.log("clipSpace:", clipSpace);
  // mat4.multiply(viewPos, invProjMat, clipSpace);
  // viewPos[0] /= viewPos[3];
  // viewPos[1] /= viewPos[3];
  // viewPos[2] /= viewPos[3];
  // viewPos[3] /= viewPos[3];
  return viewPos;
}

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    this._MAX_LIGHTS_PER_CLUSTER = MAX_LIGHTS_PER_CLUSTER;
    this._CLUSTER_WITH_LINEAR_DEPTH = CLUSTER_WITH_LINEAR_DEPTH;
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;

    this._clusterPointsViewSpace = new TextureBuffer((xSlices + 1) * (ySlices + 1) * (zSlices + 1), 4);
    this._clusterBoxes = new TextureBuffer((xSlices) * (ySlices) * (zSlices), 8);
    this._isClusterPointsViewSpaceCreated = false;
  }

  updateClusters(camera, viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    let near = camera.near, far = camera.far;

    if(!this._isClusterPointsViewSpaceCreated) {
      this._updateClusterPointsViewSpace(camera, viewMatrix);
      this._isClusterPointsViewSpaceCreated = true;
    }

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }
    
    for (let lightIdx = 0; lightIdx < NUM_LIGHTS; ++lightIdx) {
      let position = vec4.fromValues(scene.lights[lightIdx].position[0], scene.lights[lightIdx].position[1], scene.lights[lightIdx].position[2], 1.); // Float32Array
      let radius = scene.lights[lightIdx].radius; // number
      
      let viewPosition = vec4.create();

      mat4.multiply(viewPosition, viewMatrix, position);

      let lightSphereViewSpace = new Sphere(new Vector3(viewPosition[0], viewPosition[1], viewPosition[2]), radius);
      // if(lightSphereViewSpace.center.z < -far) {
      //   let ratio = lightSphereViewSpace.center.z / (-far);
      //   lightSphereViewSpace.center /= ratio;
      // }

      let projMatrix = camera.projectionMatrix.elements;

      // let projPosition = vec4.create();
      // mat4.multiply(projPosition, projMatrix, viewPosition);
      
      // projPosition[0] /= projPosition[3];
      // projPosition[1] /= projPosition[3];
      // projPosition[2] /= projPosition[3];
      // projPosition[3] /= projPosition[3];

      //let xcenter = (projPosition[0] * 0.5 + 0.5) * this._xSlices;
      //let ycenter = (projPosition[1] * 0.5 + 0.5) * this._ySlices;
      //let zcenter = (projPosition[2] * 0.5 + 0.5) * this._zSlices;

      let projMinPos = vec4.create(), projMaxPos = vec4.create();
      if(!CLUSTER_WITH_LINEAR_DEPTH) {
        mat4.multiply(projMinPos, projMatrix, vec4.fromValues(viewPosition[0], viewPosition[1], viewPosition[2] + radius, viewPosition[3]));
        mat4.multiply(projMaxPos, projMatrix, vec4.fromValues(viewPosition[0], viewPosition[1], viewPosition[2] - radius, viewPosition[3]));
        
        projMinPos[0] /= projMinPos[3];
        projMinPos[1] /= projMinPos[3];
        projMinPos[2] /= projMinPos[3];
        projMinPos[3] /= projMinPos[3];

        projMaxPos[0] /= projMaxPos[3];
        projMaxPos[1] /= projMaxPos[3];
        projMaxPos[2] /= projMaxPos[3];
        projMaxPos[3] /= projMaxPos[3];
      }

      //let zMin = ((CLUSTER_WITH_LINEAR_DEPTH ? ((-viewPosition[2] - radius - near) / (far - near)) : (projMinPos[2] ))) * this._zSlices;
      //let zMax = ((CLUSTER_WITH_LINEAR_DEPTH ? ((-viewPosition[2] + radius - near) / (far - near)) : (projMaxPos[2] ))) * this._zSlices;
      let zMin = ((CLUSTER_WITH_LINEAR_DEPTH ? ((-viewPosition[2] - radius - near) / (far - near)) : (projMinPos[2] * 0.5 + 0.5))) * this._zSlices;
      let zMax = ((CLUSTER_WITH_LINEAR_DEPTH ? ((-viewPosition[2] + radius - near) / (far - near)) : (projMaxPos[2] * 0.5 + 0.5))) * this._zSlices;
      
      //console.log("v:", viewPosition, "p:", projPosition, "pmin:", projMinPos, "pmax:", projMaxPos, "zMin, zMax:", zMin, zMax);

      if(zMin >= this._zSlices) { // Too near, then zMin >= this._zSlices
        zMin = 0.;
      }
      
      // if(zMin >= this._zSlices || zMax < 0) {
      //   continue;
      // }
      
      //console.log("zMin, zMax = ", zMin, zMax);//TEST
      //console.log(this._clusterPointsViewSpace.buffer);//TEST

      //for(let zi0 = 0; zi0 < this._zSlices; ++zi0) {
      for(let zi0 = Math.max(0, Math.floor(zMin)); zi0 <= Math.min(this._zSlices - 1, Math.floor(zMax)); ++zi0) {
        // let idxXYMin = zi0 * (this._xSlices + 1) * (this._ySlices + 1);
        // let idxXYMax = (this._xSlices) + (this._ySlices) * (this._xSlices + 1) + idxXYMin;
        // let bufferIdxXYMin = this._clusterPointsViewSpace.bufferIndex(idxXYMin, 0);
        // let bufferIdxXYMax = this._clusterPointsViewSpace.bufferIndex(idxXYMax, 0);
        // let diffX = (this._clusterPointsViewSpace.buffer[bufferIdxXYMax + 0] - this._clusterPointsViewSpace.buffer[bufferIdxXYMin + 0]) / (this._xSlices);
        // let diffY = (this._clusterPointsViewSpace.buffer[bufferIdxXYMax + 1] - this._clusterPointsViewSpace.buffer[bufferIdxXYMin + 1]) / (this._ySlices);
        
        // if(diffX <= 0. || diffY <= 0.) {
        //   continue;
        // }

        // let diffIdxX = radius / diffX;
        // let diffIdxY = radius / diffY;
        // //console.log("zi0 = ", zi0, "diffX = ", diffX, "diffY = ", diffY, "diffIdxX = ", diffIdxX, "diffIdxY = ", diffIdxY);//TEST
        // for(let yi0 = Math.max(0, Math.floor(ycenter - diffIdxY)); yi0 <= Math.min(this._ySlices - 1, Math.ceil(ycenter + diffIdxY)); ++yi0) {
        //   for(let xi0 = Math.max(0, Math.floor(xcenter - diffIdxX)); xi0 <= Math.min(this._xSlices - 1, Math.ceil(xcenter + diffIdxX)); ++xi0) {
        for(let yi0 = 0; yi0 < this._ySlices; ++yi0) {
          for(let xi0 = 0; xi0 < this._xSlices; ++xi0) {
            
            // let xi0 = Math.floor(x0);
            // let yi0 = Math.floor(y0);
            // let zi0 = Math.floor(z0);

            // if(xi0 >= this._xSlices || yi0 >= this._ySlices || zi0 >= this._zSlices || xi0 < 0 || yi0 < 0 || zi0 < 0) {
            //   continue;
            // }

            // BBoxes have been computed.
            // let xi1 = xi0 + 1;
            // let yi1 = yi0 + 1;
            // let zi1 = zi0 + 1;

            // let clusterPointsIndices = [
            //   xi0 + yi0 * (this._xSlices + 1) + zi0 * (this._xSlices + 1) * (this._ySlices + 1),
            //   xi1 + yi0 * (this._xSlices + 1) + zi0 * (this._xSlices + 1) * (this._ySlices + 1),
            //   xi0 + yi1 * (this._xSlices + 1) + zi0 * (this._xSlices + 1) * (this._ySlices + 1),
            //   xi1 + yi1 * (this._xSlices + 1) + zi0 * (this._xSlices + 1) * (this._ySlices + 1),
            //   xi0 + yi0 * (this._xSlices + 1) + zi1 * (this._xSlices + 1) * (this._ySlices + 1),
            //   xi1 + yi0 * (this._xSlices + 1) + zi1 * (this._xSlices + 1) * (this._ySlices + 1),
            //   xi0 + yi1 * (this._xSlices + 1) + zi1 * (this._xSlices + 1) * (this._ySlices + 1),
            //   xi1 + yi1 * (this._xSlices + 1) + zi1 * (this._xSlices + 1) * (this._ySlices + 1),
            // ];

            // let clusterPoints = clusterPointsIndices.map(idx => {
            //   let bi = this._clusterPointsViewSpace.bufferIndex(idx, 0);
            //   var v = vec4.fromValues(
            //     this._clusterPointsViewSpace.buffer[bi + 0],
            //     this._clusterPointsViewSpace.buffer[bi + 1],
            //     this._clusterPointsViewSpace.buffer[bi + 2],
            //     this._clusterPointsViewSpace.buffer[bi + 3]);
            //   return v;
            // });

            // let bboxViewSpace = new Box3(
            //   new Vector3(clusterPoints[0][0], clusterPoints[0][1], clusterPoints[0][2]),
            //   new Vector3(clusterPoints[0][0], clusterPoints[0][1], clusterPoints[0][2])
            // );

            // for(let i = 1; i < clusterPoints.length; ++i) {
            //   bboxViewSpace.min.set(Math.min(bboxViewSpace.min.x, clusterPoints[i][0]), 
            //                         Math.min(bboxViewSpace.min.y, clusterPoints[i][1]), 
            //                         Math.min(bboxViewSpace.min.z, clusterPoints[i][2]));
            //   bboxViewSpace.max.set(Math.max(bboxViewSpace.max.x, clusterPoints[i][0]), 
            //                         Math.max(bboxViewSpace.max.y, clusterPoints[i][1]), 
            //                         Math.max(bboxViewSpace.max.z, clusterPoints[i][2]));
            // }

            let clTexI = xi0 + yi0 * (this._xSlices) + zi0 * (this._xSlices) * (this._ySlices);
            let clTexBufStartIdx = this._clusterTexture.bufferIndex(clTexI, 0);
            let clTexBBoxStartIdx1 = this._clusterTexture.bufferIndex(clTexI, 1);

            let bboxViewSpace = new Box3(
              new Vector3(this._clusterBoxes.buffer[clTexBufStartIdx + 0], this._clusterBoxes.buffer[clTexBufStartIdx + 1], this._clusterBoxes.buffer[clTexBufStartIdx + 2]),
              new Vector3(this._clusterBoxes.buffer[clTexBBoxStartIdx1 + 0], this._clusterBoxes.buffer[clTexBBoxStartIdx1 + 1], this._clusterBoxes.buffer[clTexBBoxStartIdx1 + 2])
            );

            // Bounding box intersection test.
            if(!lightSphereViewSpace.intersectsBox(bboxViewSpace) && (
                bboxViewSpace.min.x > viewPosition[0] || bboxViewSpace.min.y > viewPosition[1] || bboxViewSpace.min.z > viewPosition[2] ||
                bboxViewSpace.max.x < viewPosition[0] || bboxViewSpace.max.y < viewPosition[1] || bboxViewSpace.max.z < viewPosition[2]
              )) {
            // if(bboxViewSpace.min.x - radius > viewPosition[0] || bboxViewSpace.min.y - radius > viewPosition[1] || bboxViewSpace.min.z - radius > viewPosition[2] ||
            //   bboxViewSpace.max.x + radius < viewPosition[0] || bboxViewSpace.max.y + radius < viewPosition[1] || bboxViewSpace.max.z + radius < viewPosition[2]
            // ) {
              //console.log(xi0, yi0, zi0, "No intersection.", lightSphereViewSpace.center, bboxViewSpace.min, bboxViewSpace.max); // TEST
              continue;
            }
            
            ++this._clusterTexture.buffer[clTexBufStartIdx];
            let newLightIdx = this._clusterTexture.buffer[clTexBufStartIdx];
            let newLightIdxComponent = Math.floor(newLightIdx / 4);
            //console.log("newLightIdxComponent:", newLightIdxComponent); //TEST
            let offset = newLightIdx - newLightIdxComponent * 4;
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clTexI, newLightIdxComponent) + offset] = lightIdx;
            
            // console.log("Intersection.", lightIdx, this._clusterTexture.buffer[clTexBufStartIdx], 
            //   lightSphereViewSpace.center, bboxViewSpace.min, bboxViewSpace.max,
            //   xi0, yi0, zi0); // TEST

            //TODO for more accurate intersection test.
            // let planes = [
            //   Plane.setFromCoplanarPoints(new Vector3(clusterPoints[0][0], clusterPoints[0][1], clusterPoints[0][2])),
            //   Plane.setFromCoplanarPoints(new Vector3(clusterPoints[0][0], clusterPoints[0][1], clusterPoints[0][2])),
            //   Plane.setFromCoplanarPoints(new Vector3(clusterPoints[0][0], clusterPoints[0][1], clusterPoints[0][2])),
            //   Plane.setFromCoplanarPoints(new Vector3(clusterPoints[0][0], clusterPoints[0][1], clusterPoints[0][2])),
            //   Plane.setFromCoplanarPoints(new Vector3(clusterPoints[0][0], clusterPoints[0][1], clusterPoints[0][2])),
            //   Plane.setFromCoplanarPoints(new Vector3(clusterPoints[0][0], clusterPoints[0][1], clusterPoints[0][2])),
            // ]
            
            // let pl0 = Plane.setFromCoplanarPoints();

            // let frustum = new Frustum(pl0, pl1, pl2, pl3, pl4, pl5, pl6);

          }
        }
      }

    }



    this._clusterTexture.update();
  }

  _updateClusterPointsViewSpace(camera, viewMatrix) {
    // let vfov = camera.fov;
    // let aspect = camera.aspect;
    let near = camera.near;
    let far = camera.far;

    let projMat = camera.projectionMatrix.elements;
    //let invProjMat = mat4.create();
    //mat4.invert(invProjMat, projMat);

    for(let zi = 0; zi <= this._zSlices; ++zi) {
      for(let yi = 0; yi <= this._ySlices; ++yi) {
        for(let xi = 0; xi <= this._xSlices; ++xi) {
          let i = xi + yi * (this._xSlices + 1) + zi * (this._xSlices + 1) * (this._ySlices + 1);

          let minXProj = xi / (this._xSlices);
          let minYProj = yi / (this._ySlices);
          let minZProj = zi / (this._zSlices);

          let x0y0z0Screen = vec4.fromValues(minXProj, minYProj, minZProj, 1.);

          if(CLUSTER_WITH_LINEAR_DEPTH) {
            let viewPos00z = vec4.fromValues(0., 0., -minZProj * (far - near) - near, 1.);
            let projPos00z = vec4.create();
            mat4.multiply(projPos00z, projMat, viewPos00z);
            x0y0z0Screen[2] = projPos00z[2] / projPos00z[3] * 0.5 + 0.5;
          }
          
          let x0y0z0View = vec4.create();
          unprojectScreenSpaceToViewSpace(x0y0z0View, x0y0z0Screen, projMat);

          // if(CLUSTER_WITH_LINEAR_DEPTH) {
          //   x0y0z0View[2] = -minZProj * (far - near) - near;
          // }

          let bi = this._clusterPointsViewSpace.bufferIndex(i, 0);
          this._clusterPointsViewSpace.buffer[bi + 0] = x0y0z0View[0];
          this._clusterPointsViewSpace.buffer[bi + 1] = x0y0z0View[1];
          this._clusterPointsViewSpace.buffer[bi + 2] = x0y0z0View[2];
          this._clusterPointsViewSpace.buffer[bi + 3] = x0y0z0View[3];

          //console.log(xi, yi, zi, "->", x0y0z0View); // TEST
        }
      }
    }

    for(let zi0 = 0; zi0 < this._zSlices; ++zi0) {
      for(let yi0 = 0; yi0 < this._ySlices; ++yi0) {
        for(let xi0 = 0; xi0 < this._xSlices; ++xi0) {
          let xi1 = xi0 + 1;
          let yi1 = yi0 + 1;
          let zi1 = zi0 + 1;

          let clusterPointsIndices = [
            xi0 + yi0 * (this._xSlices + 1) + zi0 * (this._xSlices + 1) * (this._ySlices + 1),
            xi1 + yi0 * (this._xSlices + 1) + zi0 * (this._xSlices + 1) * (this._ySlices + 1),
            xi0 + yi1 * (this._xSlices + 1) + zi0 * (this._xSlices + 1) * (this._ySlices + 1),
            xi1 + yi1 * (this._xSlices + 1) + zi0 * (this._xSlices + 1) * (this._ySlices + 1),
            xi0 + yi0 * (this._xSlices + 1) + zi1 * (this._xSlices + 1) * (this._ySlices + 1),
            xi1 + yi0 * (this._xSlices + 1) + zi1 * (this._xSlices + 1) * (this._ySlices + 1),
            xi0 + yi1 * (this._xSlices + 1) + zi1 * (this._xSlices + 1) * (this._ySlices + 1),
            xi1 + yi1 * (this._xSlices + 1) + zi1 * (this._xSlices + 1) * (this._ySlices + 1),
          ];

          let clusterPoints = clusterPointsIndices.map(idx => {
            let bi = this._clusterPointsViewSpace.bufferIndex(idx, 0);
            var v = vec4.fromValues(
              this._clusterPointsViewSpace.buffer[bi + 0],
              this._clusterPointsViewSpace.buffer[bi + 1],
              this._clusterPointsViewSpace.buffer[bi + 2],
              this._clusterPointsViewSpace.buffer[bi + 3]);
            return v;
          });

          let bboxViewSpace = new Box3(
            new Vector3(clusterPoints[0][0], clusterPoints[0][1], clusterPoints[0][2]),
            new Vector3(clusterPoints[0][0], clusterPoints[0][1], clusterPoints[0][2])
          );
          
          for(let i = 1; i < clusterPoints.length; ++i) {
            bboxViewSpace.min.set(Math.min(bboxViewSpace.min.x, clusterPoints[i][0]), 
                                  Math.min(bboxViewSpace.min.y, clusterPoints[i][1]), 
                                  Math.min(bboxViewSpace.min.z, clusterPoints[i][2]));
            bboxViewSpace.max.set(Math.max(bboxViewSpace.max.x, clusterPoints[i][0]), 
                                  Math.max(bboxViewSpace.max.y, clusterPoints[i][1]), 
                                  Math.max(bboxViewSpace.max.z, clusterPoints[i][2]));
          }
          
          let idx = xi0 + yi0 * (this._xSlices) + zi0 * (this._xSlices) * (this._ySlices);
          
          let bi0 = this._clusterBoxes.bufferIndex(idx, 0);
          let bi1 = this._clusterBoxes.bufferIndex(idx, 1);
          
          this._clusterBoxes.buffer[bi0 + 0] = bboxViewSpace.min.x;
          this._clusterBoxes.buffer[bi0 + 1] = bboxViewSpace.min.y;
          this._clusterBoxes.buffer[bi0 + 2] = bboxViewSpace.min.z;
          this._clusterBoxes.buffer[bi0 + 3] = 1.;
          
          this._clusterBoxes.buffer[bi1 + 0] = bboxViewSpace.max.x;
          this._clusterBoxes.buffer[bi1 + 1] = bboxViewSpace.max.y;
          this._clusterBoxes.buffer[bi1 + 2] = bboxViewSpace.max.z;
          this._clusterBoxes.buffer[bi1 + 3] = 1.;
          
          //console.log(xi0, yi0, zi0, "bb->", bboxViewSpace); // TEST
        }
      }
    }

  }
}