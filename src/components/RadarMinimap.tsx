import React, { useEffect, useRef } from 'react';
import { BOMB_SITES, MAP_BOUNDS, MAP_BOXES } from '../game/mapData';
import type { BombState, RadarBlip } from '../game/types';

interface RadarMinimapProps {
  blips: RadarBlip[];
  playerPos: { x: number; z: number; yaw: number };
  bomb: BombState;
}

export const RadarMinimap: React.FC<RadarMinimapProps> = ({ blips, playerPos, bomb }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 148;
    const pad = 8;
    const mapW = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
    const mapH = MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ;
    const scale = Math.min((size - pad * 2) / mapW, (size - pad * 2) / mapH);
    const ox = (size - mapW * scale) / 2;
    const oz = (size - mapH * scale) / 2;

    const toPx = (wx: number, wz: number) => ({
      x: ox + (wx - MAP_BOUNDS.minX) * scale,
      y: oz + (wz - MAP_BOUNDS.minZ) * scale,
    });

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(13, 17, 24, 0.85)';
    ctx.fillRect(0, 0, size, size);

    // Draw playable floor area
    ctx.fillStyle = 'rgba(32, 39, 50, 0.9)';
    ctx.fillRect(ox, oz, mapW * scale, mapH * scale);

    // Draw map blocks
    for (const b of MAP_BOXES) {
      if (b.id.startsWith('wall_')) continue;
      const p1 = toPx(b.minX, b.minZ);
      const w = (b.maxX - b.minX) * scale;
      const h = (b.maxZ - b.minZ) * scale;
      if (b.id === 'a_platform' || b.isRamp) {
        ctx.fillStyle = 'rgba(72, 82, 98, 0.65)';
      } else if (b.material === 'crate' || b.material === 'metal' || b.material === 'container') {
        ctx.fillStyle = '#8b6e4e';
      } else {
        ctx.fillStyle = '#4f5d70';
      }
      ctx.fillRect(p1.x, p1.y, Math.max(1.5, w), Math.max(1.5, h));
    }

    // Bombsite A / B labels
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const site of BOMB_SITES) {
      const sp = toPx(site.x, site.z);
      ctx.fillStyle = 'rgba(217, 72, 59, 0.25)';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, site.radius * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f87171';
      ctx.fillText(site.id, sp.x, sp.y);
    }

    // Bomb indicator if dropped or planted
    if (bomb.status === 'planted' || bomb.status === 'dropped') {
      const bp = toPx(bomb.x, bomb.z);
      ctx.fillStyle = bomb.status === 'planted' ? '#ef4444' : '#f59e0b';
      ctx.fillRect(bp.x - 3, bp.y - 3, 6, 6);
    }

    // Draw player FOV cone
    const pp = toPx(playerPos.x, playerPos.z);
    // In world, camera forward is (-sin(yaw), -cos(yaw))
    const angle = Math.atan2(-Math.cos(playerPos.yaw), -Math.sin(playerPos.yaw));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.beginPath();
    ctx.moveTo(pp.x, pp.y);
    ctx.arc(pp.x, pp.y, 26, angle - 0.52, angle + 0.52);
    ctx.closePath();
    ctx.fill();

    // Draw blips
    for (const blip of blips) {
      if (!blip.alive) continue;
      if (!blip.isPlayer && !blip.spotted) continue;
      const p = toPx(blip.x, blip.z);
      ctx.beginPath();
      ctx.arc(p.x, p.y, blip.isPlayer ? 3.8 : 3.1, 0, Math.PI * 2);
      if (blip.isPlayer) {
        ctx.fillStyle = '#ffffff';
      } else if (blip.team === 'CT') {
        ctx.fillStyle = '#5d9cec';
      } else {
        ctx.fillStyle = '#e2a84b';
      }
      ctx.fill();
      if (!blip.isPlayer && blip.team !== (blips[0]?.team || 'CT')) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Outer tactical frame
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  }, [blips, playerPos, bomb]);

  return (
    <div className="relative border border-slate-700/80 bg-[#0e121a]/90 w-[148px]">
      <canvas
        ref={canvasRef}
        width={148}
        height={148}
        className="block w-[148px] h-[148px]"
      />
      <div className="px-2 py-1 text-[11px] font-semibold text-slate-300 border-t border-slate-800">
        Dustline Radar
      </div>
    </div>
  );
};
