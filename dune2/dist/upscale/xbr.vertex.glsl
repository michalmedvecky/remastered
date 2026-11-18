#version 300 es
/*
   Hyllian's xBR-lv2 Shader
   
   Copyright (C) 2011-2016 Hyllian - sergiogdb@gmail.com

   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to deal
   in the Software without restriction, including without limitation the rights
   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in
   all copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   THE SOFTWARE.

   Incorporates some of the ideas from SABR shader. Thanks to Joshua Street.
*/
// WebGL2 fullscreen wrapper; source texture rows retain native top-to-bottom order.
precision highp float;
layout(location=0) in vec2 position;
uniform vec2 TextureSize;
out vec2 texCoord;
out vec4 t1;
out vec4 t2;
out vec4 t3;
out vec4 t4;
out vec4 t5;
out vec4 t6;
out vec4 t7;
void main() {
    gl_Position = vec4(position, 0.0, 1.0);
    vec2 TexCoord = vec2(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
    float dx = 1.0 / TextureSize.x;
    float dy = 1.0 / TextureSize.y;
    texCoord = TexCoord;
    t1 = TexCoord.xxxy + vec4(-dx, 0.0, dx, -2.0 * dy);
    t2 = TexCoord.xxxy + vec4(-dx, 0.0, dx, -dy);
    t3 = TexCoord.xxxy + vec4(-dx, 0.0, dx, 0.0);
    t4 = TexCoord.xxxy + vec4(-dx, 0.0, dx, dy);
    t5 = TexCoord.xxxy + vec4(-dx, 0.0, dx, 2.0 * dy);
    t6 = TexCoord.xyyy + vec4(-2.0 * dx, -dy, 0.0, dy);
    t7 = TexCoord.xyyy + vec4(2.0 * dx, -dy, 0.0, dy);
}
