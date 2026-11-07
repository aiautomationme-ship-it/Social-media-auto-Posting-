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
        .then((adapter: any) => {
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
      // Keep DPR at 1.0 max to ensure 60fps on low-end mobile/laptop devices
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      if (gl) {
        gl.viewport(0, 0, width, height);
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

        vec3 colorSilverLight = vec3(0.93, 0.94, 0.95);
        vec3 colorSilverMid   = vec3(0.78, 0.80, 0.82);
        vec3 colorSmokeCharcoal = vec3(0.18, 0.20, 0.22);
        vec3 colorSteel       = vec3(0.50, 0.52, 0.55);

        // Simple hash for background dust/specks like in reference image
        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

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
              rippleOffset += dir * ring * 0.04 * intensity;
              rippleHighlight += ring * 0.16 * intensity;
            }
          }

          vec2 displacedUv = uv + rippleOffset;
          vec2 flowP = displacedUv;
          flowP.x *= aspect;

          float t = u_time * 0.20;
          float wave1 = sin(flowP.x * 2.4 + t * 0.8) * cos(flowP.y * 2.0 - t * 0.6);
          float wave2 = cos(flowP.x * 1.8 - t * 0.5) * sin(flowP.y * 2.6 + t * 0.7);
          float wave3 = sin((flowP.x + flowP.y) * 1.6 + t * 0.9);

          vec2 mouseAspect = u_mouse;
          mouseAspect.x *= aspect;
          float mouseDist = distance(flowP, mouseAspect);
          float mouseGlow = exp(-mouseDist * 2.5) * 0.25;

          // Radial vignette similar to reference image (lighter center, darker corners)
          vec2 center = vec2(0.5 * aspect, 0.5);
          float centerDist = distance(flowP, center);
          float vignette = smoothstep(0.15, 0.95, centerDist);

          float mix1 = clamp(wave1 * 0.5 + 0.5, 0.0, 1.0);
          float mix2 = clamp(wave2 * 0.5 + 0.5, 0.0, 1.0);
          float mix3 = clamp(wave3 * 0.5 + 0.5, 0.0, 1.0);

          // Flowing silver-smoke gradient
          vec3 bg = mix(colorSilverLight, colorSilverMid, mix1 * 0.5 + vignette * 0.4);
          bg = mix(bg, colorSmokeCharcoal, mix2 * 0.14 + vignette * 0.25);
          bg = mix(bg, colorSteel, mix3 * 0.12 + mouseGlow * 0.15);

          // Soft ripple shimmer
          bg += vec3(rippleHighlight * 0.25);

          // Subtle floating particles / grain texture inspired by reference image
          vec2 grid = floor(uv * 180.0);
          float h = hash(grid);
          if (h > 0.985) {
            float speck = sin(u_time * 1.5 + h * 6.28) * 0.5 + 0.5;
            bg -= vec3(0.08 * speck);
          }

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
            let lastFrameTime = startTime;

            const render = () => {
              if (!gl) return;
              // Skip rendering when document is in background to save 100% CPU/GPU on low-end devices
              if (typeof document !== 'undefined' && document.hidden) {
                animationFrameId = requestAnimationFrame(render);
                return;
              }

              const now = performance.now();
              // Cap at 45-60fps max for smooth buttery performance without overheating
              if (now - lastFrameTime < 16) {
                animationFrameId = requestAnimationFrame(render);
                return;
              }
              lastFrameTime = now;

              const elapsed = (now - startTime) * 0.001;

              mousePos.x += (targetMousePos.x - mousePos.x) * 0.08;
              mousePos.y += (targetMousePos.y - mousePos.y) * 0.08;

              ripples = ripples.filter((r: Ripple) => now - r.birth < r.duration);

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
        /* Shaders Package: WebGPU FlowingGradient + CursorRipples with Monochrome/Silver/Smoke Palette */
        <Shader className="w-full h-full opacity-80">
          <FlowingGradient
            colorA="#F3F4F6"
            colorB="#D1D5DB"
            colorC="#9CA3AF"
            colorD="#1F242D"
            colorSpace="oklch"
            speed={0.4}
            distortion={0.35}
          />
          <CursorRipples
            intensity={8}
            decay={9}
            radius={0.45}
            chromaticSplit={0.15}
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
      {/* Subtle corner cross accents and vignette atmosphere matching user's reference image */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Top-Right stylized geometric cross */}
        <div className="absolute -top-10 -right-10 w-44 h-44 opacity-25 filter blur-[0.5px]">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-14 bg-gradient-to-r from-transparent via-[#4B5563] to-[#111827] rounded-sm transform rotate-45" />
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-14 bg-gradient-to-b from-transparent via-[#4B5563] to-[#111827] rounded-sm transform rotate-45" />
        </div>

        {/* Bottom-Left stylized geometric cross */}
        <div className="absolute -bottom-10 -left-10 w-44 h-44 opacity-25 filter blur-[0.5px]">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-14 bg-gradient-to-r from-[#111827] via-[#4B5563] to-transparent rounded-sm transform rotate-45" />
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-14 bg-gradient-to-b from-[#111827] via-[#4B5563] to-transparent rounded-sm transform rotate-45" />
        </div>

        {/* Cinematic radial vignette (light center, darker smoky borders) */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(17,24,39,0.08)_100%)] pointer-events-none" />
      </div>
    </div>
  );
};
