#version 100
#extension GL_EXT_draw_buffers: enable
precision highp float;

uniform sampler2D u_colmap;
uniform sampler2D u_normap;

uniform mat4 u_viewProjectionMatrix;

uniform int u_packGBuffer;

varying vec3 v_position;
varying vec3 v_normal;
varying vec2 v_uv;

vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
}

void main() {
    vec3 norm = normalize(applyNormalMap(v_normal, texture2D(u_normap, v_uv).xyz));
    vec3 col = vec3(texture2D(u_colmap, v_uv));

    // TODO: populate your g buffer
    // gl_FragData[0] = ??
    // gl_FragData[1] = ??
    // gl_FragData[2] = ??
    // gl_FragData[3] = ??

    if(u_packGBuffer == 0) {
        gl_FragData[0] = vec4(col, 1.);
        gl_FragData[1] = vec4(norm, 0.);
        gl_FragData[2] = vec4(v_position, 1.);
    }
    else {
        float ndcZ = (2.0 * gl_FragCoord.z - gl_DepthRange.near - gl_DepthRange.far) /
            (gl_DepthRange.far - gl_DepthRange.near);
        // vec4 projPosition = (u_viewProjectionMatrix * vec4(v_position, 1.));
        // float ndcZ = projPosition.z / projPosition.w;
        if(u_packGBuffer == 1) {
            gl_FragData[0] = vec4(col, ndcZ * 0.5 + 0.5);
            gl_FragData[1] = vec4(norm, 0.);
        }
        else {
            //float rgb = (col.r * 255.0) * 256. + (col.g * 255.0) * 1. + (col.b * 255.0 / 256.0);
            float rgb = float(int(col.r * 255.0 + 0.5)) * 65536. + float(int(col.g * 255.0 + 0.5)) * 256. + (col.b * 255.0 + 0.5);
            norm = normalize(norm);
            gl_FragData[0] = vec4((norm.z >= 0. ? 1. : -1.) * rgb, norm.x, norm.y, ndcZ * 0.5 + 0.5);
        }
    }
}