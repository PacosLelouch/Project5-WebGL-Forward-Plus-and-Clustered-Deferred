const glsl = function(...args) { 
  let argArray = Object.values(arguments).slice(1, arguments.length); 
  //console.log(argArray); 
  var str = '';
  for(let i = 0; i < argArray.length; ++i) {
    str += arguments[0][i] + argArray[i];
  }
  str += arguments[0][argArray.length];
  //console.log(str); 
  return str; 
};

export default function(params) {
  //console.log(params.numLights, params.maxLightPerCluster);//TEST
  return glsl`
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;
  precision highp int;

  #define NUM_LIGHTS ${params.numLights} 
  #define MAX_LIGHT_PER_CLUSTER ${params.maxLightPerCluster}
  #define CLUSTER_WITH_LINEAR_DEPTH ${params.clusterWithLinearDepth} 
  #define FORWARD_PLUS_DEBUG 0//2

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  // DONE: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

  uniform vec3 u_sliceSize;
  uniform float u_near;
  uniform float u_far;

  uniform mat4 u_viewMatrix;

  uniform vec3 u_specularColor;
  uniform float u_shininess;

  varying vec3 v_position;
  varying vec3 v_viewPosition;
  varying vec3 v_normal;
  varying vec2 v_uv;
  varying vec4 v_projPosition;

  vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
  }

  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };

  float ExtractFloat(sampler2D texture, int textureWidth, int textureHeight, int index, int component) {
    float u = //textureWidth == 1 ? 0.3 : (float(index) + 0.3) / float(textureWidth); 
      float(index + 1) / float(textureWidth + 1);
    int pixel = component / 4;
    float v = //textureHeight == 1 ? 0.3 : (float(pixel) + 0.3) / float(textureHeight); 
      float(pixel + 1) / float(textureHeight + 1);
    vec4 texel = texture2D(texture, vec2(u, v));
    int pixelComponent = component - pixel * 4;
    if (pixelComponent == 0) {
      return texel[0];
    } else if (pixelComponent == 1) {
      return texel[1];
    } else if (pixelComponent == 2) {
      return texel[2];
    } else if (pixelComponent == 3) {
      return texel[3];
    }
  }
  
  vec4 ExtractVec4(sampler2D texture, int textureWidth, int textureHeight, int index, int component) {
    float u = textureWidth == 1 ? 0.3 : (float(index) + 0.3) / float(textureWidth - 0); //float(index + 1) / float(textureWidth + 1);
    int pixel = component / 4;
    float v = textureHeight == 1 ? 0.3 : (float(pixel) + 0.3) / float(textureHeight - 0); //float(pixel + 1) / float(textureHeight + 1);
    vec4 texel = texture2D(texture, vec2(u, v));
    return texel;
  }


  Light UnpackLight(int index) {
    Light light;
    float u = //(float(index) + 0.3) / float(NUM_LIGHTS); 
      float(index + 1) / float(NUM_LIGHTS + 1);
    vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.3));
    vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.6));
    light.position = v1.xyz;

    // LOOK: This extracts the 4th float (radius) of the (index)th light in the buffer
    // Note that this is just an example implementation to extract one float.
    // There are more efficient ways if you need adjacent values
    //light.radius = ExtractFloat(u_lightbuffer, NUM_LIGHTS, 2, index, 3);
    light.radius = v1.w;

    light.color = v2.rgb;
    return light;
  }

  // Cubic approximation of gaussian curve so we falloff to exactly 0 at the light radius
  float cubicGaussian(float h) {
    if (h < 1.0) {
      return 0.25 * pow(2.0 - h, 3.0) - pow(1.0 - h, 3.0);
    } else if (h < 2.0) {
      return 0.25 * pow(2.0 - h, 3.0);
    } else {
      return 0.0;
    }
  }

  float unpackClusterBufferU(vec3 screenPosition) {
    return screenPosition.x / (u_sliceSize.x * u_sliceSize.y * u_sliceSize.z) + 
        screenPosition.y / (u_sliceSize.y * u_sliceSize.z) +
        screenPosition.z / (u_sliceSize.z);
  }

  float remapZFromProj01(float depth) {
  // #if CLUSTER_WITH_LINEAR_DEPTH
  //   const float near = u_near, far = u_far;
  //   //float outZ = log2(depth + 1.); 
  //   //float outZ = ((2.0 * near * far) / (far + near - (depth * 2.0 - 1.0) * (far - near)) - near) / (far - near);
  //   float outZ = pow(log2(depth + 1.), 0.001);
  // #else // CLUSTER_WITH_LINEAR_DEPTH
  //   float outZ = depth;
  // #endif // CLUSTER_WITH_LINEAR_DEPTH
    float outZ = depth;
    return outZ;
  }

  void main() {
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = normalize(applyNormalMap(v_normal, normap));
    
    vec3 viewPosition = (u_viewMatrix * vec4(v_position, 1.)).xyz;
    vec3 viewNormal = (u_viewMatrix * vec4(normal, 0.)).xyz;

    vec3 fragColor = vec3(0.0);

    vec3 screenPosition = v_projPosition.xyz / v_projPosition.w * vec3(0.5, 0.5, 0.5) + vec3(0.5, 0.5, 0.5);
  #if FORWARD_PLUS_DEBUG > 2
    fragColor = vec3(screenPosition.xy * u_sliceSize.xy, 0.);
    fragColor.x = fract(fragColor.x) * 0.02;
    fragColor.y = fract(fragColor.y) * 0.02;
    //return;
  #endif // FORWARD_PLUS_DEBUG
  #if CLUSTER_WITH_LINEAR_DEPTH
    screenPosition.z = (-v_viewPosition.z - u_near) / (u_far - u_near);
  #endif // CLUSTER_WITH_LINEAR_DEPTH

    int cluBufWidth = int(u_sliceSize.x + 0.5) * int(u_sliceSize.y + 0.5) * int(u_sliceSize.z + 0.5);
    int cluBufHeight = (MAX_LIGHT_PER_CLUSTER + 1 + 3) / 4;
    int cluBufIndex = 
      (int(screenPosition.x * u_sliceSize.x)) + 
      (int(screenPosition.y * u_sliceSize.y)) * int(u_sliceSize.x + 0.5) + 
      (int(screenPosition.z * u_sliceSize.z)) * int(u_sliceSize.x + 0.5) * int(u_sliceSize.y + 0.5);

    float lightNumInClusterF = ExtractFloat(
      u_clusterbuffer, 
      cluBufWidth, 
      cluBufHeight, 
      cluBufIndex, 
      0);
    int lightNumInCluster = int(lightNumInClusterF + 0.5);
  #if FORWARD_PLUS_DEBUG
    //gl_FragColor = vec4(screenPosition.zzz, 1.);
    //gl_FragColor = vec4(screenPosition.xy, 0., 1.);
    fragColor += vec3((lightNumInClusterF) / (min(float(MAX_LIGHT_PER_CLUSTER), float(NUM_LIGHTS)) * 2.));
    //gl_FragColor = vec4(fragColor, 1.);
    //return;
  #endif // FORWARD_PLUS_DEBUG
  #if FORWARD_PLUS_DEBUG == 1
    for (int i = 0; i < NUM_LIGHTS; ++i) {
  #else // FORWARD_PLUS_DEBUG
    for (int li = 0; li < MAX_LIGHT_PER_CLUSTER; ++li) {
      if (li >= lightNumInCluster) {
        break;
      }
      float iF = ExtractFloat(
        u_clusterbuffer, 
        cluBufWidth, 
        cluBufHeight, 
        cluBufIndex, 
        li + 1);
      int i = int(iF + 0.5);
  #endif // FORWARD_PLUS_DEBUG
      Light light = UnpackLight(i);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);

      vec3 viewLightPosition = (u_viewMatrix * vec4(light.position, 1.)).xyz;
      vec3 viewL = (viewLightPosition - viewPosition) / lightDistance;
      
      if(u_shininess > 0.) {
        vec3 viewV = normalize(-viewPosition);
        vec3 viewH = normalize(viewV + viewL);
        float specularTerm = pow(max(dot(viewH, viewNormal), 0.0), u_shininess);
        fragColor += u_specularColor * specularTerm * light.color * vec3(lightIntensity);
      }
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
    //gl_FragData[0] = vec4(screenPosition.xy, 1., 1.);
  }
  `;
}
