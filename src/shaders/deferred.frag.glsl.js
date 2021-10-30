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
  return glsl`
  #version 100
  precision highp float;
  precision highp int;
  
  #define NUM_LIGHTS ${params.numLights} 
  #define MAX_LIGHT_PER_CLUSTER ${params.maxLightPerCluster}
  #define CLUSTER_WITH_LINEAR_DEPTH ${params.clusterWithLinearDepth} 
  #define PACK_GBUFFER ${params.packGBuffer}
  #define CLUSTERED_DEFERRED_DEBUG 0//2
  
  uniform sampler2D u_lightbuffer;

  // DONE: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

  uniform mat4 u_viewMatrix;
  uniform mat4 u_projectionMatrix;
  uniform mat4 u_viewProjectionMatrix;
  uniform vec3 u_sliceSize;
  uniform float u_near;
  uniform float u_far;

  uniform vec3 u_specularColor;
  uniform float u_shininess;
  uniform vec2 u_resolution;

  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  varying vec2 v_uv;

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

  vec3 unprojectScreenSpaceToViewSpace(vec3 screenPoint, mat4 projMat) {
    float A = projMat[2][2];
    float B = projMat[3][2];
  
    float x_ndc = screenPoint[0] * 2. - 1.;
    float y_ndc = screenPoint[1] * 2. - 1.;
    float z_ndc = screenPoint[2] * 2. - 1.;
  
    float z_eye = B / (A + z_ndc);
    return vec3(
      z_eye * x_ndc / projMat[0][0],
      z_eye * y_ndc / projMat[1][1],
      -z_eye);
  }
  
  void main() {
    // DONE: extract data from g buffers and do lighting
    // vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    // vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    // vec4 gb2 = texture2D(u_gbuffers[2], v_uv);
    // vec4 gb3 = texture2D(u_gbuffers[3], v_uv);
    
    //gl_FragColor = vec4(v_uv, 0.0, 1.0);
    vec3 fragColor = vec3(0.0);

  #if PACK_GBUFFER == 0
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    vec4 gb2 = texture2D(u_gbuffers[2], v_uv);

    vec4 worldPosition4 = gb2;
    
    vec3 worldPosition = worldPosition4.xyz;
    vec3 normal = gb1.xyz;
    vec3 albedo = gb0.xyz;

    vec3 viewPosition = (u_viewMatrix * worldPosition4).xyz;
    vec4 projPosition = u_viewProjectionMatrix * worldPosition4;
    vec3 screenPosition = projPosition.xyz / projPosition.w * vec3(0.5, 0.5, 0.5) + vec3(0.5, 0.5, 0.5);
  #elif PACK_GBUFFER == 1
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);

    vec3 screenPosition = vec3(gl_FragCoord.xy / u_resolution, gb0.w);
    vec3 viewPosition = unprojectScreenSpaceToViewSpace(screenPosition, u_projectionMatrix);

    vec3 normal = gb1.xyz;
    vec3 albedo = gb0.xyz;

    vec3 viewNormal = (u_viewMatrix * vec4(normal, 0.)).xyz;
  #else // PACK_GBUFFER
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);

    vec3 screenPosition = vec3(gl_FragCoord.xy / u_resolution, gb0.w);
    vec3 viewPosition = unprojectScreenSpaceToViewSpace(screenPosition, u_projectionMatrix);


    // float rgb = abs(gb0.x);
    // int rg = int(rgb);
    // float b = min(1., (rgb - float(rg)) * 256. / 255.);
    // int ri = rg / 256;
    // float r = float(ri) / 255.;
    // int gi = rg - ri * 256;
    // float g = float(gi) / 255.;

    int rgb = int(abs(gb0.x) + 0.5);
    int ri = rgb / 65536;
    float r = float(ri) / 255.;
    int gb = rgb - ri * 65536;
    int gi = gb / 256;
    float g = float(gi) / 255.;
    int bi = gb - gi * 256;
    float b = float(bi) / 255.;
    
    vec3 normal = vec3(gb0.y, gb0.z, (gb0.x >= 0. ? 1. : -1.) * sqrt(max(0., 1. - gb0.y * gb0.y - gb0.z * gb0.z)));
    vec3 albedo = vec3(r, g, b);

    vec3 viewNormal = (u_viewMatrix * vec4(normal, 0.)).xyz;
  #endif // PACK_GBUFFER

    // gl_FragColor = vec4(gl_FragCoord.xy / u_resolution, 0., 1.);
    // return;
    
  #if CLUSTERED_DEFERRED_DEBUG > 2
    fragColor = vec3(screenPosition.xy * u_sliceSize.xy, 0.);
    fragColor.x = fract(fragColor.x) * 0.02;
    fragColor.y = fract(fragColor.y) * 0.02;
    //return;
  #endif // CLUSTERED_DEFERRED_DEBUG
  #if CLUSTER_WITH_LINEAR_DEPTH
    screenPosition.z = (-viewPosition.z - u_near) / (u_far - u_near);
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
  #if CLUSTERED_DEFERRED_DEBUG
    //gl_FragColor = vec4(screenPosition.zzz, 1.);
    //gl_FragColor = vec4(screenPosition.xy, 0., 1.);
    fragColor += vec3((lightNumInClusterF) / (min(float(MAX_LIGHT_PER_CLUSTER), float(NUM_LIGHTS)) * 2.));
    //gl_FragColor = vec4(fragColor, 1.);
    //return;
  #endif // CLUSTERED_DEFERRED_DEBUG
  #if CLUSTERED_DEFERRED_DEBUG == 1
    for (int i = 0; i < NUM_LIGHTS; ++i) {
  #else // CLUSTERED_DEFERRED_DEBUG
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
  #endif // CLUSTERED_DEFERRED_DEBUG
      Light light = UnpackLight(i);
  #if PACK_GBUFFER == 0
      float lightDistance = distance(light.position, worldPosition);
      vec3 L = (light.position - worldPosition) / lightDistance;
      float lambertTerm = max(dot(L, normal), 0.0);
  #else // PACK_GBUFFER
      vec3 viewLightPosition = (u_viewMatrix * vec4(light.position, 1.)).xyz;
      float lightDistance = distance(viewLightPosition, viewPosition);
      vec3 viewL = (viewLightPosition - viewPosition) / lightDistance;
      float lambertTerm = max(dot(viewL, viewNormal), 0.0);
  #endif // PACK_GBUFFER

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);

      if(u_shininess > 0.) {
  #if PACK_GBUFFER == 0
        vec3 V = normalize(-u_viewMatrix[3].xyz - worldPosition);
        vec3 H = normalize(V + L);
        float specularTerm = pow(max(dot(H, normal), 0.0), u_shininess);
  #else // PACK_GBUFFER
        vec3 viewV = normalize(-viewPosition);
        vec3 viewH = normalize(viewV + viewL);
        float specularTerm = pow(max(dot(viewH, viewNormal), 0.0), u_shininess);
  #endif //  PACK_GBUFFER
        fragColor += u_specularColor * specularTerm * light.color * vec3(lightIntensity);
      }
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}