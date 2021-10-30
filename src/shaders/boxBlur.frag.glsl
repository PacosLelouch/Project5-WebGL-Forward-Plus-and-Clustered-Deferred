#version 100
precision highp float;

#define MAX_RADIUS 9

uniform sampler2D u_colmap;
uniform vec2 u_resolution;
uniform int u_radius;

varying vec2 v_uv;

void main() {
    vec3 fragColor = texture2D(u_colmap, v_uv).xyz;
    float count = 1.;
    vec2 d = vec2(1.) / u_resolution;
    //for(int yi = -u_radius; yi <= u_radius; ++yi) {
    for(int yi = -MAX_RADIUS; yi <= MAX_RADIUS; ++yi) {
        if(yi < -u_radius || yi > u_radius) {
            continue;
        }
        //for(int xi = -u_radius; xi <= u_radius; ++xi) {
        for(int xi = -MAX_RADIUS; xi <= MAX_RADIUS; ++xi) {
            if(xi < -u_radius || xi > u_radius) {
                continue;
            }
            if(xi == 0 && yi == 0) {
                continue;
            }
            vec2 uv1 = v_uv + vec2(float(xi), float(yi)) * d;
            if(uv1.x < 0. || uv1.x > 1. || uv1.y < 0. || uv1.y > 1.) {
                continue;
            }
            fragColor += texture2D(u_colmap, uv1).xyz;
            count += 1.;
        }
    }
    fragColor /= count;
    gl_FragColor = vec4(fragColor, 1.);
}