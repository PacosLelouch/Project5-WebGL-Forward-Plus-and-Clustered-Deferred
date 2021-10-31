#version 100
precision highp float;

#define MAX_RADIUS 9
#define BLOOM_COLOR 0.9

uniform sampler2D u_colmap;
uniform vec2 u_resolution;
uniform int u_radius;

const vec3 brightnessVector = vec3(0.2126, 0.7152, 0.0722);

varying vec2 v_uv;

void main() {
    //vec3 bloomThreshold = vec3(BLOOM_COLOR);
    vec3 originColor = texture2D(u_colmap, v_uv).xyz;
    vec3 fragColor = vec3(0.);//vec3(max(originColor.r - bloomThreshold.r, 0.), max(originColor.g - bloomThreshold.g, 0.), max(originColor.b - bloomThreshold.b, 0.));//max(originColor - bloomThreshold, vec3(0.));
    float originBrightness = dot(originColor, brightnessVector);
    float count = 0.;//1.;
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
            vec3 curColor = texture2D(u_colmap, uv1).xyz;
            float brightness = dot(curColor, brightnessVector);
            //vec3 exceedColor = vec3(max(curColor.r - bloomThreshold.r, 0.), max(curColor.g - bloomThreshold.g, 0.), max(curColor.b - bloomThreshold.b, 0.));
            //if(exceedColor.r >= 0. || exceedColor.g >= 0. || exceedColor.b >= 0.) {
            if(brightness > BLOOM_COLOR) {
                //fragColor += curColor;
                fragColor += curColor;
                count += 1.;
            }
        }
    }
    if(count > 0.) {
        fragColor /= count;
    }
    vec3 LDR = fragColor * max(0., 1. - originBrightness) + originColor;
    //vec3 LDR = vec3(1.) - exp(-HDR);
    gl_FragColor = vec4(LDR, 1.);
}