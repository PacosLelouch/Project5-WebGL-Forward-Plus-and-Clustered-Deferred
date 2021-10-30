import { gl, WEBGL_draw_buffers, canvas } from '../init';
import { mat4, vec4 } from 'gl-matrix';
import { loadShaderProgram, renderFullscreenQuad } from '../utils';
import { NUM_LIGHTS } from '../scene';
import QuadVertSource from '../shaders/quad.vert.glsl';
import BoxBlurFragSource from '../shaders/boxBlur.frag.glsl';

export default class BoxBlur {
    constructor(radius = 1) {
        this.radius = radius;
        this._width = canvas.width
        this._height = canvas.height;

        this._progPostProcessing = loadShaderProgram(QuadVertSource, BoxBlurFragSource, {
            uniforms: ['u_colmap', 'u_radius', 'u_resolution'],
            attribs: ['a_uv'],
        });
        
        this._fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo);
        
        this._colTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this._colTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this._width, this._height, 0, gl.RGBA, gl.FLOAT, null);
        //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this._width, this._height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._colTex, 0);
        //this._fbo.texture = this._colTex;

        // this._depthTex = gl.createTexture();
        // gl.bindTexture(gl.TEXTURE_2D, this._depthTex);
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, this._width, this._height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
        // gl.bindTexture(gl.TEXTURE_2D, null);
        // gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this._depthTex, 0);

        this._depthRB = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, this._depthRB);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this._width, this._height);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this._depthRB);

        //WEBGL_draw_buffers.drawBuffersWEBGL([gl.COLOR_ATTACHMENT0]);
        
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
            throw "Framebuffer incomplete";
        }
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    }

    isEnabled() {
        return this.radius > 0;
    }

    tryResize() {
        if (canvas.width != this._width || canvas.height != this._height) {
            this.resize(canvas.width, canvas.height);
        }
    }
    
    resize(width, height) {
        this._width = width;
        this._height = height;

        gl.bindTexture(gl.TEXTURE_2D, this._colTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this._width, this._height, 0, gl.RGBA, gl.FLOAT, null);
        //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this._width, this._height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        
        // gl.bindTexture(gl.TEXTURE_2D, this._depthTex);
        // gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, this._width, this._height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        
        gl.bindRenderbuffer(gl.RENDERBUFFER, this._depthRB);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this._width, this._height);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    }

    render() {
        //console.log("render blur", this.radius, this._width, this._height); //TEST

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        //gl.viewport(0, 0, this._width, this._height);
        //gl.disable(gl.DEPTH_TEST);
        
        // Clear the frame
        //gl.clearColor(1, 1, 1, 1);
        //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
        // Use this shader program
        gl.useProgram(this._progPostProcessing.glShaderProgram);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._colTex);
        gl.uniform1i(this._progPostProcessing.u_colmap, 0);

        gl.uniform1i(this._progPostProcessing.u_radius, this.radius);
        gl.uniform2f(this._progPostProcessing.u_resolution, this._width, this._height);

        renderFullscreenQuad(this._progPostProcessing);
        //gl.enable(gl.DEPTH_TEST);
    }
};
