import React, { useState, useEffect, useRef } from 'react';
import { Shader, FlowingGradient, CursorRipples } from 'shaders/react';

interface Ripple {
  x: number;
  y: number;
  birth: number;
  duration: number;
  intensity: number;
}

export const FlowingGradientBackground: React.FC = () => {
  const [hasWebGPU, setHasWebGPU] = useState<boolean | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Detect WebGPU capability for Shaders package
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'gpu' in navigator && navigator.gpu) {
      navigator.gpu
        .requestAdapter()
        .then((adapter) => {
          setHasWebGPU(!!adapter);
        })
        .catch(() => {
          setHasWebGPU(false);
        });
    } else {
      setHasWebGPU(false);
    }
  }, []);

  // WebGL / Canvas2D Fallback when WebGPU is not supported by client browser
  useEffect(() => {
    if (hasWebGPU) return; // WebGPU Shaders component is active

    const canvas = canvasRef.current;
    if (!canvas) return;

    let gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'low-power' });
    let animationFrameId: number;
    let ripples: Ripple[] = [];
    const MAX_RIPPLES = 8;
    let lastMouseMoveTime = 0;
    let mousePos = { x: 0.5, y: 0.5 };
    let targetMousePos = { x: 0.5, y: 0.5 };

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      if (gl) {
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const handlePointerMove = (e: PointerEvent) => {
      const x = e.clientX / window.innerWidth;
      const y = 1.0 - e.clientY / window.innerHeight;
      targetMousePos = { x, y };

      const now = performance.now();
      if (now - lastMouseMoveTime > 55) {
        lastMouseMoveTime = now;
        ripples.push({
          x,
          y,
          birth: now,
          duration: 1800,
          intensity: 0.5,
        });
        if (ripples.length > MAX_RIPPLES) {
          ripples.shift();
        }
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      const x = e.clientX / window.innerWidth;
      const y = 1.0 - e.clientY / window.innerHeight;
      ripples.push({
        x,
        y,
        birth: performance.now(),
        duration: 2200,
        intensity: 0.9,
      });
      if (ripples.length > MAX_RIPPLES) {
        ripples.shift();
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });

    if (gl) {
      const vsSource = `
        attribute vec2 a_position;
        varying vec2 v_uv;
        void main() {
          v_uv = (a_position + 1.0) * 0.5;
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
      `;

      const fsSource = `
        precision highp float;
        varying vec2 v_uv;
        uniform vec2 u_resolution;
        uniform float u_time;
        uniform vec2 u_mouse;
        uniform vec4 u_ripples[8];
        uniform int u_ripple_count;

        vec3 colorIvory = vec3(0.972, 0.965, 0.945);
        vec3 colorForest = vec3(0.121, 0.427, 0.321);
        vec3 colorAmber = vec3(0.741, 0.443, 0.192);
        vec3 colorWarmCream = vec3(0.952, 0.937, 0.910);

        void main() {
          vec2 uv = v_uv;
          float aspect = u_resolution.x / u_resolution.y;
          vec2 p = uv;
          p.x *= aspect;

          vec2 rippleOffset = vec2(0.0);
          float rippleHighlight = 0.0;

          for (int i = 0; i < 8; i++) {
            if (i >= u_ripple_count) break;
            vec4 rip = u_ripples[i];
            vec2 ripPos = rip.xy;
            ripPos.x *= aspect;
            float age = rip.z;
            float intensity = rip.w;
            float dist = distance(p, ripPos);
            float currentRadius = age * 0.55;
            float waveDist = abs(dist - currentRadius);
            if (waveDist < 0.2) {
              float ring = sin(waveDist * 40.0 - age * 8.0) * exp(-waveDist * 18.0) * (1.0 - age);
              vec2 dir = normalize(p - ripPos + 0.0001);
              rippleOffset += dir * ring * 0.035 * intensity;
              rippleHighlight += ring * 0.12 * intensity;
            }
          }

          vec2 displacedUv = uv + rippleOffset;
          vec2 flowP = displacedUv;
          flowP.x *= aspect;

          float t = u_time * 0.18;
          float wave1 = sin(flowP.x * 2.2 + t * 0.8) * cos(flowP.y * 1.8 - t * 0.6);
          float wave2 = cos(flowP.x * 1.6 - t * 0.5) * sin(flowP.y * 2.4 + t * 0.7);
          float wave3 = sin((flowP.x + flowP.y) * 1.4 + t * 0.9);

          vec2 mouseAspect = u_mouse;
          mouseAspect.x *= aspect;
          float mouseDist = distance(flowP, mouseAspect);
          float mouseGlow = exp(-mouseDist * 2.8) * 0.22;

          float mix1 = clamp(wave1 * 0.5 + 0.5, 0.0, 1.0);
          float mix2 = clamp(wave2 * 0.5 + 0.5, 0.0, 1.0);
          float mix3 = clamp(wave3 * 0.5 + 0.5, 0.0, 1.0);

          vec3 bg = colorIvory;
          bg = mix(bg, colorWarmCream, mix1 * 0.35);
          bg = mix(bg, colorForest, mix2 * 0.065 + mouseGlow * 0.04);
          bg = mix(bg, colorAmber, mix3 * 0.075 + mouseGlow * 0.05);
          bg += vec3(rippleHighlight * 0.45, rippleHighlight * 0.40, rippleHighlight * 0.32);

          gl_FragColor = vec4(bg, 1.0);
        }
      `;

      const createShader = (type: number, source: string) => {
        if (!gl) return null;
        const shader = gl.createShader(type);
        if (!shader) return null;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          gl.deleteShader(shader);
          return null;
        }
        return shader;
      };

      const vs = createShader(gl.VERTEX_SHADER, vsSource);
      const fs = createShader(gl.FRAGMENT_SHADER, fsSource);

      if (vs && fs) {
        const program = gl.createProgram();
        if (program) {
          gl.attachShader(program, vs);
          gl.attachShader(program, fs);
          gl.linkProgram(program);

          if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
            gl.useProgram(program);

            const quadBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
              gl.STATIC_DRAW
            );

            const posAttr = gl.getAttribLocation(program, 'a_position');
            gl.enableVertexAttribArray(posAttr);
            gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

            const uResolution = gl.getUniformLocation(program, 'u_resolution');
            const uTime = gl.getUniformLocation(program, 'u_time');
            const uMouse = gl.getUniformLocation(program, 'u_mouse');
            const uRipples = gl.getUniformLocation(program, 'u_ripples');
            const uRippleCount = gl.getUniformLocation(program, 'u_ripple_count');

            let startTime = performance.now();

            const render = () => {
              if (!gl) return;
              const now = performance.now();
              const elapsed = (now - startTime) * 0.001;

              mousePos.x += (targetMousePos.x - mousePos.x) * 0.08;
              mousePos.y += (targetMousePos.y - mousePos.y) * 0.08;

              ripples = ripples.filter((r) => now - r.birth < r.duration);

              const rippleData: number[] = [];
              for (let i = 0; i < 8; i++) {
                if (i < ripples.length) {
                  const rip = ripples[i];
                  const age = (now - rip.birth) / rip.duration;
                  rippleData.push(rip.x, rip.y, age, rip.intensity);
                } else {
                  rippleData.push(0, 0, 0, 0);
                }
              }

              gl.uniform2f(uResolution, canvas.width, canvas.height);
              gl.uniform1f(uTime, elapsed);
              gl.uniform2f(uMouse, mousePos.x, mousePos.y);
              gl.uniform4fv(uRipples, new Float32Array(rippleData));
              gl.uniform1i(uRippleCount, ripples.length);

              gl.drawArrays(gl.TRIANGLES, 0, 6);
              animationFrameId = requestAnimationFrame(render);
            };

            render();
            return () => {
              cancelAnimationFrame(animationFrameId);
              window.removeEventListener('resize', handleResize);
              window.removeEventListener('pointermove', handlePointerMove);
              window.removeEventListener('pointerdown', handlePointerDown);
            };
          }
        }
      }
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [hasWebGPU]);

  return (
    <div className="fixed inset-0 pointer-events-none -z-10 w-full h-full overflow-hidden select-none">
      {hasWebGPU ? (
        /* Shaders Package: WebGPU FlowingGradient + CursorRipples */
        <Shader className="w-full h-full opacity-65">
          <FlowingGradient
            colorA="#F8F6F1"
            colorB="#F4F1EB"
            colorC="#DF9B52"
            colorD="#1F6D52"
            colorSpace="oklch"
            speed={0.45}
            distortion={0.35}
          />
          <CursorRipples
            intensity={8}
            decay={9}
            radius={0.45}
            chromaticSplit={0.3}
            edges="stretch"
          />
        </Shader>
      ) : (
        /* WebGL / Canvas Fallback for devices without WebGPU */
        <canvas
          ref={canvasRef}
          className="w-full h-full opacity-90"
          aria-hidden="true"
        />
      )}
    </div>
  );
};
