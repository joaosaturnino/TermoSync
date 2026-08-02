import React from 'react';

/**
 * SVG do logotipo ThermoSync
 *
 * Props:
 * - `size`: tamanho em pixels
 * - `color`: cor principal do logo
 * - `className`: classes CSS adicionais
 */
export default function TermoSyncLogo({ size = 40, color = "currentColor", className = "" }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      className={`termosync-ultra-logo ${className}`} 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Glow Tático Cyberpunk */}
        <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Padrão de Cyber-Grid (Micro Malha dentro do Bulbo) */}
        <pattern id="cyberGrid" width="2" height="2" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.5" fill={color} opacity="0.3" />
        </pattern>

        {/* Gradiente de Fluido Térmico */}
        <linearGradient id="liquidThermo" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color} stopOpacity="0.1" />
        </linearGradient>
      </defs>

      <style>
        {`
          .ts-wave-1 { animation: pulseWave 1.8s ease-in-out infinite alternate; }
          .ts-wave-2 { animation: pulseWave 1.8s ease-in-out infinite alternate 0.5s; }
          .ts-core-bulb { filter: url(#neonGlow); }
          .ts-liquid { animation: thermoRise 3.5s ease-in-out infinite alternate; }
          .ts-data-dot { animation: dataTransfer 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite; filter: drop-shadow(0 0 2px ${color}); }
          .ts-radar-ring { animation: radarPulse 3.5s ease-out infinite; transform-origin: 10px 14.76px; }
          
          @keyframes pulseWave {
            0% { stroke-opacity: 0.15; stroke-width: 1.5; transform: scale(0.95); transform-origin: 15px 14px; }
            100% { stroke-opacity: 1; stroke-width: 2.5; transform: scale(1.05); transform-origin: 15px 14px; }
          }
          
          @keyframes thermoRise {
            0% { transform: scaleY(0.85); transform-origin: bottom; }
            100% { transform: scaleY(1.1); transform-origin: bottom; }
          }

          @keyframes dataTransfer {
            0% { opacity: 0; transform: translateY(5px) scale(0.5); }
            50% { opacity: 1; transform: translateY(-2px) scale(1.3); fill: #38bdf8; }
            100% { opacity: 0; transform: translateY(-9px) scale(0.5); }
          }

          @keyframes radarPulse {
            0% { r: 2.5; opacity: 0.7; stroke-width: 2; }
            100% { r: 14; opacity: 0; stroke-width: 0; }
          }
        `}
      </style>
      
      {/* Anel de Radar de Fundo (Pulse Ring) */}
      <circle className="ts-radar-ring" cx="10" cy="14.76" r="2.5" stroke={color} fill="none" />

      {/* Corpo Externo do Termómetro com Fundo de Malha Cyber */}
      <path 
        className="ts-core-bulb" 
        d="M10 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        fill="url(#cyberGrid)"
      />
      
      {/* Líquido Térmico Animado (Sobe e Desce Suavemente) */}
      <path 
        className="ts-liquid" 
        d="M10 14.76V8a2.5 2.5 0 0 0-5 0v6.76a4.5 4.5 0 1 0 5 0z" 
        fill="url(#liquidThermo)"
      />
      
      {/* Nível de Marcação (Aço escovado virtual) */}
      <path 
        d="M7.5 13.5v-5" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        opacity="0.8"
      />
      
      {/* Ondas de Transmissão IoT (Sinal Radar) */}
      <path 
        className="ts-wave-1" 
        d="M15 9a5 5 0 0 1 5 5" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        className="ts-wave-2" 
        d="M15 5a9 9 0 0 1 9 9" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />

      {/* Ponto de Fluxo de Dados (Enviando Pacotes de Telemetria) */}
      <circle 
        className="ts-data-dot" 
        cx="15" 
        cy="9" 
        r="1.8" 
        fill={color} 
      />
    </svg>
  );
}