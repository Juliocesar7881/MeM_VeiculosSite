/**
 * Ilustrações vetoriais usadas SOMENTE no seed de demonstração local.
 * Não são fotos reais e nunca devem ir para produção.
 */
export type DemoShape = 'sedan' | 'hatch' | 'suv' | 'pickup' | 'moto' | 'scooter' | 'truck' | 'tractor';

const SHAPES: Record<DemoShape, { body: string; windows: string; wheels: [number, number, number][] }> = {
  sedan: {
    body: 'M170 560 C170 520 200 505 250 498 L420 470 C470 420 540 385 640 380 L900 382 C980 386 1040 420 1100 470 L1300 492 C1370 502 1420 520 1430 560 L1432 600 C1432 618 1420 628 1400 628 L200 628 C182 628 170 618 170 600 Z',
    windows:
      'M470 470 C520 425 575 402 650 400 L760 400 L760 470 Z M790 400 L890 402 C955 405 1010 432 1060 470 L790 470 Z',
    wheels: [
      [420, 628, 78],
      [1170, 628, 78],
    ],
  },
  hatch: {
    body: 'M190 565 C190 522 222 506 270 498 L440 470 C500 405 575 368 680 364 L1010 366 C1075 370 1120 410 1160 470 L1330 500 C1390 512 1415 535 1418 565 L1420 602 C1420 620 1408 628 1390 628 L215 628 C198 628 190 618 190 602 Z',
    windows:
      'M490 470 C545 418 600 392 680 388 L790 388 L790 470 Z M820 388 L1000 390 C1050 394 1085 425 1115 470 L820 470 Z',
    wheels: [
      [430, 628, 80],
      [1160, 628, 80],
    ],
  },
  suv: {
    body: 'M170 560 C170 505 200 480 250 470 L400 450 C450 385 520 340 640 334 L1060 336 C1130 340 1180 390 1215 450 L1340 470 C1400 480 1430 510 1432 555 L1434 605 C1434 622 1420 632 1400 632 L200 632 C182 632 170 622 170 604 Z',
    windows:
      'M450 450 C500 395 560 362 650 358 L780 358 L780 450 Z M810 358 L1050 360 C1100 364 1140 405 1170 450 L810 450 Z',
    wheels: [
      [420, 632, 88],
      [1180, 632, 88],
    ],
  },
  pickup: {
    body: 'M160 560 C160 510 190 490 240 482 L380 462 C430 395 490 360 580 356 L820 358 C870 362 900 400 920 462 L1420 462 C1440 462 1448 476 1448 496 L1448 606 C1448 622 1436 632 1418 632 L190 632 C172 632 160 622 160 606 Z',
    windows:
      'M430 462 C470 410 515 382 590 380 L690 380 L690 462 Z M715 380 L810 382 C850 386 870 420 885 462 L715 462 Z',
    wheels: [
      [400, 632, 86],
      [1190, 632, 86],
    ],
  },
  moto: {
    body: 'M520 560 L640 420 L840 420 L900 470 L1040 470 L1100 540 L960 560 Z M760 420 L720 350 L800 350 Z',
    windows: 'M860 430 L930 430 L960 470 L880 470 Z',
    wheels: [
      [500, 620, 118],
      [1120, 620, 118],
    ],
  },
  scooter: {
    body: 'M520 600 C520 540 600 500 700 500 L880 500 L940 360 L1010 360 L960 520 C1060 530 1120 570 1130 610 L700 610 Z M600 500 C620 440 700 420 800 430 L820 500 Z',
    windows: 'M950 360 L1000 300 L1030 305 L1000 365 Z',
    wheels: [
      [600, 640, 82],
      [1120, 640, 82],
    ],
  },
  truck: {
    body: 'M160 360 L900 360 L900 600 L160 600 Z M920 420 L1180 420 C1240 420 1280 450 1310 500 L1400 520 C1430 526 1440 545 1440 570 L1440 610 C1440 624 1430 632 1414 632 L920 632 Z',
    windows: 'M1000 440 L1170 440 C1210 440 1240 470 1262 505 L1000 505 Z',
    wheels: [
      [330, 640, 78],
      [560, 640, 78],
      [1260, 640, 78],
    ],
  },
  tractor: {
    body: 'M520 560 L520 400 L800 400 L860 250 L1060 250 L1060 440 L1320 460 C1360 464 1380 490 1380 520 L1380 590 L700 590 Z',
    windows: 'M880 270 L1040 270 L1040 420 L840 420 Z',
    wheels: [
      [620, 590, 170],
      [1240, 620, 100],
    ],
  },
};

export function demoPhotoSvg(options: { shape: DemoShape; color: string; label: string; variant: number }): string {
  const { shape, color, label, variant } = options;
  const s = SHAPES[shape];
  const angle = [0, -6, 6, -3][variant % 4] ?? 0;
  const spot = ['50%', '35%', '65%', '45%'][variant % 4] ?? '50%';
  const wheels = s.wheels
    .map(
      ([cx, cy, r]) => `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#0b0c0d"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="#2b2f34"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 0.5}" fill="none" stroke="#9aa0a8" stroke-width="${r * 0.08}"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 0.14}" fill="#c9cdd2"/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
  <defs>
    <radialGradient id="bg" cx="${spot}" cy="30%" r="80%">
      <stop offset="0" stop-color="#3a3f46"/><stop offset="0.55" stop-color="#16181b"/><stop offset="1" stop-color="#08090a"/>
    </radialGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1d2024"/><stop offset="1" stop-color="#050506"/>
    </linearGradient>
    <linearGradient id="paint" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="0.18" stop-color="${color}"/>
      <stop offset="0.75" stop-color="${color}"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.6"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#9fb4c8" stop-opacity="0.85"/><stop offset="1" stop-color="#1b2530"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="1200" fill="url(#bg)"/>
  <rect y="740" width="1600" height="460" fill="url(#floor)"/>
  <ellipse cx="800" cy="760" rx="720" ry="46" fill="#000" opacity="0.65"/>
  <g transform="translate(0 110) rotate(${angle} 800 600)">
    <path d="${s.body}" fill="url(#paint)"/>
    <path d="${s.windows}" fill="url(#glass)"/>
    ${wheels}
  </g>
  <text x="800" y="1080" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700" fill="#f2c12e" letter-spacing="10">FOTO DEMONSTRATIVA</text>
  <text x="800" y="1130" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#8b929b">${label}</text>
</svg>`;
}
