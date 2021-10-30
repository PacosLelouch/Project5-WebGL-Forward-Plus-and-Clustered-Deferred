#version 100
precision highp float;

uniform mat4 u_viewMatrix;
uniform mat4 u_viewProjectionMatrix;

attribute vec3 a_position;
attribute vec3 a_normal;
attribute vec2 a_uv;

varying vec3 v_position;
varying vec3 v_viewPosition;
varying vec3 v_normal;
varying vec2 v_uv;
varying vec4 v_projPosition;

void main() {
    v_projPosition = u_viewProjectionMatrix * vec4(a_position, 1.0);
    v_position = a_position;
    v_normal = a_normal;
    v_uv = a_uv;
    v_viewPosition = (u_viewMatrix * vec4(a_position, 1.0)).xyz;
    gl_Position = v_projPosition;
}